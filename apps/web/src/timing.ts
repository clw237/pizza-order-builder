import { STATUS_LABELS } from "@pizza/pricing";
import type { OrderView } from "./api";

/**
 * "Started in about 12s" from the service's next-step time, or null when the next step is up to
 * the kitchen or the order is final. Compares with the browser's clock, so it is an estimate.
 */
export function describeNextStep(
  order: Pick<OrderView, "nextStatus" | "nextStatusAt">,
  now: Date,
): string | null {
  if (!order.nextStatus || !order.nextStatusAt) return null;
  const label = STATUS_LABELS[order.nextStatus];
  const seconds = Math.ceil(
    (Date.parse(order.nextStatusAt) - now.getTime()) / 1000,
  );
  return seconds > 0
    ? `${label} in about ${seconds}s`
    : `${label} any moment now`;
}
