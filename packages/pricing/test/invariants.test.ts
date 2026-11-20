import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  MENU,
  PROMOS,
  priceOrder,
  type LineItem,
  type Order,
  type Tip,
} from "../src";

const lineArb: fc.Arbitrary<LineItem> = fc.record({
  sizeId: fc.constantFrom(...MENU.sizes.map((s) => s.id)),
  quantity: fc.integer({ min: 1, max: 99 }),
  toppingIds: fc.subarray(MENU.toppings.map((t) => t.id)),
});

const tipArb: fc.Arbitrary<Tip> = fc.oneof(
  fc.record({
    mode: fc.constant("dollars" as const),
    cents: fc.integer({ min: 0, max: 100_000 }),
  }),
  fc.record({
    mode: fc.constant("percent" as const),
    rate: fc.integer({ min: 0, max: 10_000 }),
  }),
);

const orderArb: fc.Arbitrary<Order> = fc.record({
  lines: fc.array(lineArb, { minLength: 1, maxLength: 6 }),
  promoCodes: fc.subarray(PROMOS.map((p) => p.code)),
  tip: tipArb,
});

describe("pricing invariants (random valid orders)", () => {
  it("INV-1 the breakdown adds up to the total", () => {
    fc.assert(
      fc.property(orderArb, (o) => {
        const q = priceOrder(o);
        expect(q.subtotal).toBe(
          q.lines.reduce((sum, l) => sum + l.lineTotal, 0),
        );
        expect(q.total).toBe(q.subtotal - q.discount + q.tax + q.tip);
      }),
    );
  });

  it("INV-2 every amount is a non-negative integer and discount never exceeds subtotal", () => {
    fc.assert(
      fc.property(orderArb, (o) => {
        const q = priceOrder(o);
        for (const amount of [q.subtotal, q.discount, q.tax, q.tip, q.total]) {
          expect(Number.isInteger(amount)).toBe(true);
          expect(amount).toBeGreaterThanOrEqual(0);
        }
        expect(q.discount).toBeLessThanOrEqual(q.subtotal);
      }),
    );
  });

  it("INV-6 SAVE5 and ILOVEPIZZA are never both applied", () => {
    fc.assert(
      fc.property(orderArb, (o) => {
        expect(priceOrder(o).appliedPromos.length).toBeLessThanOrEqual(1);
      }),
    );
  });

  it("INV-3 reordering line items doesn't change the total", () => {
    fc.assert(
      fc.property(orderArb, (o) => {
        const reversed = { ...o, lines: [...o.lines].reverse() };
        expect(priceOrder(reversed).total).toBe(priceOrder(o).total);
      }),
    );
  });

  it("INV-4 adding a pizza never lowers the subtotal", () => {
    fc.assert(
      fc.property(orderArb, lineArb, (o, extra) => {
        const bigger = { ...o, lines: [...o.lines, extra] };
        expect(priceOrder(bigger).subtotal).toBeGreaterThan(
          priceOrder(o).subtotal,
        );
      }),
    );
  });

  it("INV-4 adding a topping or raising a quantity never lowers the subtotal", () => {
    const allToppings = MENU.toppings.map((t) => t.id);
    fc.assert(
      fc.property(
        orderArb,
        fc.nat(),
        fc.constantFrom(...allToppings),
        (o, pick, topping) => {
          const index = pick % o.lines.length;
          const target = o.lines[index]!;
          const withTopping = target.toppingIds.includes(topping)
            ? target
            : { ...target, toppingIds: [...target.toppingIds, topping] };
          const withMore = {
            ...target,
            quantity: Math.min(target.quantity + 1, 99),
          };
          const before = priceOrder(o).subtotal;
          for (const changed of [withTopping, withMore]) {
            const lines = o.lines.map((l, i) => (i === index ? changed : l));
            expect(priceOrder({ ...o, lines }).subtotal).toBeGreaterThanOrEqual(
              before,
            );
          }
        },
      ),
    );
  });

  it("INV-5 the tip never changes the tax", () => {
    fc.assert(
      fc.property(orderArb, tipArb, (o, otherTip) => {
        expect(priceOrder({ ...o, tip: otherTip }).tax).toBe(priceOrder(o).tax);
      }),
    );
  });
});
