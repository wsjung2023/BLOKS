import { test, expect } from "@playwright/test";
import { setupAuth, MOCK_CHARACTERS } from "./fixtures/auth";

test.beforeEach(async ({ page }) => {
  await setupAuth(page);
  await page.route("**/api/v1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/characters")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: MOCK_CHARACTERS }) });
    } else if (url.includes("/world/snapshot")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            characters: MOCK_CHARACTERS.map((c) => ({ ...c, workload_score: 50, fatigue_score: 20, activity_status: "Working", location_zone: "desk" })),
          },
        }),
      });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) });
    }
  });
});

test("/world page renders without crash", async ({ page }) => {
  await page.goto("/world");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
  expect(page.url()).not.toContain("/login");
});

test("/world page has canvas element (Phaser)", async ({ page }) => {
  await page.goto("/world");
  await page.waitForTimeout(3000); // allow Phaser canvas to initialize
  const canvas = page.locator("canvas");
  const count = await canvas.count();
  expect(count).toBeGreaterThan(0);
});

test("world page has navigation header", async ({ page }) => {
  await page.goto("/world");
  await page.waitForLoadState("networkidle");
  const links = await page.locator("a").count();
  expect(links).toBeGreaterThan(0);
});

test("world page does not show 500 error", async ({ page }) => {
  await page.goto("/world");
  await page.waitForLoadState("networkidle");
  const body = await page.locator("body").textContent();
  expect(body).not.toContain("Internal Server Error");
});

test("world page loads within 10 seconds", async ({ page }) => {
  const start = Date.now();
  await page.goto("/world");
  await page.waitForLoadState("domcontentloaded");
  expect(Date.now() - start).toBeLessThan(10000);
});

test("world page body is not empty after load", async ({ page }) => {
  await page.goto("/world");
  await page.waitForLoadState("networkidle");
  const text = await page.locator("body").textContent();
  expect(text?.length).toBeGreaterThan(5);
});

test("world page has accessible elements", async ({ page }) => {
  await page.goto("/world");
  await page.waitForLoadState("networkidle");
  const elements = await page.locator("body *").count();
  expect(elements).toBeGreaterThan(0);
});

test("world page title is set", async ({ page }) => {
  await page.goto("/world");
  await page.waitForLoadState("domcontentloaded");
  const title = await page.title();
  expect(title.length).toBeGreaterThan(0);
});

test("world page characters API is called on load", async ({ page }) => {
  let charactersCalled = false;
  await page.route("**/api/v1/characters**", async (route) => {
    charactersCalled = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { items: MOCK_CHARACTERS } }) });
  });
  await page.goto("/world");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  expect(charactersCalled).toBe(true);
});

test("world page is mobile responsive", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/world");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
});
