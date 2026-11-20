import { describe, expect, it } from "vitest";
import { MENU, formatRate } from "../src";

describe("rate labels come from the menu data", () => {
  it("the tax label is derived from the menu's tax rate", () => {
    expect(formatRate(MENU.taxRate)).toBe("6.5%");
    expect(formatRate(1100)).toBe("11%");
  });
});
