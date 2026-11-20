import { describe, expect, it } from "vitest";
import { describeOrder } from "../src";
import { line, order } from "./fixtures";

describe("R3 order description", () => {
  it("D-1 quantity, size and toppings", () => {
    expect(
      describeOrder(order([line("medium", 2, ["pepperoni", "bacon"])])),
    ).toBe("2 × Medium pizza with pepperoni, bacon");
  });

  it("D-2 a pizza with no toppings says so", () => {
    expect(describeOrder(order([line("large")]))).toBe(
      "1 × Large pizza, no toppings",
    );
  });

  it("D-3 one line per item, in order", () => {
    const o = order([line("small", 3, ["onions"]), line("large")]);
    expect(describeOrder(o)).toBe(
      "3 × Small pizza with onions\n1 × Large pizza, no toppings",
    );
  });

  it("D-4 toppings are listed in menu order, whatever order they were picked", () => {
    const o = order([
      line("large", 1, ["pineapple", "extra-cheese", "pepperoni"]),
    ]);
    expect(describeOrder(o)).toBe(
      "1 × Large pizza with pepperoni, extra cheese, pineapple",
    );
  });
});
