import { advance } from "./lifecycle";
import type { OrderStore } from "./store";

/**
 * Simulated kitchen: advances every order whose status hasn't changed for `delaySeconds`.
 * An edit also resets the clock, since it updates the order. Returns the ids it advanced.
 */
export function autoAdvanceDue(
  store: OrderStore,
  delaySeconds: number,
  now: Date,
): string[] {
  const due = store
    .list()
    .filter(
      (order) =>
        now.getTime() - Date.parse(order.updatedAt) >= delaySeconds * 1000,
    );
  return due
    .map((order) => store.transition(order.id, advance, now))
    .flatMap((outcome) =>
      outcome.kind === "applied" ? [outcome.order.id] : [],
    );
}

export function startAutoAdvance(
  store: OrderStore,
  delaySeconds: number,
): () => void {
  const timer = setInterval(
    () => autoAdvanceDue(store, delaySeconds, new Date()),
    1000,
  );
  return () => clearInterval(timer);
}
