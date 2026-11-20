/** Money is always an integer number of cents. Rates are basis points (1 bp = 0.01%). */
export type Cents = number;
export type BasisPoints = number;

/** Applies a rate to an amount and rounds half-up to the cent, using integer math only. */
export function applyRate(amount: Cents, rate: BasisPoints): Cents {
  return Math.floor((amount * rate + 5000) / 10000);
}

export function formatCents(amount: Cents): string {
  return `$${(amount / 100).toFixed(2)}`;
}
