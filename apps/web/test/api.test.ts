import { describe, expect, it } from "vitest";
import {
  createApi,
  isSettled,
  latest,
  loseFirstResponse,
  sendWithRetry,
  type FetchLike,
  type OrderView,
} from "../src/api";

const ok = () => new Response(JSON.stringify({ id: "a" }), { status: 201 });
const noWait = { attempts: 3, timeoutMs: 50, backoffMs: 0 };

function recorder(responses: (() => Response | Promise<Response>)[]) {
  const calls: RequestInit[] = [];
  const fetchFn: FetchLike = async (_url, init) => {
    calls.push(init ?? {});
    const next = responses[calls.length - 1];
    if (!next) throw new Error("no more responses");
    return next();
  };
  return { calls, fetchFn };
}

const timeout = () => {
  throw new DOMException("timed out", "TimeoutError");
};

describe("S-17 submit retries on an unreliable connection", () => {
  it("retries after a timeout with the same Idempotency-Key", async () => {
    const { calls, fetchFn } = recorder([timeout, ok]);
    const res = await sendWithRetry(
      fetchFn,
      "/api/orders",
      { headers: { "idempotency-key": "k1" } },
      noWait,
    );
    expect(res.status).toBe(201);
    expect(
      calls.map((c) => new Headers(c.headers).get("idempotency-key")),
    ).toEqual(["k1", "k1"]);
  });

  it("retries a 5xx but not a 4xx", async () => {
    const server = recorder([() => new Response("", { status: 503 }), ok]);
    expect((await sendWithRetry(server.fetchFn, "/x", {}, noWait)).status).toBe(
      201,
    );

    const client = recorder([() => new Response("", { status: 409 }), ok]);
    expect((await sendWithRetry(client.fetchFn, "/x", {}, noWait)).status).toBe(
      409,
    );
    expect(client.calls).toHaveLength(1);
  });

  it("flaky mode loses the first response after the server handled it, then retries", async () => {
    const { calls, fetchFn } = recorder([ok, ok]);
    const res = await sendWithRetry(
      loseFirstResponse(fetchFn),
      "/x",
      {},
      noWait,
    );
    expect(res.status).toBe(201);
    expect(calls).toHaveLength(2);
  });

  it("gives up after the last attempt and reports a network problem", async () => {
    const { calls, fetchFn } = recorder([timeout, timeout, timeout]);
    await expect(sendWithRetry(fetchFn, "/x", {}, noWait)).rejects.toThrow(
      /timed out/,
    );
    expect(calls).toHaveLength(3);
  });
});

describe("S-17 keeping the Idempotency-Key until the outcome is known", () => {
  const problem = { error: "X", message: "x" };

  it("a success or a 4xx is final, so the next Send may use a new key", () => {
    expect(isSettled({ ok: true, order: {} as OrderView })).toBe(true);
    expect(isSettled({ ok: false, status: 409, problem })).toBe(true);
  });

  it("a 5xx after the last retry is not final, so the next Send reuses the key", () => {
    expect(isSettled({ ok: false, status: 503, problem })).toBe(false);
  });
});

describe("background refreshes never undo a newer copy of the order", () => {
  const at = (updatedAt: string) => ({ id: "a", updatedAt }) as OrderView;
  const older = at("2026-01-01T12:00:00.000Z");
  const newer = at("2026-01-01T12:00:05.000Z");

  it("keeps the current order when the fetched copy is older", () => {
    expect(latest(newer, older)).toBe(newer);
  });

  it("takes the fetched copy when it is newer or the same age", () => {
    expect(latest(older, newer)).toBe(newer);
    const same = at("2026-01-01T12:00:00.000Z");
    expect(latest(older, same)).toBe(same);
  });

  it("takes the fetched copy when nothing is shown or it is a different order", () => {
    expect(latest(null, older)).toBe(older);
    expect(latest(newer, { ...older, id: "b" })).toEqual({ ...older, id: "b" });
  });
});

describe("S-20 cancel can't be sent as a cross-site simple request", () => {
  it("sends the caller's Idempotency-Key with the cancel", async () => {
    const { calls, fetchFn } = recorder([ok]);
    await createApi(fetchFn).cancel("order-1", "cancel-key");
    expect(new Headers(calls[0]!.headers).get("idempotency-key")).toBe(
      "cancel-key",
    );
    expect(calls[0]!.method).toBe("POST");
  });
});
