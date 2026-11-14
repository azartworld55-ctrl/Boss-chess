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
  await expect(page).toHaveTitle(/Boss Chess 2\.2\.0/);
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

test("home board preview is a prominent focal element across screen sizes", async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900, minBoardWidth: 620 },
    { width: 390, height: 844, minBoardWidth: 290 },
    { width: 360, height: 740, minBoardWidth: 270 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    const board = page.locator(".home-board");
    await expect(board).toBeVisible();
    const layout = await page.evaluate(() => {
      const boardRect = document.querySelector(".home-board").getBoundingClientRect();
      return {
        boardWidth: boardRect.width,
        viewportHeight: document.documentElement.clientHeight,
        pageHeight: document.documentElement.scrollHeight,
      };
    });
    expect(layout.boardWidth).toBeGreaterThanOrEqual(viewport.minBoardWidth);
    expect(layout.pageHeight).toBeLessThanOrEqual(layout.viewportHeight);
  }
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

test("mobile home menu keeps the board preview and all actions visible without scrolling", async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 740 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const board = await openNewGame(page);
    await clickSquare(board, "e2");
    await clickSquare(board, "e4");
    await page.getByRole("button", { name: "В меню" }).click();

    await expect(page.locator(".home-board .board-frame")).toBeVisible();
    await expect(page.getByRole("button", { name: "Продолжить партию" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Новая партия" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Кампания" })).toBeVisible();

    const layout = await page.evaluate(() => {
      const selectors = [".home-board", ".home-actions", ".home-actions button"];
      const rects = selectors.flatMap((selector) =>
        [...document.querySelectorAll(selector)].map((node) => {
          const rect = node.getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom, height: rect.height };
        }),
      );
      return {
        viewportHeight: document.documentElement.clientHeight,
        pageHeight: document.documentElement.scrollHeight,
        rects,
      };
    });
    expect(layout.pageHeight).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.rects.every((rect) => rect.top >= 0 && rect.bottom <= layout.viewportHeight)).toBeTruthy();
  }
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

test("captures visual review screenshots for key screens", async ({ page }, testInfo) => {
  const capture = async (name) => {
    await page.screenshot({
      path: testInfo.outputPath(`${name}.png`),
      fullPage: true,
      animations: "disabled",
    });
  };

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Boss Chess" })).toBeVisible();
  await capture("home-desktop");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Boss Chess" })).toBeVisible();
  await capture("home-mobile");

  await page.getByRole("button", { name: "Настройки" }).click();
  await expect(page.getByRole("heading", { name: "Настройки" })).toBeVisible();
  await capture("settings-mobile");

  await page.getByRole("button", { name: "Назад" }).click();
  await openNewGame(page);
  await capture("game-mobile");
});
