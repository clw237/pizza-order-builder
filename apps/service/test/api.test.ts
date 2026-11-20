import { priceOrder, validateOrder, type OrderInput } from "@pizza/pricing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

type App = ReturnType<typeof buildApp>;

const largeBacon: OrderInput = {
  lines: [{ sizeId: "large", quantity: 1, toppingIds: ["bacon"] }],
  promoCodes: [],
  tip: { mode: "dollars", value: "" },
};

const twoMediums: OrderInput = {
  lines: [
    { sizeId: "medium", quantity: 2, toppingIds: ["pepperoni", "bacon"] },
  ],
  promoCodes: ["ILOVEPIZZA"],
  tip: { mode: "percent", value: "20" },
};

/** What the web app would show for this input, computed with the same shared function. */
function clientTotal(input: OrderInput): number {
  const result = validateOrder(input);
  if (!result.ok) throw new Error("fixture is invalid");
  return priceOrder(result.order).total;
}

function body(input: OrderInput, expectedTotalCents = clientTotal(input)) {
  return { order: input, expectedTotalCents };
}

let app: App;
let keyCounter = 0;
const newKey = () => `key-${++keyCounter}`;

const KITCHEN_TOKEN = "test-kitchen-token";
const kitchenHeaders = { "kitchen-token": KITCHEN_TOKEN };

beforeEach(() => {
  app = buildApp({ kitchenToken: KITCHEN_TOKEN });
});

afterEach(async () => {
  await app.close();
});

function submit(input: OrderInput, key = newKey(), expected?: number) {
  return app.inject({
    method: "POST",
    url: "/orders",
    headers: { "idempotency-key": key },
    payload: body(input, expected),
  });
}

async function created(input: OrderInput = largeBacon) {
  const res = await submit(input);
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string; version: number }>();
}

function update(
  id: string,
  input: OrderInput,
  version: number,
  key = newKey(),
) {
  return app.inject({
    method: "PUT",
    url: `/orders/${id}`,
    headers: { "idempotency-key": key, "if-match": String(version) },
    payload: body(input),
  });
}

const cancelOrder = (id: string) =>
  app.inject({ method: "POST", url: `/orders/${id}/cancel` });
const advanceOrder = (id: string) =>
  app.inject({
    method: "POST",
    url: `/orders/${id}/advance`,
    headers: kitchenHeaders,
  });
const listOrders = () =>
  app.inject({ method: "GET", url: "/orders", headers: kitchenHeaders });
const getOrder = (id: string) =>
  app.inject({ method: "GET", url: `/orders/${id}` });

describe("submitting an order", () => {
  it("S-1 returns an id, Not Started, version 1 and the server's quote", async () => {
    const res = await submit(largeBacon);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      id: expect.any(String),
      status: "NOT_STARTED",
      statusLabel: "Not Started",
      version: 1,
      description: "1 × Large pizza with bacon",
      quote: { subtotal: 1332, tax: 87, total: 1419 },
    });
  });

  it("RT-1 the charged quote equals the shared priceOrder result field by field", async () => {
    const res = await submit(twoMediums);
    const result = validateOrder(twoMediums);
    if (!result.ok) throw new Error("fixture is invalid");
    expect(res.json().quote).toEqual(priceOrder(result.order));
    expect(res.json().quote.total).toBe(1915);
  });

  it("RT-2 a mismatched expected total is rejected with the server quote and nothing is stored", async () => {
    const res = await submit(largeBacon, newKey(), 1);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({
      error: "PRICE_MISMATCH",
      quote: { total: 1419 },
    });
    expect((await listOrders()).json()).toHaveLength(0);
  });

  it("S-2 a retry with the same key and body returns the same order, stored once", async () => {
    const first = await submit(largeBacon, "retry-1");
    const retry = await submit(largeBacon, "retry-1");
    expect(retry.statusCode).toBe(201);
    expect(retry.json()).toEqual(first.json());
    expect((await listOrders()).json()).toHaveLength(1);
  });

  it("S-3 the same key with a different body is rejected", async () => {
    await submit(largeBacon, "reused");
    const res = await submit(twoMediums, "reused");
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("S-4 a submission without an Idempotency-Key is rejected", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/orders",
      payload: body(largeBacon),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/Idempotency-Key/);
  });

  it("S-15 invalid input returns field messages and stores nothing", async () => {
    const res = await submit(
      {
        ...largeBacon,
        lines: [{ sizeId: "huge", quantity: 0, toppingIds: [] }],
      },
      newKey(),
      0,
    );
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: "INVALID_ORDER",
      errors: [{ path: "lines.0.quantity", message: expect.any(String) }],
    });
  });

  it("S-16 price fields from the client are rejected", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/orders",
      headers: { "idempotency-key": newKey() },
      payload: { order: { ...largeBacon, total: 1 }, expectedTotalCents: 1 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects malformed JSON with the same error shape", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/orders",
      headers: {
        "idempotency-key": newKey(),
        "content-type": "application/json",
      },
      payload: "{not json",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "BAD_REQUEST" });
  });
});

describe("reading an order", () => {
  it("S-5 an unknown id is 404", async () => {
    expect((await getOrder("nope")).statusCode).toBe(404);
  });

  it("S-11 status follows the kitchen", async () => {
    const { id } = await created();
    await advanceOrder(id);
    expect((await getOrder(id)).json()).toMatchObject({
      status: "STARTED",
      statusLabel: "Started",
    });
  });
});

describe("updating an order", () => {
  it("S-6 a Not Started order with the current version is updated and repriced", async () => {
    const { id } = await created();
    const res = await update(id, twoMediums, 1);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ version: 2, quote: { total: 1915 } });
  });

  it("S-7 a stale version is rejected with the current order", async () => {
    const { id } = await created();
    await update(id, twoMediums, 1);
    const res = await update(id, largeBacon, 1);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({
      error: "VERSION_CONFLICT",
      order: { version: 2 },
    });
  });

  it("S-8 a retried update with the same key is applied once", async () => {
    const { id } = await created();
    const first = await update(id, twoMediums, 1, "put-retry");
    const retry = await update(id, twoMediums, 1, "put-retry");
    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toEqual(first.json());
    expect((await getOrder(id)).json().version).toBe(2);
  });

  it("S-7 an update without If-Match is rejected", async () => {
    const { id } = await created();
    const res = await app.inject({
      method: "PUT",
      url: `/orders/${id}`,
      headers: { "idempotency-key": newKey() },
      payload: body(twoMediums),
    });
    expect(res.statusCode).toBe(428);
  });

  it("S-9 an order the kitchen has started can't be updated or cancelled", async () => {
    const { id } = await created();
    await advanceOrder(id);
    const put = await update(id, twoMediums, 1);
    expect(put.statusCode).toBe(409);
    expect(put.json()).toMatchObject({
      error: "ORDER_ALREADY_STARTED",
      order: { status: "STARTED" },
    });
    expect((await cancelOrder(id)).statusCode).toBe(409);
  });
});

describe("cancelling and advancing", () => {
  it("S-10 cancel is idempotent", async () => {
    const { id } = await created();
    const first = await cancelOrder(id);
    const again = await cancelOrder(id);
    expect([first.statusCode, again.statusCode]).toEqual([200, 200]);
    expect(again.json()).toEqual(first.json());
    expect(first.json().status).toBe("CANCELLED");
  });

  it("S-11 / S-12 advance walks to Delivered and then stops", async () => {
    const { id } = await created();
    const statuses = [];
    for (let i = 0; i < 3; i++)
      statuses.push((await advanceOrder(id)).json().status);
    expect(statuses).toEqual(["STARTED", "READY_FOR_PICKUP", "DELIVERED"]);
    expect((await advanceOrder(id)).statusCode).toBe(409);
  });

  it("S-12 a cancelled order can't advance", async () => {
    const { id } = await created();
    await cancelOrder(id);
    expect((await advanceOrder(id)).statusCode).toBe(409);
  });
});

describe("races between the customer and the kitchen", () => {
  it("S-13 cancel vs. start: exactly one wins, 100 times", async () => {
    for (let i = 0; i < 100; i++) {
      const { id } = await created();
      const [c, a] = await Promise.all([cancelOrder(id), advanceOrder(id)]);
      const final = (await getOrder(id)).json().status;
      expect([c.statusCode, a.statusCode].sort()).toEqual([200, 409]);
      expect(final).toBe(c.statusCode === 200 ? "CANCELLED" : "STARTED");
    }
  });

  it("S-14 update vs. start: a started order is never edited, 100 times", async () => {
    for (let i = 0; i < 100; i++) {
      const { id } = await created();
      const [u, a] = await Promise.all([
        update(id, twoMediums, 1),
        advanceOrder(id),
      ]);
      const final = (await getOrder(id)).json();
      expect(a.statusCode).toBe(200);
      expect(final.status).toBe("STARTED");
      // Either the edit landed before the kitchen started, or it was refused.
      expect(final.version).toBe(u.statusCode === 200 ? 2 : 1);
      if (u.statusCode !== 200) expect(u.statusCode).toBe(409);
    }
  });
});

describe("K-3 restaurant routes need the kitchen token", () => {
  const restaurantRoutes = [
    ["GET", "/orders"],
    ["POST", "/orders/:id/advance"],
  ] as const;

  async function call(
    method: "GET" | "POST",
    route: string,
    headers: Record<string, string>,
  ) {
    const { id } = await created();
    return app.inject({ method, url: route.replace(":id", id), headers });
  }

  it.each(restaurantRoutes)(
    "K-3 %s %s without a token is 401",
    async (method, route) => {
      const res = await call(method, route, {});
      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({ error: "KITCHEN_TOKEN_REQUIRED" });
    },
  );

  it.each(restaurantRoutes)(
    "K-3 %s %s with a wrong token is 401",
    async (method, route) => {
      const res = await call(method, route, { "kitchen-token": "wrong" });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({ error: "KITCHEN_TOKEN_REQUIRED" });
    },
  );

  it.each(restaurantRoutes)(
    "K-3 %s %s with the right token succeeds",
    async (method, route) => {
      const res = await call(method, route, kitchenHeaders);
      expect(res.statusCode).toBe(200);
    },
  );

  it("K-3 a refused kitchen call changes nothing", async () => {
    const { id } = await created();
    await app.inject({ method: "POST", url: `/orders/${id}/advance` });
    expect((await getOrder(id)).json()).toMatchObject({
      status: "NOT_STARTED",
    });
  });

  it("K-3 with no token configured, restaurant routes are closed", async () => {
    const unconfigured = buildApp();
    try {
      const res = await unconfigured.inject({
        method: "GET",
        url: "/orders",
        headers: { "kitchen-token": "" },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().message).toMatch(/KITCHEN_TOKEN/);
    } finally {
      await unconfigured.close();
    }
  });

  it("K-3 customer routes don't need the token", async () => {
    const { id } = await created();
    expect((await getOrder(id)).statusCode).toBe(200);
    expect((await cancelOrder(id)).statusCode).toBe(200);
  });
});
