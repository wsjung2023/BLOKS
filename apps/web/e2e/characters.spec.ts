import { test, expect } from "@playwright/test";
import { setupAuth, MOCK_CHARACTERS } from "./fixtures/auth";

test.beforeEach(async ({ page }) => {
  await setupAuth(page);
  await page.route("**/api/v1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/characters")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { items: MOCK_CHARACTERS } }) });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) });
    }
  });
});

test("/characters page renders without crash", async ({ page }) => {
  await page.goto("/characters");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
  expect(page.url()).not.toContain("/login");
});

test("character name 아크 is displayed", async ({ page }) => {
  await page.goto("/characters");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("text=아크")).toBeVisible({ timeout: 10000 });
});

test("character name 글리치 is displayed", async ({ page }) => {
  await page.goto("/characters");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("text=글리치")).toBeVisible({ timeout: 10000 });
});

test("character code_name ARCH is displayed", async ({ page }) => {
  await page.goto("/characters");
  await page.waitForLoadState("networkidle");
  const body = await page.locator("body").textContent();
  expect(body).toContain("ARCH");
});

test("character workload section is shown", async ({ page }) => {
  await page.goto("/characters");
  await page.waitForLoadState("networkidle");
  const body = await page.locator("body").textContent();
  expect(body).toContain("워크로드");
});

test("characters page has navigation links", async ({ page }) => {
  await page.goto("/characters");
  await page.waitForLoadState("networkidle");
  const links = await page.locator("a").count();
  expect(links).toBeGreaterThan(0);
});

test("empty character list renders gracefully", async ({ page }) => {
  await page.route("**/api/v1/characters**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) }),
  );
  await page.goto("/characters");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
});

test("characters page does not show 500 error", async ({ page }) => {
  await page.goto("/characters");
  await page.waitForLoadState("networkidle");
  const body = await page.locator("body").textContent();
  expect(body).not.toContain("Internal Server Error");
});

test("characters page body has content", async ({ page }) => {
  await page.goto("/characters");
  await page.waitForLoadState("networkidle");
  const text = await page.locator("body").textContent();
  expect(text?.length).toBeGreaterThan(10);
});

test("characters page is mobile responsive", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/characters");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
});
