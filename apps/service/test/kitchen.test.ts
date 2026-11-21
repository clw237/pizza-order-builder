import type { OrderInput } from "@pizza/pricing";
import { describe, expect, it } from "vitest";
import {
  autoAdvanceDue,
  nextStep,
  readSchedule,
  type KitchenSchedule,
} from "../src/kitchen";
import type { OrderStatus } from "../src/lifecycle";
import { OrderStore, type StoredOrder } from "../src/store";

const input: OrderInput = {
  lines: [{ sizeId: "small", quantity: 1, toppingIds: [] }],
  promoCodes: [],
  tip: { mode: "dollars", value: "" },
};

function stored(
  id: string,
  status: OrderStatus,
  updatedAt: string,
): StoredOrder {
  return {
    id,
    status,
    version: 1,
    input,
    quote: {
      lines: [],
      subtotal: 500,
      appliedPromos: [],
      promoNotices: [],
      discount: 0,
      tax: 32,
      tip: 0,
      total: 532,
    },
    description: "1 × Small pizza, no toppings",
    createdAt: updatedAt,
    updatedAt,
  };
}

describe("K-2 kitchen auto-advance timer", () => {
  it("advances only orders whose status has been unchanged for the delay", () => {
    const store = new OrderStore();
    store.save(stored("old", "NOT_STARTED", "2026-01-01T00:00:00.000Z"));
    store.save(stored("fresh", "NOT_STARTED", "2026-01-01T00:00:25.000Z"));
    store.save(stored("ready", "READY_FOR_PICKUP", "2026-01-01T00:00:00.000Z"));
    store.save(stored("done", "DELIVERED", "2026-01-01T00:00:00.000Z"));
    store.save(stored("cancelled", "CANCELLED", "2026-01-01T00:00:00.000Z"));

    const everyStep30s: KitchenSchedule = {
      NOT_STARTED: 30,
      STARTED: 30,
      READY_FOR_PICKUP: 30,
    };
    const advanced = autoAdvanceDue(
      store,
      everyStep30s,
      new Date("2026-01-01T00:00:30.000Z"),
    );

    expect(advanced.sort()).toEqual(["old", "ready"]);
    expect(store.get("old")?.status).toBe("STARTED");
    expect(store.get("ready")?.status).toBe("DELIVERED");
    expect(store.get("fresh")?.status).toBe("NOT_STARTED");
    expect(store.get("cancelled")?.status).toBe("CANCELLED");
  });
});

describe("K-4 per-step kitchen timings", () => {
  const schedule: KitchenSchedule = {
    NOT_STARTED: 10,
    STARTED: 60,
    READY_FOR_PICKUP: 0,
  };
  const start = "2026-01-01T00:00:00.000Z";

  it("each status waits for its own delay, and 0 leaves that step to the kitchen", () => {
    const store = new OrderStore();
    store.save(stored("waiting", "NOT_STARTED", start));
    store.save(stored("cooking", "STARTED", start));
    store.save(stored("ready", "READY_FOR_PICKUP", start));

    const advanced = autoAdvanceDue(
      store,
      schedule,
      new Date("2026-01-01T00:00:59.000Z"),
    );

    expect(advanced).toEqual(["waiting"]);
    expect(store.get("cooking")?.status).toBe("STARTED");
    expect(store.get("ready")?.status).toBe("READY_FOR_PICKUP");
  });

  it("nextStep says which status comes next and when", () => {
    expect(nextStep(stored("a", "STARTED", start), schedule)).toEqual({
      status: "READY_FOR_PICKUP",
      at: new Date("2026-01-01T00:01:00.000Z"),
    });
  });

  it("nextStep is undefined for a manual step and for final statuses", () => {
    expect(nextStep(stored("a", "READY_FOR_PICKUP", start), schedule)).toBe(
      undefined,
    );
    expect(nextStep(stored("b", "DELIVERED", start), schedule)).toBe(undefined);
    expect(nextStep(stored("c", "CANCELLED", start), schedule)).toBe(undefined);
  });
});

describe("K-4 reading the kitchen schedule from the environment", () => {
  it("defaults to 20 seconds for every step", () => {
    expect(readSchedule({})).toEqual({
      ok: true,
      schedule: { NOT_STARTED: 20, STARTED: 20, READY_FOR_PICKUP: 20 },
    });
  });

  it("KITCHEN_AUTO_ADVANCE_SECONDS sets every step, and 0 turns the timer off", () => {
    expect(readSchedule({ KITCHEN_AUTO_ADVANCE_SECONDS: "0" })).toEqual({
      ok: true,
      schedule: { NOT_STARTED: 0, STARTED: 0, READY_FOR_PICKUP: 0 },
    });
  });

  it("per-step variables override the shared value, and empty means unset", () => {
    expect(
      readSchedule({
        KITCHEN_AUTO_ADVANCE_SECONDS: "5",
        KITCHEN_SECONDS_TO_START: "30",
        KITCHEN_SECONDS_TO_READY: "",
        KITCHEN_SECONDS_TO_DELIVER: "0",
      }),
    ).toEqual({
      ok: true,
      schedule: { NOT_STARTED: 30, STARTED: 5, READY_FOR_PICKUP: 0 },
    });
  });

  it.each(["-1", "1.5", "abc", "1e3", "100000"])(
    "rejects %s with a message naming the variable",
    (value) => {
      const result = readSchedule({ KITCHEN_SECONDS_TO_READY: value });
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.message).toMatch(/KITCHEN_SECONDS_TO_READY/);
    },
  );
});

describe("store transitions", () => {
  it("S-12 a refused transition leaves the order unchanged", () => {
    const store = new OrderStore();
    store.save(stored("done", "DELIVERED", "2026-01-01T00:00:00.000Z"));
    const outcome = store.transition(
      "done",
      (s) =>
        s === "DELIVERED"
          ? { ok: false, code: "ORDER_COMPLETE", message: "done" }
          : { ok: true, status: s },
      new Date(),
    );
    expect(outcome).toMatchObject({ kind: "refused" });
    expect(store.get("done")?.updatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("S-5 an unknown id is reported as not found", () => {
    expect(
      new OrderStore().transition(
        "nope",
        () => ({ ok: true, status: "STARTED" }),
        new Date(),
      ),
    ).toEqual({
      kind: "not-found",
    });
  });
});
