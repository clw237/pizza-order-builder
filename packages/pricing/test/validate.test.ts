import { describe, expect, it } from "vitest";
import { parseTip, validateOrder, type OrderInput } from "../src";

const valid: OrderInput = {
  lines: [{ sizeId: "large", quantity: 1, toppingIds: ["bacon"] }],
  promoCodes: [],
  tip: { mode: "dollars", value: "" },
};

function withLine(patch: Record<string, unknown>): unknown {
  return { ...valid, lines: [{ ...valid.lines[0], ...patch }] };
}

function errorsOf(input: unknown): string[] {
  const result = validateOrder(input);
  return result.ok ? [] : result.errors.map((e) => `${e.path}: ${e.message}`);
}

describe("R4 tip parsing", () => {
  it.each([
    ["dollars", "3.50", { mode: "dollars", cents: 350 }],
    ["dollars", "3", { mode: "dollars", cents: 300 }],
    ["dollars", "0.05", { mode: "dollars", cents: 5 }],
    ["percent", "15", { mode: "percent", rate: 1500 }],
    ["percent", "12.5", { mode: "percent", rate: 1250 }],
    ["percent", "100", { mode: "percent", rate: 10000 }],
  ] as const)("T-1/T-2 %s %s parses exactly", (mode, value, tip) => {
    expect(parseTip(mode, value)).toEqual({ ok: true, tip });
  });

  it.each(["dollars", "percent"] as const)(
    "T-4 empty %s tip is zero",
    (mode) => {
      expect(parseTip(mode, "  ")).toMatchObject({ ok: true });
    },
  );

  it.each([
    ["dollars", "-1"],
    ["dollars", "abc"],
    ["dollars", "3.505"],
    ["dollars", "1e3"],
    ["dollars", "10000"],
    ["percent", "101"],
    ["percent", "NaN"],
  ] as const)(
    "T-5 %s tip %s is rejected with a clear message",
    (mode, value) => {
      const result = parseTip(mode, value);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/^Tip/);
    },
  );
});

describe("order validation", () => {
  it("accepts a valid order and returns the domain order", () => {
    expect(validateOrder(valid)).toEqual({
      ok: true,
      order: {
        lines: [{ sizeId: "large", quantity: 1, toppingIds: ["bacon"] }],
        promoCodes: [],
        tip: { mode: "dollars", cents: 0 },
      },
    });
  });

  it("OB-2 an order needs at least one pizza", () => {
    expect(errorsOf({ ...valid, lines: [] })).toEqual([
      "lines: Add at least one pizza",
    ]);
  });

  it.each([0, -1, 1.5, 100, "abc"])(
    "OB-3 quantity %s is rejected",
    (quantity) => {
      expect(errorsOf(withLine({ quantity }))).toEqual([
        "lines.0.quantity: Quantity must be a whole number from 1 to 99",
      ]);
    },
  );

  it("OB-4 the same topping twice on one pizza is rejected", () => {
    expect(errorsOf(withLine({ toppingIds: ["bacon", "bacon"] }))).toEqual([
      "lines.0.toppingIds: Each topping can be added once per pizza",
    ]);
  });

  it("OB-5 unknown size and topping ids are named", () => {
    expect(
      errorsOf(withLine({ sizeId: "huge", toppingIds: ["anchovies"] })),
    ).toEqual([
      "lines.0.sizeId: Unknown size: huge",
      "lines.0.toppingIds: Unknown topping: anchovies",
    ]);
  });

  it("PR-10 an unknown promo code blocks the order", () => {
    expect(errorsOf({ ...valid, promoCodes: ["PIZZA4EVER"] })).toEqual([
      "promoCodes: Unknown promo code PIZZA4EVER",
    ]);
  });

  it("PR-3 an ineligible code does not block the order", () => {
    expect(validateOrder({ ...valid, promoCodes: ["SAVE5"] }).ok).toBe(true);
  });

  it("T-5 an invalid tip blocks the order", () => {
    expect(
      errorsOf({ ...valid, tip: { mode: "percent", value: "101" } }),
    ).toEqual(["tip: Tip percentage must be from 0 to 100"]);
  });

  it("S-16 price fields from the client are rejected", () => {
    expect(errorsOf({ ...valid, total: 1 })).toEqual([
      `: Unrecognized key: "total"`,
    ]);
    expect(errorsOf(withLine({ unitPrice: 1 }))).toEqual([
      `lines.0: Unrecognized key: "unitPrice"`,
    ]);
  });
});
