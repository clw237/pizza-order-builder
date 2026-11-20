import { describe, expect, it } from "vitest";
import { advance, cancel, canEdit, type OrderStatus } from "../src/lifecycle";

describe("order state machine", () => {
  it("S-11 advance moves one step at a time to Delivered", () => {
    expect(advance("NOT_STARTED")).toEqual({ ok: true, status: "STARTED" });
    expect(advance("STARTED")).toEqual({
      ok: true,
      status: "READY_FOR_PICKUP",
    });
    expect(advance("READY_FOR_PICKUP")).toEqual({
      ok: true,
      status: "DELIVERED",
    });
  });

  it.each<OrderStatus>(["DELIVERED", "CANCELLED"])(
    "S-12 %s can't advance",
    (status) => {
      expect(advance(status).ok).toBe(false);
    },
  );

  it("S-10 cancel works only from Not Started and is idempotent once cancelled", () => {
    expect(cancel("NOT_STARTED")).toEqual({ ok: true, status: "CANCELLED" });
    expect(cancel("CANCELLED")).toEqual({ ok: true, status: "CANCELLED" });
  });

  it.each<OrderStatus>(["STARTED", "READY_FOR_PICKUP", "DELIVERED"])(
    "S-9 %s can't be cancelled",
    (status) => {
      expect(cancel(status)).toMatchObject({
        ok: false,
        code: "ORDER_ALREADY_STARTED",
      });
    },
  );

  it("S-9 only a Not Started order can be edited", () => {
    const editable = (
      [
        "NOT_STARTED",
        "STARTED",
        "READY_FOR_PICKUP",
        "DELIVERED",
        "CANCELLED",
      ] as const
    ).filter(canEdit);
    expect(editable).toEqual(["NOT_STARTED"]);
  });
});
