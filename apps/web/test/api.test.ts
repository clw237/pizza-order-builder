import { describe, expect, it } from "vitest";
import { loseFirstResponse, sendWithRetry, type FetchLike } from "../src/api";

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
