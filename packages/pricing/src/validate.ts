import { z } from "zod";
import { MENU, type Menu } from "./menu";
import type { LineItem, Order, Tip } from "./price";
import { PROMOS, normalizeCodes, type Promo } from "./promos";

const QUANTITY_MESSAGE = "Quantity must be a whole number from 1 to 99";

/** What a client sends. Never prices: the service computes those itself. */
export const orderInputSchema = z.strictObject({
  lines: z
    .array(
      z.strictObject({
        sizeId: z.string().max(64),
        quantity: z
          .int(QUANTITY_MESSAGE)
          .min(1, QUANTITY_MESSAGE)
          .max(99, QUANTITY_MESSAGE),
        toppingIds: z.array(z.string().max(64)).max(50),
      }),
    )
    .min(1, "Add at least one pizza")
    .max(50, "An order can have at most 50 line items"),
  promoCodes: z.array(z.string().max(32)).max(10),
  tip: z.strictObject({
    mode: z.enum(["dollars", "percent"]),
    value: z.string().max(20),
  }),
});

export type OrderInput = z.infer<typeof orderInputSchema>;

export interface FieldError {
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; order: Order; input: OrderInput }
  | { ok: false; errors: FieldError[] };

export type TipResult = { ok: true; tip: Tip } | { ok: false; message: string };

// Up to 4 whole digits and 2 decimals. Parsed as text so no floating point is involved.
const AMOUNT = /^(\d{1,4})(?:\.(\d{1,2}))?$/;

export function parseTip(mode: Tip["mode"], raw: string): TipResult {
  const text = raw.trim();
  if (text === "") {
    return {
      ok: true,
      tip: mode === "dollars" ? { mode, cents: 0 } : { mode, rate: 0 },
    };
  }
  const match = AMOUNT.exec(text);
  if (mode === "dollars") {
    if (!match)
      return {
        ok: false,
        message: "Tip must be a dollar amount like 3.50, up to $9,999.99",
      };
    return { ok: true, tip: { mode, cents: hundredths(match) } };
  }
  if (!match)
    return {
      ok: false,
      message: "Tip percentage must be a number like 15 or 12.5",
    };
  const rate = hundredths(match); // hundredths of a percent are basis points
  if (rate > 10000)
    return { ok: false, message: "Tip percentage must be from 0 to 100" };
  return { ok: true, tip: { mode, rate } };
}

function hundredths(match: RegExpExecArray): number {
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

/** Validates untrusted input (from the UI form or an HTTP body) against the schema and the menu. */
export function validateOrder(
  input: unknown,
  menu: Menu = MENU,
  promos: Promo[] = PROMOS,
): ValidationResult {
  const parsed = orderInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    };
  }
  const { lines, promoCodes, tip } = parsed.data;
  const errors = lines.flatMap((item, index) =>
    lineErrors(item, `lines.${index}`, menu),
  );

  for (const code of normalizeCodes(promoCodes)) {
    if (!promos.some((p) => p.code === code)) {
      errors.push({
        path: "promoCodes",
        message: `Unknown promo code ${code}`,
      });
    }
  }

  const tipResult = parseTip(tip.mode, tip.value);
  if (!tipResult.ok) errors.push({ path: "tip", message: tipResult.message });

  if (errors.length > 0 || !tipResult.ok) return { ok: false, errors };
  return {
    ok: true,
    order: { lines, promoCodes, tip: tipResult.tip },
    input: parsed.data,
  };
}

function lineErrors(item: LineItem, path: string, menu: Menu): FieldError[] {
  const errors: FieldError[] = [];
  if (!menu.sizes.some((s) => s.id === item.sizeId)) {
    errors.push({
      path: `${path}.sizeId`,
      message: `Unknown size: ${item.sizeId}`,
    });
  }
  for (const id of item.toppingIds) {
    if (!menu.toppings.some((t) => t.id === id)) {
      errors.push({
        path: `${path}.toppingIds`,
        message: `Unknown topping: ${id}`,
      });
    }
  }
  if (new Set(item.toppingIds).size !== item.toppingIds.length) {
    errors.push({
      path: `${path}.toppingIds`,
      message: "Each topping can be added once per pizza",
    });
  }
  return errors;
}
