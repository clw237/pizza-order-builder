import type { OrderInput, OrderStatus, Quote } from "@pizza/pricing";

/** The order as the service returns it. */
export interface OrderView {
  id: string;
  status: OrderStatus;
  statusLabel: string;
  version: number;
  description: string;
  order: OrderInput;
  quote: Quote;
  createdAt: string;
  updatedAt: string;
  /** Set when the kitchen timer will move the order on; null for a manual step or a final status. */
  nextStatus: OrderView["status"] | null;
  nextStatusAt: string | null;
}

export interface ApiProblem {
  error: string;
  message: string;
  order?: OrderView;
  quote?: Quote;
}

export type ApiResult =
  | { ok: true; order: OrderView }
  | { ok: false; status: number; problem: ApiProblem };

/**
 * The copy of the order to show after a background fetch. A slow poll can arrive after a newer
 * copy from the customer's own cancel or edit; keeping the newer one (by updatedAt, which every
 * change moves forward) stops the screen, and the next If-Match, going back in time.
 */
export function latest(
  current: OrderView | null,
  incoming: OrderView,
): OrderView {
  if (!current || current.id !== incoming.id) return incoming;
  return incoming.updatedAt < current.updatedAt ? current : incoming;
}

/**
 * True once the service has given a definite answer. A 5xx (after the last retry) is not one:
 * the order may or may not exist, so the next Send must reuse the same Idempotency-Key.
 */
export function isSettled(result: ApiResult): boolean {
  return result.ok || result.status < 500;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface RetryOptions {
  attempts: number;
  timeoutMs: number;
  backoffMs: number;
}

const DEFAULT_RETRY: RetryOptions = {
  attempts: 4,
  timeoutMs: 5000,
  backoffMs: 400,
};

/**
 * Sends a request, retrying timeouts, network errors and 5xx responses with backoff. The caller
 * puts the Idempotency-Key in `init`, so every retry carries the same key.
 */
export async function sendWithRetry(
  fetchFn: FetchLike,
  url: string,
  init: RequestInit,
  options: RetryOptions = DEFAULT_RETRY,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    try {
      const response = await fetchFn(url, {
        ...init,
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      if (response.status < 500 || attempt === options.attempts)
        return response;
    } catch (error) {
      lastError = error;
    }
    if (attempt < options.attempts)
      await sleep(options.backoffMs * 2 ** (attempt - 1));
  }
  const reason =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(unreachable(reason));
}

function unreachable(reason: string): string {
  return `Couldn't reach the restaurant (${reason}). If you submitted, trying again is safe: it won't create a second order.`;
}

/**
 * Reads the error body. A reply that isn't JSON came from something in front of the service,
 * like the dev proxy answering 502 with an empty body while the service is down.
 */
async function readProblem(response: Response): Promise<ApiProblem> {
  const parsed = parseJson(await response.text());
  if (isProblem(parsed)) return parsed;
  const reason = `HTTP ${response.status}`;
  return {
    error: "UNEXPECTED_RESPONSE",
    message:
      response.status >= 500
        ? unreachable(reason)
        : `The restaurant sent a reply we couldn't read (${reason}).`,
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isProblem(value: unknown): value is ApiProblem {
  if (typeof value !== "object" || value === null) return false;
  const { error, message } = value as Record<string, unknown>;
  return typeof error === "string" && typeof message === "string";
}

/**
 * Why the customer's edit can no longer be saved, judging by the latest copy of the order, or
 * null while it still can.
 */
export function editClosedReason(
  editing: boolean,
  order: OrderView | null,
): string | null {
  if (!editing || !order || order.status === "NOT_STARTED") return null;
  return order.status === "CANCELLED"
    ? "Your order was cancelled, so it can't be changed now."
    : "The kitchen started your order, so it can't be changed now.";
}

/**
 * Demo of a lost response: the first request reaches the service, but its reply is thrown away
 * as if the phone lost signal. Turned on with `?flaky` in the page URL.
 */
export function loseFirstResponse(fetchFn: FetchLike): FetchLike {
  let lost = false;
  return async (url, init) => {
    const response = await fetchFn(url, init);
    if (lost) return response;
    lost = true;
    throw new DOMException(
      "simulated timeout: the response was lost",
      "TimeoutError",
    );
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createApi(fetchFn: FetchLike, base = "/api") {
  async function call(path: string, init: RequestInit): Promise<ApiResult> {
    const response = await sendWithRetry(fetchFn, `${base}${path}`, init);
    if (response.ok)
      return { ok: true, order: (await response.json()) as OrderView };
    return {
      ok: false,
      status: response.status,
      problem: await readProblem(response),
    };
  }

  const json = (headers: Record<string, string>) => ({
    "content-type": "application/json",
    ...headers,
  });

  return {
    submit: (
      order: OrderInput,
      expectedTotalCents: number,
      idempotencyKey: string,
    ) =>
      call("/orders", {
        method: "POST",
        headers: json({ "idempotency-key": idempotencyKey }),
        body: JSON.stringify({ order, expectedTotalCents }),
      }),
    update: (
      id: string,
      version: number,
      order: OrderInput,
      expectedTotalCents: number,
      idempotencyKey: string,
    ) =>
      call(`/orders/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: json({
          "idempotency-key": idempotencyKey,
          "if-match": String(version),
        }),
        body: JSON.stringify({ order, expectedTotalCents }),
      }),
    get: (id: string) =>
      call(`/orders/${encodeURIComponent(id)}`, { method: "GET" }),
    cancel: (id: string, idempotencyKey: string) =>
      call(`/orders/${encodeURIComponent(id)}/cancel`, {
        method: "POST",
        headers: { "idempotency-key": idempotencyKey },
      }),
  };
}

export type Api = ReturnType<typeof createApi>;
