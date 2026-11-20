import { describe, expect, it } from "vitest";
import { MENU, priceOrder, type Order } from "../src";
import { line, order, plain } from "./fixtures";

const ALL_TOPPINGS = MENU.toppings.map((t) => t.id);

function totals(o: Order) {
  const q = priceOrder(o);
  return {
    subtotal: q.subtotal,
    discount: q.discount,
    tax: q.tax,
    tip: q.tip,
    total: q.total,
  };
}

describe("R2 base pricing", () => {
  it("P-1 small plain: tax 32.5 cents rounds half-up to 33", () => {
    expect(totals(plain("small"))).toEqual({
      subtotal: 500,
      discount: 0,
      tax: 33,
      tip: 0,
      total: 533,
    });
  });

  it("P-2 large plain costs $12.78", () => {
    expect(priceOrder(plain("large")).total).toBe(1278);
  });

  it("P-3 medium plain: tax 45.5 cents rounds half-up to 46", () => {
    expect(totals(plain("medium"))).toMatchObject({ tax: 46, total: 746 });
  });

  it.each([
    ["small", "pepperoni", 540],
    ["medium", "pepperoni", 756],
    ["large", "pepperoni", 1296],
    ["small", "bacon", 555],
    ["medium", "bacon", 777],
    ["large", "bacon", 1332],
  ])("P-4 %s with %s has unit price %i", (size, topping, unit) => {
    expect(
      priceOrder(order([line(size, 1, [topping])])).lines[0]?.unitPrice,
    ).toBe(unit);
  });

  it("P-5 large pepperoni + bacon", () => {
    expect(
      totals(order([line("large", 1, ["pepperoni", "bacon"])])),
    ).toMatchObject({
      subtotal: 1428,
      tax: 93,
      total: 1521,
    });
  });

  it("P-6 quantity multiplies toppings too: 3 small onions", () => {
    expect(totals(order([line("small", 3, ["onions"])]))).toMatchObject({
      subtotal: 1620,
      tax: 105,
      total: 1725,
    });
  });

  it("P-7 multiple line items", () => {
    const o = order([line("large"), line("medium", 2, ["chicken"])]);
    expect(totals(o)).toMatchObject({ subtotal: 2754, tax: 179, total: 2933 });
  });

  it("P-8 large with all 12 toppings", () => {
    expect(totals(order([line("large", 1, ALL_TOPPINGS)]))).toMatchObject({
      subtotal: 2568,
      tax: 167,
      total: 2735,
    });
  });
});

describe("R4 promo codes", () => {
  const twoMediumPepBacon = [line("medium", 2, ["pepperoni", "bacon"])];

  it("PR-1 ILOVEPIZZA takes 10% before tax", () => {
    expect(totals(order([line("large")], ["ILOVEPIZZA"]))).toMatchObject({
      discount: 120,
      tax: 70,
      total: 1150,
    });
  });

  it("PR-2 ILOVEPIZZA discount 166.6 cents rounds half-up to 167", () => {
    expect(totals(order(twoMediumPepBacon, ["ILOVEPIZZA"]))).toMatchObject({
      subtotal: 1666,
      discount: 167,
      tax: 97,
      total: 1596,
    });
  });

  it("PR-3 SAVE5 at exactly $20.00 is not applied and says why", () => {
    const q = priceOrder(order([line("small", 4)], ["SAVE5"]));
    expect(q).toMatchObject({
      discount: 0,
      tax: 130,
      total: 2130,
      appliedPromos: [],
    });
    expect(q.promoNotices).toEqual([
      {
        code: "SAVE5",
        status: "not-eligible",
        message: expect.stringMatching(/over \$20\.00/),
      },
    ]);
  });

  it("PR-4 SAVE5 just over $20 takes $5 off", () => {
    const o = order(
      [line("small", 3), line("small", 1, ["onions"])],
      ["SAVE5"],
    );
    expect(totals(o)).toMatchObject({
      subtotal: 2040,
      discount: 500,
      tax: 100,
      total: 1640,
    });
  });

  it("PR-5 SAVE5 on a $12 order is not applied", () => {
    const q = priceOrder(order([line("large")], ["SAVE5"]));
    expect(q.total).toBe(1278);
    expect(q.promoNotices[0]?.status).toBe("not-eligible");
  });

  it("PR-6 conflicting codes: ILOVEPIZZA wins when it saves more", () => {
    const q = priceOrder(order([line("large", 5)], ["SAVE5", "ILOVEPIZZA"]));
    expect(q).toMatchObject({
      discount: 600,
      tax: 351,
      total: 5751,
      appliedPromos: ["ILOVEPIZZA"],
    });
    expect(q.promoNotices).toContainEqual({
      code: "SAVE5",
      status: "not-combined",
      message: expect.stringMatching(/can't be combined with ILOVEPIZZA/),
    });
  });

  it("PR-7 conflicting codes: SAVE5 wins when it saves more", () => {
    const q = priceOrder(order([line("large", 2)], ["ILOVEPIZZA", "SAVE5"]));
    expect(q).toMatchObject({
      discount: 500,
      tax: 124,
      total: 2024,
      appliedPromos: ["SAVE5"],
    });
    expect(q.promoNotices.find((n) => n.code === "ILOVEPIZZA")?.status).toBe(
      "not-combined",
    );
  });

  it("PR-8 tie goes to the code listed first in the registry (ILOVEPIZZA)", () => {
    const q = priceOrder(order([line("small", 10)], ["SAVE5", "ILOVEPIZZA"]));
    expect(q).toMatchObject({
      discount: 500,
      tax: 293,
      total: 4793,
      appliedPromos: ["ILOVEPIZZA"],
    });
  });

  it("PR-9 an ineligible code never wins a conflict", () => {
    const q = priceOrder(order([line("large")], ["ILOVEPIZZA", "SAVE5"]));
    expect(q).toMatchObject({
      discount: 120,
      total: 1150,
      appliedPromos: ["ILOVEPIZZA"],
    });
    expect(q.promoNotices.find((n) => n.code === "SAVE5")?.status).toBe(
      "not-eligible",
    );
  });

  it("PR-10 an unknown code is reported, not silently ignored", () => {
    const q = priceOrder(order([line("large")], ["PIZZA4EVER"]));
    expect(q.discount).toBe(0);
    expect(q.promoNotices).toEqual([
      {
        code: "PIZZA4EVER",
        status: "unknown",
        message: "Unknown promo code PIZZA4EVER",
      },
    ]);
  });

  it("PR-11 codes are trimmed and case-insensitive", () => {
    expect(priceOrder(order([line("large")], [" ilovepizza "])).total).toBe(
      1150,
    );
  });

  it("PR-12 a code entered twice counts once", () => {
    const q = priceOrder(order([line("large")], ["ILOVEPIZZA", "ilovepizza"]));
    expect(q).toMatchObject({
      discount: 120,
      appliedPromos: ["ILOVEPIZZA"],
      promoNotices: [],
    });
  });
});

describe("R4 tips", () => {
  it("T-1 dollar tip is added after tax", () => {
    const o = order([line("large")], [], { mode: "dollars", cents: 350 });
    expect(totals(o)).toMatchObject({ tax: 78, tip: 350, total: 1628 });
  });

  it("T-2 percent tip is of the post-tax total and rounds half-up", () => {
    const o = order([line("large")], [], { mode: "percent", rate: 1500 });
    expect(totals(o)).toMatchObject({ tip: 192, total: 1470 });
  });

  it("T-3 percent tip is of the discounted, taxed total", () => {
    const o = order(
      [line("medium", 2, ["pepperoni", "bacon"])],
      ["ILOVEPIZZA"],
      {
        mode: "percent",
        rate: 2000,
      },
    );
    expect(totals(o)).toMatchObject({
      discount: 167,
      tax: 97,
      tip: 319,
      total: 1915,
    });
  });

  it("T-4 zero tip adds nothing", () => {
    expect(
      priceOrder(order([line("large")], [], { mode: "percent", rate: 0 }))
        .total,
    ).toBe(1278);
  });
});

describe("pricing rejects ids that aren't on the menu", () => {
  it("OB-5 unknown size", () => {
    expect(() => priceOrder(plain("huge"))).toThrow(/Unknown size: huge/);
  });

  it("OB-5 unknown topping", () => {
    expect(() => priceOrder(order([line("large", 1, ["anchovies"])]))).toThrow(
      /Unknown topping: anchovies/,
    );
  });
});
