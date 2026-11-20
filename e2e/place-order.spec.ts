import { expect, test } from "@playwright/test";

test("E2E-1 a customer builds an order, sees the total and places it", async ({
  page,
}) => {
  await page.goto("/");

  // The builder starts with one medium pizza; make it a large pepperoni with 10% off.
  await page.getByLabel("Size").selectOption("large");
  await page.getByLabel("pepperoni").check();
  await page.getByLabel("Promo codes").fill("ILOVEPIZZA");

  // 1296 subtotal − 130 discount + 76 tax = 1242.
  const summary = page.locator("aside.summary");
  await expect(summary).toContainText("$12.42");

  await page.getByRole("button", { name: "Send order" }).click();

  const placed = page.locator("section.placed");
  await expect(
    placed.getByRole("heading", { name: "Your order" }),
  ).toBeVisible();
  await expect(placed).toContainText("Not Started");
  await expect(placed).toContainText("1 × Large pizza");
  await expect(placed).toContainText("Charged total: $12.42");
});
