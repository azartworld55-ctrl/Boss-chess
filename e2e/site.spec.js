import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("opens the Russian chess interface", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Boss Chess 2\.0/);
  await expect(page.getByRole("heading", { name: "Твоя партия." })).toBeVisible();
  await expect(page.getByText("Компьютер", { exact: true })).toBeVisible();
});

test("opens and closes settings", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Открыть настройки" }).click();
  await expect(page.getByRole("heading", { name: "Настройки" })).toBeVisible();
  await page.getByRole("button", { name: "Закрыть" }).click();
  await expect(page.getByRole("heading", { name: "Настройки" })).toBeHidden();
});

test("mobile layout has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});

test("basic accessibility scan", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});