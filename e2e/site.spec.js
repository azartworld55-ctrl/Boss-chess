import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openNewGame(page) {
  await page.getByRole("button", { name: "Новая партия" }).click();
  await page.getByRole("button", { name: "Начать партию" }).click();
  const board = page.locator(".game-screen .board-frame");
  await expect(board).toBeVisible();
  return board;
}

async function clickSquare(board, square) {
  await board.locator(`[data-square="${square}"]`).click();
}

test("opens the current Russian chess interface", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Boss Chess 2\.0/);
  await expect(page.getByRole("heading", { name: "Boss Chess" })).toBeVisible();
  await expect(page.getByRole("button", { name: /BOSS CHESS/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Новая партия" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Кампания" })).toBeVisible();
});

test("opens settings and returns to the home screen", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Настройки" }).click();
  await expect(page.getByRole("heading", { name: "Настройки" })).toBeVisible();
  await page.getByRole("button", { name: "Назад" }).click();
  await expect(page.getByRole("heading", { name: "Boss Chess" })).toBeVisible();
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

test("two-tap moves work and legal-move hints remain visible when enabled", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const board = await openNewGame(page);

  await clickSquare(board, "e2");
  await expect(board.locator('[data-square="e3"] > div')).toHaveCSS("background-image", /radial-gradient/);
  await expect(board.locator('[data-square="e4"] > div')).toHaveCSS("background-image", /radial-gradient/);

  await clickSquare(board, "e4");
  await expect(page.locator(".notation-strip")).toContainText("e4");
});

test("two-tap moves still work when legal-move hints are disabled", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Настройки" }).click();
  await page.getByLabel("Возможные ходы").uncheck();
  await page.getByRole("button", { name: "Назад" }).click();

  const board = await openNewGame(page);
  await clickSquare(board, "e2");
  await expect(board.locator('[data-square="e3"] > div')).not.toHaveCSS("background-image", /radial-gradient/);
  await expect(board.locator('[data-square="e4"] > div')).not.toHaveCSS("background-image", /radial-gradient/);

  await clickSquare(board, "e4");
  await expect(page.locator(".notation-strip")).toContainText("e4");
});

test("illegal and opponent-piece taps do not make a move", async ({ page }) => {
  await page.goto("/");
  const board = await openNewGame(page);

  await clickSquare(board, "e2");
  await clickSquare(board, "e5");
  await expect(page.locator(".notation-strip")).toContainText("Сделайте первый ход");

  await clickSquare(board, "e7");
  await clickSquare(board, "e5");
  await expect(page.locator(".notation-strip")).toContainText("Сделайте первый ход");

  await clickSquare(board, "e2");
  await clickSquare(board, "e4");
  await expect(page.locator(".notation-strip")).toContainText("e4");
});

test("basic accessibility scan", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  // react-chessboard currently renders unnamed draggable square controls; scan the surrounding UI.
  const results = await new AxeBuilder({ page }).exclude(".board-frame").analyze();
  expect(results.violations).toEqual([]);
});

test("settings return to the screen they were opened from", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await openNewGame(page);
  await page.locator(".game-controls").getByRole("button", { name: "Настройки" }).click();
  await expect(page.getByRole("heading", { name: "Настройки" })).toBeVisible();
  await page.getByRole("button", { name: "Назад" }).click();
  await expect(page.locator(".game-screen .board-frame")).toBeVisible();
  await expect(page.locator(".game-controls")).toBeVisible();
});

test("mobile home menu fits without vertical scrolling when a game can be continued", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await openNewGame(page);
  await page.getByRole("button", { name: "В меню" }).click();
  await expect(page.getByRole("button", { name: "Продолжить партию" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Новая партия" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Кампания" })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientHeight,
    content: document.documentElement.scrollHeight,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});

test("mobile settings fit in the viewport without a scroll area", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Настройки" }).click();
  const dimensions = await page.locator(".settings-layout").evaluate((node) => ({
    viewport: node.closest(".sub-screen").clientHeight,
    content: node.closest(".sub-screen").scrollHeight,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});
