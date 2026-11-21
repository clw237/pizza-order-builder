import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import {
  describeOrder,
  formatCents,
  priceOrder,
  validateOrder,
  type FieldError,
  type OrderInput,
  type Quote,
  STATUS_LABELS,
} from "@pizza/pricing";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import {
  advance,
  canEdit,
  cancel,
  editRefusal,
  type Refusal,
  type Transition,
} from "./lifecycle";
import { MANUAL_KITCHEN, nextStep, type KitchenSchedule } from "./kitchen";
import { OrderStore, type StoredOrder } from "./store";

export interface AppOptions {
  store?: OrderStore;
  logger?: boolean;
  now?: () => Date;
  /** Secret the restaurant sends in the `Kitchen-Token` header. Unset means those routes are closed. */
  kitchenToken?: string | undefined;
  /** The kitchen timer's delays, reported on each order as its next step. Default: every step manual. */
  schedule?: KitchenSchedule;
  /** Browser origins allowed to send POST and PUT. Default: the dev builder on port 5173. */
  allowedOrigins?: string[] | undefined;
}

export const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

interface Problem {
  statusCode: number;
  body: { error: string; message: string } & Record<string, unknown>;
}

type IdParams = { Params: { id: string } };

/**
 * Builds the order service. Handlers are async but never await, so reading an order, checking
 * its state and saving the result happen in one turn of the event loop. That is what makes a
 * customer's cancel and the kitchen's start mutually exclusive.
 */
export function buildApp(options: AppOptions = {}) {
  const store = options.store ?? new OrderStore();
  const now = options.now ?? (() => new Date());
  const schedule = options.schedule ?? MANUAL_KITCHEN;
  const show = (order: StoredOrder) => view(order, schedule);
  const allowedOrigins = new Set(
    options.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS,
  );
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 16 * 1024,
  });

  app.setErrorHandler(
    (error: { statusCode?: number; message: string }, request, reply) => {
      const statusCode = error.statusCode ?? 500;
      if (statusCode >= 500) {
        request.log.error(error);
        return reply
          .code(500)
          .send({ error: "INTERNAL_ERROR", message: "Something went wrong" });
      }
      return reply
        .code(statusCode)
        .send({ error: "BAD_REQUEST", message: error.message });
    },
  );

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send({
      error: "NOT_FOUND",
      message: `No route for ${request.method} ${request.url}`,
    }),
  );

  // Another site's page can make the customer's browser POST here. When a browser says where a
  // state-changing request comes from and it isn't the builder, refuse before any handler runs.
  app.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    if (request.method !== "POST" && request.method !== "PUT") return;
    if (origin === undefined || allowedOrigins.has(origin)) return;
    return reply.code(403).send({
      error: "ORIGIN_NOT_ALLOWED",
      message: `Requests from ${origin} are not allowed`,
    });
  });

  app.get("/health", async () => ({ ok: true }));

  /** Restaurant side: every order, oldest first. */
  app.get("/orders", async (request, reply) => {
    const denied = kitchenDenial(request, options.kitchenToken);
    if (denied) return send(reply, denied);
    return store.list().map(show);
  });

  app.get<IdParams>("/orders/:id", async (request, reply) => {
    const order = store.get(request.params.id);
    if (!order) return send(reply, notFound(request.params.id));
    return show(order);
  });

  app.post("/orders", async (request, reply) => {
    const key = idempotencyKey(request);
    if (!key.ok) return send(reply, key.problem);
    const scope = `POST /orders ${key.value}`;
    const fingerprint = canonicalJson(request.body);
    const replay = replayFor(scope, fingerprint);
    if (replay) return send(reply, replay);

    const submission = readSubmission(request.body);
    if (!submission.ok) return send(reply, submission.problem);

    const timestamp = now().toISOString();
    const order: StoredOrder = {
      id: randomUUID(),
      status: "NOT_STARTED",
      version: 1,
      ...submission.value,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    store.save(order);
    return remember(reply, scope, fingerprint, 201, show(order));
  });

  app.put<IdParams>("/orders/:id", async (request, reply) => {
    const key = idempotencyKey(request);
    if (!key.ok) return send(reply, key.problem);
    const scope = `PUT /orders/${request.params.id} ${key.value}`;
    const fingerprint = canonicalJson([
      request.headers["if-match"],
      request.body,
    ]);
    const replay = replayFor(scope, fingerprint);
    if (replay) return send(reply, replay);

    const current = store.get(request.params.id);
    if (!current) return send(reply, notFound(request.params.id));
    if (!canEdit(current.status))
      return send(reply, refused(editRefusal(current.status), show(current)));

    const version = expectedVersion(request);
    if (!version.ok) return send(reply, version.problem);
    if (version.value !== current.version) {
      return send(reply, {
        statusCode: 409,
        body: {
          error: "VERSION_CONFLICT",
          message: `The order changed since you loaded it (now version ${current.version}). Reload and try again.`,
          order: show(current),
        },
      });
    }

    const submission = readSubmission(request.body);
    if (!submission.ok) return send(reply, submission.problem);

    const updated: StoredOrder = {
      ...current,
      ...submission.value,
      version: current.version + 1,
      updatedAt: now().toISOString(),
    };
    store.save(updated);
    return remember(reply, scope, fingerprint, 200, show(updated));
  });

  // The key is required, not replayed (cancel is already idempotent, S-10): a custom header
  // can't be sent cross-site without a preflight, which this service never answers.
  app.post<IdParams>("/orders/:id/cancel", async (request, reply) => {
    const key = idempotencyKey(request);
    if (!key.ok) return send(reply, key.problem);
    return transition(request, reply, cancel);
  });

  /** Restaurant side: moves an order one step along the kitchen's path. */
  app.post<IdParams>("/orders/:id/advance", async (request, reply) => {
    const denied = kitchenDenial(request, options.kitchenToken);
    if (denied) return send(reply, denied);
    return transition(request, reply, advance);
  });

  function transition(
    request: FastifyRequest<IdParams>,
    reply: FastifyReply,
    step: (status: StoredOrder["status"]) => Transition,
  ) {
    const outcome = store.transition(request.params.id, step, now());
    if (outcome.kind === "not-found") {
      return send(reply, notFound(request.params.id));
    }
    if (outcome.kind === "refused") {
      return send(reply, refused(outcome.refusal, show(outcome.order)));
    }
    return show(outcome.order);
  }

  function replayFor(scope: string, fingerprint: string): Problem | undefined {
    const stored = store.getResponse(scope);
    if (!stored) return undefined;
    if (stored.fingerprint !== fingerprint) {
      return {
        statusCode: 422,
        body: {
          error: "IDEMPOTENCY_KEY_REUSED",
          message:
            "This Idempotency-Key was already used for a different request",
        },
      };
    }
    return {
      statusCode: stored.statusCode,
      body: stored.body as Problem["body"],
    };
  }

  function remember(
    reply: FastifyReply,
    scope: string,
    fingerprint: string,
    statusCode: number,
    body: unknown,
  ) {
    store.saveResponse(scope, { fingerprint, statusCode, body });
    return reply.code(statusCode).send(body);
  }

  return app;
}

/**
 * JSON with object keys sorted, so a retry that lists the same fields in a different order has the
 * same fingerprint as the first request. Array order is kept: it is part of the order's meaning.
 */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, field: unknown) =>
    field && typeof field === "object" && !Array.isArray(field)
      ? Object.fromEntries(
          Object.entries(field).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
      : field,
  );
}

type Result<T> = { ok: true; value: T } | { ok: false; problem: Problem };

type Priced = Pick<StoredOrder, "input" | "quote" | "description">;

/** Body of POST and PUT: `{ order, expectedTotalCents }`. The service always reprices. */
function readSubmission(body: unknown): Result<Priced> {
  if (
    !isRecord(body) ||
    Object.keys(body).some((k) => k !== "order" && k !== "expectedTotalCents")
  ) {
    return badRequest(
      "INVALID_REQUEST",
      "Body must be { order, expectedTotalCents }",
    );
  }
  const expected = body.expectedTotalCents;
  if (
    typeof expected !== "number" ||
    !Number.isInteger(expected) ||
    expected < 0
  ) {
    return badRequest(
      "INVALID_REQUEST",
      "expectedTotalCents must be the total you showed, in cents",
    );
  }
  const result = validateOrder(body.order);
  if (!result.ok) return invalidOrder(result.errors);

  const quote: Quote = priceOrder(result.order);
  if (quote.total !== expected) {
    return {
      ok: false,
      problem: {
        statusCode: 409,
        body: {
          error: "PRICE_MISMATCH",
          message: `The total is ${formatCents(quote.total)}, not ${formatCents(expected)}. Please review the order.`,
          quote,
        },
      },
    };
  }
  const input: OrderInput = result.input;
  return {
    ok: true,
    value: { input, quote, description: describeOrder(result.order) },
  };
}

function idempotencyKey(request: FastifyRequest): Result<string> {
  const key = request.headers["idempotency-key"];
  if (typeof key !== "string" || key.length === 0 || key.length > 200) {
    return badRequest(
      "MISSING_IDEMPOTENCY_KEY",
      "Send an Idempotency-Key header (1-200 characters), the same one on every retry",
    );
  }
  return { ok: true, value: key };
}

/** Undefined when the request carries the configured kitchen token; otherwise the 401 to send. */
function kitchenDenial(
  request: FastifyRequest,
  expected: string | undefined,
): Problem | undefined {
  const sent = request.headers["kitchen-token"];
  if (expected && typeof sent === "string" && sameSecret(sent, expected)) {
    return undefined;
  }
  return {
    statusCode: 401,
    body: {
      error: "KITCHEN_TOKEN_REQUIRED",
      message: expected
        ? "Restaurant routes need a Kitchen-Token header matching the service's KITCHEN_TOKEN"
        : "Restaurant routes are closed: start the service with KITCHEN_TOKEN set",
    },
  };
}

/** Compares digests so the comparison takes the same time whatever the input's length or content. */
function sameSecret(a: string, b: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

function expectedVersion(request: FastifyRequest): Result<number> {
  const header = request.headers["if-match"];
  if (header === undefined) {
    return {
      ok: false,
      problem: {
        statusCode: 428,
        body: {
          error: "PRECONDITION_REQUIRED",
          message: "Send If-Match with the order version you are editing",
        },
      },
    };
  }
  const match = /^"?(\d{1,9})"?$/.exec(String(header));
  if (!match)
    return badRequest(
      "INVALID_REQUEST",
      "If-Match must be the order version, e.g. 3",
    );
  return { ok: true, value: Number(match[1]) };
}

function view(order: StoredOrder, schedule: KitchenSchedule) {
  const next = nextStep(order, schedule);
  return {
    id: order.id,
    status: order.status,
    statusLabel: STATUS_LABELS[order.status],
    version: order.version,
    description: order.description,
    order: order.input,
    quote: order.quote,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    nextStatus: next?.status ?? null,
    nextStatusAt: next?.at.toISOString() ?? null,
  };
}

function refused(
  { code, message }: Refusal,
  order: ReturnType<typeof view>,
): Problem {
  return {
    statusCode: 409,
    body: { error: code, message, order },
  };
}

function notFound(id: string): Problem {
  return {
    statusCode: 404,
    body: { error: "ORDER_NOT_FOUND", message: `No order with id ${id}` },
  };
}

function invalidOrder(errors: FieldError[]): Result<never> {
  return {
    ok: false,
    problem: {
      statusCode: 400,
      body: {
        error: "INVALID_ORDER",
        message: errors.map((e) => e.message).join("; "),
        errors,
      },
    },
  };
}

function badRequest(error: string, message: string): Result<never> {
  return { ok: false, problem: { statusCode: 400, body: { error, message } } };
}

function send(reply: FastifyReply, problem: Problem) {
  return reply.code(problem.statusCode).send(problem.body);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
