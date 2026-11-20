import type { OrderInput } from "@pizza/pricing";
import { describe, expect, it } from "vitest";
import { autoAdvanceDue } from "../src/kitchen";
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
      tax: 33,
      tip: 0,
      total: 533,
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

    const advanced = autoAdvanceDue(
      store,
      30,
      new Date("2026-01-01T00:00:30.000Z"),
    );

    expect(advanced.sort()).toEqual(["old", "ready"]);
    expect(store.get("old")?.status).toBe("STARTED");
    expect(store.get("ready")?.status).toBe("DELIVERED");
    expect(store.get("fresh")?.status).toBe("NOT_STARTED");
    expect(store.get("cancelled")?.status).toBe("CANCELLED");
  });
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
