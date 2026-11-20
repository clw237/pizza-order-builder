import { applyRate, formatCents, type Cents } from "./money";

/** What a promo may look at when deciding whether it applies. */
export interface PromoContext {
  subtotal: Cents;
  pizzaCount: number;
}

export type PromoResult =
  | { eligible: true; discount: Cents }
  | { eligible: false; discount: 0; reason: string };

export interface Promo {
  code: string;
  label: string;
  /** Codes this promo can't be combined with. Conflicts count in both directions. */
  conflictsWith: string[];
  evaluate(context: PromoContext): PromoResult;
}

const SAVE5_MINIMUM: Cents = 2000;

/** Registry order breaks ties when two conflicting promos save the same amount. */
export const PROMOS: Promo[] = [
  {
    code: "ILOVEPIZZA",
    label: "10% off before tax",
    conflictsWith: ["SAVE5"],
    evaluate: ({ subtotal }) => ({
      eligible: true,
      discount: applyRate(subtotal, 1000),
    }),
  },
  {
    code: "SAVE5",
    label: "$5 off orders over $20",
    conflictsWith: ["ILOVEPIZZA"],
    evaluate: ({ subtotal }) =>
      subtotal > SAVE5_MINIMUM
        ? { eligible: true, discount: 500 }
        : {
            eligible: false,
            discount: 0,
            reason: `SAVE5 needs an order over ${formatCents(SAVE5_MINIMUM)} before tax`,
          },
  },
];
