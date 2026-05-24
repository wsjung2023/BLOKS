import { test, expect } from "@playwright/test";
import { setupAuth, MOCK_CHARACTERS } from "./fixtures/auth";

// Smoke tests — core paths must load without crash

test("home page / redirects to /world", async ({ page }) => {
  await setupAuth(page);
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) }),
  );
  await page.goto("/");
  await expect(page).toHaveURL(/\/world/, { timeout: 10000 });
});

test("/world page renders Phaser canvas", async ({ page }) => {
  await setupAuth(page);
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) }),
  );
  await page.goto("/world");
  await page.waitForTimeout(3000);
  const canvas = page.locator("canvas");
  await expect(canvas.first()).toBeVisible({ timeout: 10000 });
});

test("/projects page loads with auth", async ({ page }) => {
  await setupAuth(page);
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) }),
  );
  await page.goto("/projects");
  await page.waitForLoadState("networkidle");
  expect(page.url()).not.toContain("/login");
  await expect(page.locator("body")).toBeVisible();
});

test("/approvals page loads with auth", async ({ page }) => {
  await setupAuth(page);
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) }),
  );
  await page.goto("/approvals");
  await page.waitForLoadState("networkidle");
  expect(page.url()).not.toContain("/login");
  await expect(page.locator("body")).toBeVisible();
});

test("/audit page loads with auth", async ({ page }) => {
  await setupAuth(page);
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [], total: 0 }) }),
  );
  await page.goto("/audit");
  await page.waitForLoadState("networkidle");
  expect(page.url()).not.toContain("/login");
  await expect(page.locator("body")).toBeVisible();
});
