import { applyRate, type Cents } from "./money";

export const TAX_RATE = 650;

export interface Quote {
  subtotal: Cents;
  tax: Cents;
  total: Cents;
}

export function priceSubtotal(subtotal: Cents): Quote {
  const tax = applyRate(subtotal, TAX_RATE);
  return { subtotal, tax, total: subtotal + tax };
}
