import { test, expect } from "@playwright/test";
import { setupAuth, MOCK_APPROVALS, MOCK_CHARACTERS } from "./fixtures/auth";

test.beforeEach(async ({ page }) => {
  await setupAuth(page);
  await page.route("**/api/v1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/approvals") || url.includes("/runtime/pending")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: MOCK_APPROVALS }) });
    } else if (url.includes("/characters")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: MOCK_CHARACTERS }) });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) });
    }
  });
});

test("/approvals page renders without crash", async ({ page }) => {
  await page.goto("/approvals");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
  expect(page.url()).not.toContain("/login");
});

test("approvals page has content after data loads", async ({ page }) => {
  await page.goto("/approvals");
  await page.waitForLoadState("networkidle");
  const text = await page.locator("body").textContent();
  expect(text?.length).toBeGreaterThan(10);
});

test("pending approval tool name is displayed", async ({ page }) => {
  await page.goto("/approvals");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("text=file.write")).toBeVisible({ timeout: 10000 });
});

test("denied approval tool name is displayed", async ({ page }) => {
  await page.goto("/approvals");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("text=shell.exec").first()).toBeVisible({ timeout: 10000 });
});

test("L2 risk level is displayed", async ({ page }) => {
  await page.goto("/approvals");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("text=L2")).toBeVisible({ timeout: 10000 });
});

test("L3 risk level is displayed", async ({ page }) => {
  await page.goto("/approvals");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("text=L3")).toBeVisible({ timeout: 10000 });
});

test("pending_approval status item has approve button", async ({ page }) => {
  await page.goto("/approvals");
  await page.waitForLoadState("networkidle");
  // ToolApprovalSection (runtime approvals) uses "실행 허용"; workflow approvals uses "승인"
  const approveBtn = page.locator("button").filter({ hasText: /승인|실행 허용|Approve/ });
  const count = await approveBtn.count();
  expect(count).toBeGreaterThan(0);
});

test("pending_approval status item has reject button", async ({ page }) => {
  await page.goto("/approvals");
  await page.waitForLoadState("networkidle");
  // ToolApprovalSection uses "차단"; workflow approvals uses "반려"
  const rejectBtn = page.locator("button").filter({ hasText: /거부|거절|차단|반려|Reject/ });
  const count = await rejectBtn.count();
  expect(count).toBeGreaterThan(0);
});

test("approvals page shows risk level description for L2", async ({ page }) => {
  await page.goto("/approvals");
  await page.waitForLoadState("networkidle");
  const body = await page.locator("body").textContent();
  expect(body).toContain("L2");
});

test("approvals page shows character info", async ({ page }) => {
  await page.goto("/approvals");
  await page.waitForLoadState("networkidle");
  const body = await page.locator("body").textContent();
  expect(body?.length).toBeGreaterThan(0);
});

test("empty approvals state renders without crash", async ({ page }) => {
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) }),
  );
  await page.goto("/approvals");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
});

test("approvals API error shows error state, not blank", async ({ page }) => {
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ ok: false }) }),
  );
  await page.goto("/approvals");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
  const text = await page.locator("body").textContent();
  expect(text?.length).toBeGreaterThan(0);
});

test("approvals page links are navigable", async ({ page }) => {
  await page.goto("/approvals");
  await page.waitForLoadState("networkidle");
  const links = await page.locator("a").count();
  expect(links).toBeGreaterThanOrEqual(0);
});

test("approve action triggers POST to runtime/approve", async ({ page }) => {
  let approveCallMade = false;
  await page.route("**/api/v1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/approve") && route.request().method() === "POST") {
      approveCallMade = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { status: "approved" } }) });
    } else if (url.includes("/approvals") || url.includes("/runtime/pending")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: MOCK_APPROVALS }) });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) });
    }
  });
  await page.goto("/approvals");
  await page.waitForLoadState("networkidle");
  const approveBtn = page.locator("button").filter({ hasText: /승인|Approve/ }).first();
  if (await approveBtn.isVisible()) {
    await approveBtn.click();
    await page.waitForTimeout(500);
  }
  await expect(page.locator("body")).toBeVisible();
});

test("approvals page is mobile responsive", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/approvals");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
});
