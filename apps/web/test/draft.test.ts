import { describe, expect, it } from "vitest";
import {
  addLine,
  emptyDraft,
  evaluate,
  fromOrderInput,
  removeLine,
  toggleTopping,
  updateLine,
} from "../src/draft";

describe("order builder draft", () => {
  it("OB-1 add a line, change size and quantity, add and remove a topping", () => {
    let draft = addLine(emptyDraft());
    draft = removeLine(draft, draft.lines[0]!.key);
    const key = draft.lines[0]!.key;
    draft = updateLine(draft, key, { sizeId: "large", quantity: 3 });
    draft = toggleTopping(draft, key, "bacon");
    draft = toggleTopping(draft, key, "onions");
    draft = toggleTopping(draft, key, "bacon");
    expect(evaluate(draft).input.lines).toEqual([
      { sizeId: "large", quantity: 3, toppingIds: ["onions"] },
    ]);
  });

  it("OB-2 removing the only pizza blocks submission with a message", () => {
    const draft = emptyDraft();
    const result = removeLine(draft, draft.lines[0]!.key);
    expect(evaluate(result)).toMatchObject({
      quote: undefined,
      errors: [{ message: "Add at least one pizza" }],
    });
  });

  it("RT-3 every change produces a new total from the shared pricing function", () => {
    let draft = emptyDraft(); // one medium, no toppings
    const key = draft.lines[0]!.key;
    const totals = [evaluate(draft).quote?.total];
    draft = updateLine(draft, key, { sizeId: "large" });
    totals.push(evaluate(draft).quote?.total);
    draft = { ...draft, promoText: "ILOVEPIZZA" };
    totals.push(evaluate(draft).quote?.total);
    draft = { ...draft, tipMode: "percent", tipValue: "15" };
    totals.push(evaluate(draft).quote?.total);
    // The last total includes a 172.5¢ tip, a tie that rounds half to even down to 172¢.
    expect(totals).toEqual([746, 1278, 1150, 1322]);
  });

  it("PR-11 promo codes can be separated by commas or spaces", () => {
    const draft = { ...emptyDraft(), promoText: " save5, ilovepizza " };
    expect(evaluate(draft).input.promoCodes).toEqual(["save5", "ilovepizza"]);
  });

  it("T-5 an invalid tip is reported and no total is shown", () => {
    const draft = { ...emptyDraft(), tipValue: "abc" };
    expect(evaluate(draft)).toMatchObject({
      quote: undefined,
      errors: [{ path: "tip", message: expect.stringMatching(/^Tip/) }],
    });
  });

  it("edit mode loads a submitted order back into the builder", () => {
    const input = {
      lines: [{ sizeId: "small", quantity: 2, toppingIds: ["garlic"] }],
      promoCodes: ["SAVE5"],
      tip: { mode: "dollars" as const, value: "2" },
    };
    expect(evaluate(fromOrderInput(input)).input).toEqual(input);
  });
});
