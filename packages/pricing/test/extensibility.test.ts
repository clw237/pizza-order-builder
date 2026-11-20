import { describe, expect, it } from "vitest";
import {
  MENU,
  PROMOS,
  applyRate,
  priceOrder,
  type Menu,
  type Promo,
} from "../src";
import { line, order } from "./fixtures";

// New menu entries and promos are plain data passed to the same priceOrder function.
const EXTENDED_MENU: Menu = {
  ...MENU,
  sizes: [...MENU.sizes, { id: "xl", label: "Extra Large", price: 1500 }],
  categories: [
    ...MENU.categories,
    { id: "luxury", label: "Luxury", rate: 1500 },
  ],
  toppings: [
    ...MENU.toppings,
    { id: "truffle", label: "truffle", categoryId: "luxury" },
  ],
};

const BIG_ORDER: Promo = {
  code: "BIGORDER",
  label: "$8 off orders of 3 or more pizzas",
  conflictsWith: ["ILOVEPIZZA"],
  evaluate: ({ pizzaCount }) =>
    pizzaCount >= 3
      ? { eligible: true, discount: 800 }
      : {
          eligible: false,
          discount: 0,
          reason: "BIGORDER needs 3 or more pizzas",
        },
};

describe("R6 extensibility", () => {
  it("E-1 a new size, topping category and topping price with no engine change", () => {
    const q = priceOrder(
      order([line("xl", 1, ["truffle", "pepperoni"])]),
      EXTENDED_MENU,
    );
    // 1500 + 15% of 1500 (225) + 8% of 1500 (120)
    expect(q.subtotal).toBe(1845);
    expect(q.tax).toBe(applyRate(1845, MENU.taxRate));
  });

  it("E-2 a new promo with its own condition and a conflict is resolved by the same rule", () => {
    const promos = [...PROMOS, BIG_ORDER];
    const three = order([line("large", 3)], ["ILOVEPIZZA", "BIGORDER"]);
    // 3600 subtotal: ILOVEPIZZA saves 360, BIGORDER saves 800, so BIGORDER wins.
    expect(priceOrder(three, MENU, promos)).toMatchObject({
      discount: 800,
      appliedPromos: ["BIGORDER"],
    });

    const two = order([line("large", 2)], ["ILOVEPIZZA", "BIGORDER"]);
    expect(priceOrder(two, MENU, promos)).toMatchObject({
      discount: 240,
      appliedPromos: ["ILOVEPIZZA"],
    });
  });
});
