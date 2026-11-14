import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openNewGame(page) {
  await page.getByRole("button", { name: "Новая партия" }).click();
  await page.getByRole("button", { name: "Начать партию" }).click();
  const board = page.locator(".game-screen .board-frame");
  await expect(board).toBeVisible();
  return board;
}

async function clickSquare(page, board, square) {
  const bounds = await board.boundingBox();
  if (!bounds) throw new Error("Chessboard is not visible");
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  await page.mouse.click(
    bounds.x + ((file + 0.5) * bounds.width) / 8,
    bounds.y + ((8 - rank - 0.5) * bounds.height) / 8,
  );
}

test("opens the current Russian chess interface", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Boss Chess 2\\.0/);
  await expect(page.getByRole("heading", { name: "Boss Chess" })).toBeVisible();
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

  await clickSquare(page, board, "e2");
  await expect(board.locator('[style*="radial-gradient"]')).toHaveCount(2);

  await clickSquare(page, board, "e4");
  await expect(page.locator(".notation-strip")).toContainText("e4");
});

test("two-tap moves still work when legal-move hints are disabled", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Настройки" }).click();
  await page.getByLabel("Возможные ходы").uncheck();
  await page.getByRole("button", { name: "Назад" }).click();

  const board = await openNewGame(page);
  await clickSquare(page, board, "e2");
  await expect(board.locator('[style*="radial-gradient"]')).toHaveCount(0);

  await clickSquare(page, board, "e4");
  await expect(page.locator(".notation-strip")).toContainText("e4");
});

test("illegal and opponent-piece taps do not make a move", async ({ page }) => {
  await page.goto("/");
  const board = await openNewGame(page);

  await clickSquare(page, board, "e2");
  await clickSquare(page, board, "e5");
  await expect(page.locator(".notation-strip")).toContainText("Сделайте первый ход");

  await clickSquare(page, board, "e7");
  await clickSquare(page, board, "e5");
  await expect(page.locator(".notation-strip")).toContainText("Сделайте первый ход");

  await clickSquare(page, board, "e2");
  await clickSquare(page, board, "e4");
  await expect(page.locator(".notation-strip")).toContainText("e4");
});

test("basic accessibility scan", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const results = await new AxeBuilder({ page }).exclude(".board-frame").analyze();
  expect(results.violations).toEqual([]);
});
