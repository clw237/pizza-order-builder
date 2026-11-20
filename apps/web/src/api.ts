import type { OrderInput, Quote } from "@pizza/pricing";

/** The order as the service returns it. */
export interface OrderView {
  id: string;
  status:
    "NOT_STARTED" | "STARTED" | "READY_FOR_PICKUP" | "DELIVERED" | "CANCELLED";
  statusLabel: string;
  version: number;
  description: string;
  order: OrderInput;
  quote: Quote;
  createdAt: string;
  updatedAt: string;
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
  throw new Error(
    `Couldn't reach the restaurant (${reason}). If you submitted, trying again is safe: it won't create a second order.`,
  );
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
    const body: unknown = await response.json();
    if (response.ok) return { ok: true, order: body as OrderView };
    return { ok: false, status: response.status, problem: body as ApiProblem };
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
    cancel: (id: string) =>
      call(`/orders/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
  };
}

export type Api = ReturnType<typeof createApi>;
