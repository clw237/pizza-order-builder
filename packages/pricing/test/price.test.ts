import { describe, expect, it } from "vitest";
import { priceSubtotal } from "../src";

describe("walking skeleton", () => {
  it("P-2 one large plain pizza costs $12.78 with tax", () => {
    expect(priceSubtotal(1200)).toEqual({
      subtotal: 1200,
      tax: 78,
      total: 1278,
    });
  });

  it("P-1 tax of 32.5 cents rounds half-up to 33", () => {
    expect(priceSubtotal(500).total).toBe(533);
  });
});
