import {
  MENU,
  type Menu,
  type Size,
  type Topping,
  type ToppingCategory,
} from "./menu";
import { applyRate, formatCents, type BasisPoints, type Cents } from "./money";
import { PROMOS, normalizeCodes, type Promo } from "./promos";

export interface LineItem {
  sizeId: string;
  quantity: number;
  toppingIds: string[];
}

export type Tip =
  { mode: "dollars"; cents: Cents } | { mode: "percent"; rate: BasisPoints };

export interface Order {
  lines: LineItem[];
  promoCodes: string[];
  tip: Tip;
}

export interface QuoteLine {
  sizeId: string;
  quantity: number;
  toppingIds: string[];
  unitPrice: Cents;
  lineTotal: Cents;
}

export type PromoStatus = "not-eligible" | "not-combined" | "unknown";

export interface PromoNotice {
  code: string;
  status: PromoStatus;
  message: string;
}

export interface Quote {
  lines: QuoteLine[];
  subtotal: Cents;
  appliedPromos: string[];
  promoNotices: PromoNotice[];
  discount: Cents;
  tax: Cents;
  tip: Cents;
  total: Cents;
}

/** Thrown for ids that aren't on the menu. Validation catches these first; this is the backstop. */
export class PricingError extends Error {}

/**
 * The single pricing function. The web app calls it for the running total and the service calls
 * it for the charged total. Order of operations: subtotal, discount, tax, tip.
 */
export function priceOrder(
  order: Order,
  menu: Menu = MENU,
  promos: Promo[] = PROMOS,
): Quote {
  const lines = order.lines.map((item) => priceLine(item, menu));
  const subtotal = sum(lines.map((l) => l.lineTotal));
  const pizzaCount = sum(order.lines.map((l) => l.quantity));
  const { appliedPromos, promoNotices, discount } = resolvePromos(
    order.promoCodes,
    promos,
    subtotal,
    pizzaCount,
  );
  const taxable = subtotal - discount;
  const tax = applyRate(taxable, menu.taxRate);
  const tip =
    order.tip.mode === "dollars"
      ? order.tip.cents
      : applyRate(taxable + tax, order.tip.rate);
  return {
    lines,
    subtotal,
    appliedPromos,
    promoNotices,
    discount,
    tax,
    tip,
    total: taxable + tax + tip,
  };
}

function priceLine(item: LineItem, menu: Menu): QuoteLine {
  const size = findSize(menu, item.sizeId);
  const toppingPrices = item.toppingIds.map((id) => {
    const category = findCategory(menu, findTopping(menu, id));
    return applyRate(size.price, category.rate);
  });
  const unitPrice = size.price + sum(toppingPrices);
  return { ...item, unitPrice, lineTotal: unitPrice * item.quantity };
}

interface PromoResolution {
  appliedPromos: string[];
  promoNotices: PromoNotice[];
  discount: Cents;
}

/**
 * Applies every eligible code, except that among conflicting codes only the one with the larger
 * discount is kept (ties go to registry order). Ineligible and unknown codes are reported.
 */
function resolvePromos(
  rawCodes: string[],
  promos: Promo[],
  subtotal: Cents,
  pizzaCount: number,
): PromoResolution {
  const codes = normalizeCodes(rawCodes);
  const promoNotices: PromoNotice[] = [];
  const candidates: { promo: Promo; discount: Cents; rank: number }[] = [];

  for (const code of codes) {
    const rank = promos.findIndex((p) => p.code === code);
    const promo = promos[rank];
    if (!promo) {
      promoNotices.push({
        code,
        status: "unknown",
        message: `Unknown promo code ${code}`,
      });
      continue;
    }
    const result = promo.evaluate({ subtotal, pizzaCount });
    if (result.eligible) {
      candidates.push({ promo, discount: result.discount, rank });
    } else {
      promoNotices.push({
        code,
        status: "not-eligible",
        message: result.reason,
      });
    }
  }

  candidates.sort((a, b) => b.discount - a.discount || a.rank - b.rank);
  const kept: { promo: Promo; discount: Cents }[] = [];
  for (const candidate of candidates) {
    const winner = kept.find((k) => conflicts(k.promo, candidate.promo));
    if (winner) {
      promoNotices.push({
        code: candidate.promo.code,
        status: "not-combined",
        message: `${candidate.promo.code} can't be combined with ${winner.promo.code}; applied ${winner.promo.code}, which saves ${formatCents(winner.discount)}`,
      });
    } else {
      kept.push(candidate);
    }
  }

  return {
    appliedPromos: kept.map((k) => k.promo.code),
    promoNotices,
    discount: Math.min(subtotal, sum(kept.map((k) => k.discount))),
  };
}

function conflicts(a: Promo, b: Promo): boolean {
  return a.conflictsWith.includes(b.code) || b.conflictsWith.includes(a.code);
}

function findSize(menu: Menu, id: string): Size {
  const size = menu.sizes.find((s) => s.id === id);
  if (!size) throw new PricingError(`Unknown size: ${id}`);
  return size;
}

function findTopping(menu: Menu, id: string): Topping {
  const topping = menu.toppings.find((t) => t.id === id);
  if (!topping) throw new PricingError(`Unknown topping: ${id}`);
  return topping;
}

function findCategory(menu: Menu, topping: Topping): ToppingCategory {
  const category = menu.categories.find((c) => c.id === topping.categoryId);
  if (!category)
    throw new PricingError(`Unknown topping category: ${topping.categoryId}`);
  return category;
}

function sum(amounts: Cents[]): Cents {
  return amounts.reduce((total, amount) => total + amount, 0);
}
