/** Money is always an integer number of cents. Rates are basis points (1 bp = 0.01%). */
export type Cents = number;
export type BasisPoints = number;

const BASIS_POINTS_PER_UNIT = 10000;
const HALF = BASIS_POINTS_PER_UNIT / 2;

/**
 * Applies a rate to an amount and rounds half to even (banker's rounding) to the cent, using
 * integer math only. Half to even means exact half-cent ties don't always round the same way,
 * so they don't bias totals upward.
 */
export function applyRate(amount: Cents, rate: BasisPoints): Cents {
  const product = amount * rate;
  const whole = Math.floor(product / BASIS_POINTS_PER_UNIT);
  const remainder = product - whole * BASIS_POINTS_PER_UNIT;
  if (remainder > HALF) return whole + 1;
  if (remainder < HALF) return whole;
  return whole % 2 === 0 ? whole : whole + 1;
}

export function formatCents(amount: Cents): string {
  return `$${(amount / 100).toFixed(2)}`;
}

/** 650 basis points → "6.5%". */
export function formatRate(rate: BasisPoints): string {
  return `${rate / 100}%`;
}
