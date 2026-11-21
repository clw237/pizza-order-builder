import { advance, type OrderStatus } from "./lifecycle";
import type { OrderStore, StoredOrder } from "./store";

/** The statuses the kitchen moves an order out of, in order. */
export type KitchenStep = "NOT_STARTED" | "STARTED" | "READY_FOR_PICKUP";

/** Seconds an order waits in each status before the timer moves it on. 0 leaves that step to the kitchen. */
export type KitchenSchedule = Record<KitchenStep, number>;

export const MANUAL_KITCHEN: KitchenSchedule = {
  NOT_STARTED: 0,
  STARTED: 0,
  READY_FOR_PICKUP: 0,
};

const DEFAULT_SECONDS = 20;
const MAX_SECONDS = 24 * 60 * 60;

const STEP_VARIABLES: Record<KitchenStep, string> = {
  NOT_STARTED: "KITCHEN_SECONDS_TO_START",
  STARTED: "KITCHEN_SECONDS_TO_READY",
  READY_FOR_PICKUP: "KITCHEN_SECONDS_TO_DELIVER",
};

type Env = Record<string, string | undefined>;

/**
 * Reads the schedule: each step's own variable, else KITCHEN_AUTO_ADVANCE_SECONDS, else 20.
 * An empty value counts as unset, so compose can pass a variable through without setting it.
 */
export function readSchedule(
  env: Env,
): { ok: true; schedule: KitchenSchedule } | { ok: false; message: string } {
  const shared = seconds(env, "KITCHEN_AUTO_ADVANCE_SECONDS", DEFAULT_SECONDS);
  if (!shared.ok) return shared;
  const schedule = { ...MANUAL_KITCHEN };
  for (const step of Object.keys(STEP_VARIABLES) as KitchenStep[]) {
    const value = seconds(env, STEP_VARIABLES[step], shared.value);
    if (!value.ok) return value;
    schedule[step] = value.value;
  }
  return { ok: true, schedule };
}

function seconds(
  env: Env,
  name: string,
  fallback: number,
): { ok: true; value: number } | { ok: false; message: string } {
  const raw = env[name];
  if (raw === undefined || raw === "") return { ok: true, value: fallback };
  if (!/^\d+$/.test(raw) || Number(raw) > MAX_SECONDS) {
    return {
      ok: false,
      message: `${name} must be a whole number of seconds from 0 to ${MAX_SECONDS} (0 = the kitchen moves it by hand), not "${raw}"`,
    };
  }
  return { ok: true, value: Number(raw) };
}

/** When the timer will move this order on, and to what. Undefined for a manual step or a final status. */
export function nextStep(
  order: Pick<StoredOrder, "status" | "updatedAt">,
  schedule: KitchenSchedule,
): { status: OrderStatus; at: Date } | undefined {
  if (!isKitchenStep(order.status)) return undefined;
  const delay = schedule[order.status];
  const step = advance(order.status);
  if (delay === 0 || !step.ok) return undefined;
  return {
    status: step.status,
    at: new Date(Date.parse(order.updatedAt) + delay * 1000),
  };
}

function isKitchenStep(status: OrderStatus): status is KitchenStep {
  return status in STEP_VARIABLES;
}

/**
 * Simulated kitchen: advances every order whose next step is due. An edit also restarts the
 * clock, since it updates the order. Returns the ids it advanced.
 */
export function autoAdvanceDue(
  store: OrderStore,
  schedule: KitchenSchedule,
  now: Date,
): string[] {
  const due = store.list().filter((order) => {
    const next = nextStep(order, schedule);
    return next !== undefined && next.at.getTime() <= now.getTime();
  });
  return due
    .map((order) => store.transition(order.id, advance, now))
    .flatMap((outcome) =>
      outcome.kind === "applied" ? [outcome.order.id] : [],
    );
}

export function isManual(schedule: KitchenSchedule): boolean {
  return Object.values(schedule).every((delay) => delay === 0);
}

export function startAutoAdvance(
  store: OrderStore,
  schedule: KitchenSchedule,
): () => void {
  const timer = setInterval(
    () => autoAdvanceDue(store, schedule, new Date()),
    1000,
  );
  return () => clearInterval(timer);
}
