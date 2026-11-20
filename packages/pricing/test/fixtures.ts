import type { LineItem, Order, Tip } from "../src";

export const NO_TIP: Tip = { mode: "dollars", cents: 0 };

export function line(
  sizeId: string,
  quantity = 1,
  toppingIds: string[] = [],
): LineItem {
  return { sizeId, quantity, toppingIds };
}

export function order(
  lines: LineItem[],
  promoCodes: string[] = [],
  tip: Tip = NO_TIP,
): Order {
  return { lines, promoCodes, tip };
}

/** n plain pizzas of one size, as a single line. */
export function plain(sizeId: string, quantity = 1): Order {
  return order([line(sizeId, quantity)]);
}
