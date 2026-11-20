import { describe, expect, it } from "vitest";
import { MENU, applyRate, formatRate } from "../src";

describe("rate labels come from the menu data", () => {
  it("the tax label is derived from the menu's tax rate", () => {
    expect(formatRate(MENU.taxRate)).toBe("6.5%");
    expect(formatRate(1100)).toBe("11%");
  });
});

describe("applyRate rounds half to even (banker's rounding)", () => {
  it.each([
    [500, 650, 32, "32.5 is a tie and goes down to the even 32"],
    [700, 650, 46, "45.5 is a tie and goes up to the even 46"],
    [4500, 650, 292, "292.5 is a tie and goes down to the even 292"],
    [300, 650, 20, "19.5 is a tie and goes up to the even 20"],
    [1666, 1000, 167, "166.6 is not a tie and rounds up"],
    [1234, 1000, 123, "123.4 is not a tie and rounds down"],
    [0, 650, 0, "zero stays zero"],
  ])("applyRate(%i, %i) = %i: %s", (amount, rate, expected) => {
    expect(applyRate(amount, rate)).toBe(expected);
  });
});
