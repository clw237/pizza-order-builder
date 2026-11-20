import type { OrderInput, Quote } from "@pizza/pricing";
import type { OrderStatus, Refusal, Transition } from "./lifecycle";

export interface StoredOrder {
  id: string;
  status: OrderStatus;
  version: number;
  input: OrderInput;
  quote: Quote;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export type TransitionOutcome =
  | { kind: "applied"; order: StoredOrder }
  | { kind: "refused"; refusal: Refusal; order: StoredOrder }
  | { kind: "not-found" };

export interface StoredResponse {
  fingerprint: string;
  statusCode: number;
  body: unknown;
}

/**
 * In-memory storage. Every method is synchronous, and route handlers never await between reading
 * an order and writing it back, so each check-and-set runs without another request in between.
 */
export class OrderStore {
  private readonly orders = new Map<string, StoredOrder>();
  private readonly responses = new Map<string, StoredResponse>();

  get(id: string): StoredOrder | undefined {
    return this.orders.get(id);
  }

  list(): StoredOrder[] {
    return [...this.orders.values()];
  }

  save(order: StoredOrder): void {
    this.orders.set(order.id, order);
  }

  /**
   * The one place an order's status changes, used by the HTTP routes and the kitchen timer.
   * Reading, checking and saving happen in one synchronous step.
   */
  transition(
    id: string,
    step: (status: OrderStatus) => Transition,
    now: Date,
  ): TransitionOutcome {
    const current = this.orders.get(id);
    if (!current) return { kind: "not-found" };
    const result = step(current.status);
    if (!result.ok) return { kind: "refused", refusal: result, order: current };
    if (result.status === current.status)
      return { kind: "applied", order: current };
    const updated = {
      ...current,
      status: result.status,
      updatedAt: now.toISOString(),
    };
    this.orders.set(id, updated);
    return { kind: "applied", order: updated };
  }

  getResponse(key: string): StoredResponse | undefined {
    return this.responses.get(key);
  }

  saveResponse(key: string, response: StoredResponse): void {
    this.responses.set(key, response);
  }
}
