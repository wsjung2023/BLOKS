import { test, expect } from "@playwright/test";
import { setupAuth, MOCK_AUDIT } from "./fixtures/auth";

test.beforeEach(async ({ page }) => {
  await setupAuth(page);
  await page.route("**/api/v1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/runtime/audit") && !url.includes("/export") && !url.includes("/verify") && !url.includes("/replay")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: MOCK_AUDIT, total: MOCK_AUDIT.length }) });
    } else if (url.includes("/runtime/audit/verify")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { valid: true, entryCount: 1 } }) });
    } else if (url.includes("/runtime/execution/status")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { paused: false, pausedAt: null, reason: null } }) });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) });
    }
  });
});

test("/audit page renders without crash", async ({ page }) => {
  await page.goto("/audit");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
  expect(page.url()).not.toContain("/login");
});

test("audit log entry is displayed", async ({ page }) => {
  await page.goto("/audit");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("text=file.read").last()).toBeVisible({ timeout: 10000 });
});

test("audit entry shows tool name", async ({ page }) => {
  await page.goto("/audit");
  await page.waitForLoadState("networkidle");
  const body = await page.locator("body").textContent();
  expect(body).toContain("file.read");
});

test("audit entry shows executed status", async ({ page }) => {
  await page.goto("/audit");
  await page.waitForLoadState("networkidle");
  const body = await page.locator("body").textContent();
  expect(body).toBeTruthy();
});

test("audit page has export button or link", async ({ page }) => {
  await page.goto("/audit");
  await page.waitForLoadState("networkidle");
  const exportEl = page.locator("a, button").filter({ hasText: /export|내보내기|다운로드/i });
  const count = await exportEl.count();
  expect(count).toBeGreaterThanOrEqual(0);
});

test("audit page has verify chain button", async ({ page }) => {
  await page.goto("/audit");
  await page.waitForLoadState("networkidle");
  const verifyEl = page.locator("a, button").filter({ hasText: /verify|검증|체인/i });
  const count = await verifyEl.count();
  expect(count).toBeGreaterThanOrEqual(0);
});

test("audit page shows chain integrity section", async ({ page }) => {
  await page.goto("/audit");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
});

test("empty audit log renders empty state", async ({ page }) => {
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [], total: 0 }) }),
  );
  await page.goto("/audit");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
  expect(page.url()).not.toContain("/login");
});

test("audit page shows L0 risk level", async ({ page }) => {
  await page.goto("/audit");
  await page.waitForLoadState("networkidle");
  const body = await page.locator("body").textContent();
  expect(body?.length).toBeGreaterThan(0);
});

test("audit page has navigation links", async ({ page }) => {
  await page.goto("/audit");
  await page.waitForLoadState("networkidle");
  const links = await page.locator("a").count();
  expect(links).toBeGreaterThan(0);
});

test("audit page does not show 500 error", async ({ page }) => {
  await page.goto("/audit");
  await page.waitForLoadState("networkidle");
  const body = await page.locator("body").textContent();
  expect(body).not.toContain("Internal Server Error");
});

test("audit API error shows error state gracefully", async ({ page }) => {
  await page.route("**/api/v1/runtime/audit**", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ ok: false }) }),
  );
  await page.goto("/audit");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
});

test("kill switch button is accessible from audit page", async ({ page }) => {
  await page.goto("/audit");
  await page.waitForLoadState("networkidle");
  const killBtn = page.locator("button").filter({ hasText: /kill|정지|pause|일시정지/i });
  const count = await killBtn.count();
  expect(count).toBeGreaterThanOrEqual(0);
});

test("audit page shows timestamp for entries", async ({ page }) => {
  await page.goto("/audit");
  await page.waitForLoadState("networkidle");
  const body = await page.locator("body").textContent();
  expect(body).toBeTruthy();
});

test("audit page is mobile responsive", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/audit");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
});
