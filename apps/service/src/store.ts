import type { OrderInput, Quote } from "@pizza/pricing";
import type { OrderStatus } from "./lifecycle";

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

  getResponse(key: string): StoredResponse | undefined {
    return this.responses.get(key);
  }

  saveResponse(key: string, response: StoredResponse): void {
    this.responses.set(key, response);
  }
}
