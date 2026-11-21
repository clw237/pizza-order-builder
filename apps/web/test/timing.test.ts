import { describe, expect, it } from "vitest";
import { describeNextStep } from "../src/timing";

const now = new Date("2026-01-01T12:00:00.000Z");

describe("K-5 the builder says when the order moves on", () => {
  it("counts down whole seconds, rounding up", () => {
    expect(
      describeNextStep(
        { nextStatus: "STARTED", nextStatusAt: "2026-01-01T12:00:11.200Z" },
        now,
      ),
    ).toBe("Started in about 12s");
  });

  it("uses the next status's label", () => {
    expect(
      describeNextStep(
        {
          nextStatus: "READY_FOR_PICKUP",
          nextStatusAt: "2026-01-01T12:01:00.000Z",
        },
        now,
      ),
    ).toBe("Ready for Pickup in about 60s");
  });

  it("says any moment now once the time has passed", () => {
    expect(
      describeNextStep(
        { nextStatus: "DELIVERED", nextStatusAt: "2026-01-01T11:59:58.000Z" },
        now,
      ),
    ).toBe("Delivered any moment now");
  });

  it("says nothing when the next step is up to the kitchen or the order is final", () => {
    expect(
      describeNextStep({ nextStatus: null, nextStatusAt: null }, now),
    ).toBe(null);
  });
});
