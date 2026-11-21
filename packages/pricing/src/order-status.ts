/**
 * An order's place in the kitchen's lifecycle, and the label a customer sees for it. Shared so
 * the service and the builder can't drift apart; the rules for moving between statuses live in
 * the service.
 */
export type OrderStatus =
  "NOT_STARTED" | "STARTED" | "READY_FOR_PICKUP" | "DELIVERED" | "CANCELLED";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  NOT_STARTED: "Not Started",
  STARTED: "Started",
  READY_FOR_PICKUP: "Ready for Pickup",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};
