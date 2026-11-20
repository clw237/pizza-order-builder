export type OrderStatus =
  "NOT_STARTED" | "STARTED" | "READY_FOR_PICKUP" | "DELIVERED" | "CANCELLED";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  NOT_STARTED: "Not Started",
  STARTED: "Started",
  READY_FOR_PICKUP: "Ready for Pickup",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export type TransitionError =
  "ORDER_ALREADY_STARTED" | "ORDER_CANCELLED" | "ORDER_COMPLETE";

export type Transition =
  | { ok: true; status: OrderStatus }
  | { ok: false; code: TransitionError; message: string };

export type Refusal = Extract<Transition, { ok: false }>;

/** The kitchen's path. Cancelled and Delivered are terminal. */
const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  NOT_STARTED: "STARTED",
  STARTED: "READY_FOR_PICKUP",
  READY_FOR_PICKUP: "DELIVERED",
};

export function advance(status: OrderStatus): Transition {
  const next = NEXT[status];
  if (next) return { ok: true, status: next };
  return status === "CANCELLED"
    ? {
        ok: false,
        code: "ORDER_CANCELLED",
        message: "This order was cancelled",
      }
    : {
        ok: false,
        code: "ORDER_COMPLETE",
        message: "This order has already been delivered",
      };
}

/** Cancelling a cancelled order succeeds again, so a customer can safely retry. */
export function cancel(status: OrderStatus): Transition {
  if (status === "NOT_STARTED" || status === "CANCELLED")
    return { ok: true, status: "CANCELLED" };
  return alreadyStarted(status);
}

export function canEdit(status: OrderStatus): boolean {
  return status === "NOT_STARTED";
}

export function editRefusal(status: OrderStatus): Refusal {
  return status === "CANCELLED"
    ? {
        ok: false,
        code: "ORDER_CANCELLED",
        message: "This order was cancelled",
      }
    : alreadyStarted(status);
}

function alreadyStarted(status: OrderStatus): Refusal {
  return {
    ok: false,
    code: "ORDER_ALREADY_STARTED",
    message: `The kitchen has already started this order (status: ${STATUS_LABELS[status]})`,
  };
}
