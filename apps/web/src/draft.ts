import {
  priceOrder,
  validateOrder,
  type FieldError,
  type OrderInput,
  type Quote,
  type Tip,
} from "@pizza/pricing";

/** The builder form. Kept as plain data so every change can be priced by the shared function. */
export interface DraftLine {
  key: number;
  sizeId: string;
  quantity: number;
  toppingIds: string[];
}

export interface Draft {
  lines: DraftLine[];
  promoText: string;
  tipMode: Tip["mode"];
  tipValue: string;
}

export interface Evaluation {
  input: OrderInput;
  quote: Quote | undefined;
  errors: FieldError[];
}

let nextKey = 1;

function newLine(sizeId = "medium"): DraftLine {
  return { key: nextKey++, sizeId, quantity: 1, toppingIds: [] };
}

export function emptyDraft(): Draft {
  return {
    lines: [newLine()],
    promoText: "",
    tipMode: "dollars",
    tipValue: "",
  };
}

export function addLine(draft: Draft): Draft {
  return { ...draft, lines: [...draft.lines, newLine()] };
}

export function removeLine(draft: Draft, key: number): Draft {
  return { ...draft, lines: draft.lines.filter((l) => l.key !== key) };
}

export function updateLine(
  draft: Draft,
  key: number,
  patch: Partial<Pick<DraftLine, "sizeId" | "quantity">>,
): Draft {
  return {
    ...draft,
    lines: draft.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)),
  };
}

export function toggleTopping(
  draft: Draft,
  key: number,
  toppingId: string,
): Draft {
  return {
    ...draft,
    lines: draft.lines.map((l) => {
      if (l.key !== key) return l;
      const has = l.toppingIds.includes(toppingId);
      return {
        ...l,
        toppingIds: has
          ? l.toppingIds.filter((t) => t !== toppingId)
          : [...l.toppingIds, toppingId],
      };
    }),
  };
}

export function toOrderInput(draft: Draft): OrderInput {
  return {
    lines: draft.lines.map(({ sizeId, quantity, toppingIds }) => ({
      sizeId,
      quantity,
      toppingIds,
    })),
    promoCodes: draft.promoText.split(/[\s,]+/).filter((c) => c !== ""),
    tip: { mode: draft.tipMode, value: draft.tipValue },
  };
}

export function fromOrderInput(input: OrderInput): Draft {
  return {
    lines: input.lines.map((l) => ({
      ...newLine(l.sizeId),
      quantity: l.quantity,
      toppingIds: [...l.toppingIds],
    })),
    promoText: input.promoCodes.join(", "),
    tipMode: input.tip.mode,
    tipValue: input.tip.value,
  };
}

/** Validates and prices the draft with the same functions the service uses. */
export function evaluate(draft: Draft): Evaluation {
  const input = toOrderInput(draft);
  const result = validateOrder(input);
  if (!result.ok) return { input, quote: undefined, errors: result.errors };
  return { input, quote: priceOrder(result.order), errors: [] };
}
