import { expect, test } from "@playwright/test";

test("carrega a aplicação no Chromium", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("body")).toBeVisible();
});
