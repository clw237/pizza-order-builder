import { MENU, type Menu } from "./menu";
import { PricingError, type LineItem, type Order } from "./price";

/** One line per item, e.g. "2 × Medium pizza with pepperoni, bacon". Toppings in menu order. */
export function describeOrder(order: Order, menu: Menu = MENU): string {
  return order.lines.map((item) => describeLine(item, menu)).join("\n");
}

export function describeLine(item: LineItem, menu: Menu = MENU): string {
  const size = menu.sizes.find((s) => s.id === item.sizeId);
  if (!size) throw new PricingError(`Unknown size: ${item.sizeId}`);
  const toppings = menu.toppings
    .filter((t) => item.toppingIds.includes(t.id))
    .map((t) => t.label);
  const pizza = `${item.quantity} × ${size.label} pizza`;
  return toppings.length === 0
    ? `${pizza}, no toppings`
    : `${pizza} with ${toppings.join(", ")}`;
}
