import { expect, test } from "@playwright/test";

test("E2E-2 a customer tracks a placed order by its ID", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Send order" }).click();
  const placed = page.locator("section.placed");
  await expect(placed).toContainText("Not Started");
  const id = (await placed.locator("code").textContent()) ?? "";
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  await expect(placed).toContainText("Save this ID to track your order");

  // The URL names the order, so a reload keeps it on screen.
  await expect(page).toHaveURL(`/?order=${id}`);
  await page.reload();
  await expect(placed.locator("code")).toHaveText(id);

  // A fresh visit starts a new order; pasting the ID brings the placed one back.
  await page.goto("/");
  await expect(placed).toHaveCount(0);
  await page.getByLabel("Order ID").fill(id);
  await page.getByRole("button", { name: "Track" }).click();
  await expect(placed.locator("code")).toHaveText(id);
  await expect(placed).toContainText("Not Started");
  await expect(
    placed.getByRole("button", { name: "Cancel order" }),
  ).toBeVisible();

  // "Start a new order" drops the ID from the URL, so a reload stays on the builder.
  await page.getByRole("button", { name: "Start a new order" }).click();
  await expect(page).toHaveURL("/");
  await page.reload();
  await expect(placed).toHaveCount(0);
});

test("E2E-2 an unknown order ID says so", async ({ page }) => {
  await page.goto("/");
  await page
    .getByLabel("Order ID")
    .fill("00000000-0000-4000-8000-000000000000");
  await page.getByRole("button", { name: "Track" }).click();
  await expect(page.getByRole("status")).toHaveText("No order with that ID.");
  await expect(page.locator("section.placed")).toHaveCount(0);
});

test("E2E-2 a stale link says so and doesn't come back after a new order", async ({
  page,
}) => {
  await page.goto("/?order=00000000-0000-4000-8000-000000000000");
  await expect(page.getByRole("status")).toHaveText("No order with that ID.");
  await expect(page).toHaveURL("/");

  await page.getByRole("button", { name: "Send order" }).click();
  const code = page.locator("section.placed code");
  await expect(code).toHaveText(/^[0-9a-f-]{36}$/);
  const id = (await code.textContent()) ?? "";
  await page.reload();
  await expect(code).toHaveText(id);
});
