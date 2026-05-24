import { test, expect } from "@playwright/test";
import { setupAuth, MOCK_PROJECTS } from "./fixtures/auth";

// ── Login page UI ─────────────────────────────────────────────────────────────

test("login page renders with Founder 로그인 heading", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("h1")).toContainText("Founder 로그인");
});

test("login page has email input", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator('input[type="email"]')).toBeVisible();
});

test("login page has password input", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test("login page has submit button", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator('button[type="submit"]')).toBeVisible();
});

test("login page form is present", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("form")).toBeVisible();
});

// ── Login flow ────────────────────────────────────────────────────────────────

test("failed login shows error message", async ({ page }) => {
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ ok: false }) }),
  );
  await page.goto("/login");
  await page.fill('input[type="email"]', "bad@example.com");
  await page.fill('input[type="password"]', "wrongpassword");
  await page.click('button[type="submit"]');
  await expect(page.locator("text=실패")).toBeVisible({ timeout: 5000 });
});

test("successful login navigates away from /login", async ({ page }) => {
  // Register generic route FIRST (lower priority in LIFO), specific route SECOND (wins)
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) }),
  );
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { token: "test-token-123" } }) }),
  );
  await page.goto("/login");
  await page.fill('input[type="email"]', "user@example.com");
  await page.fill('input[type="password"]', "password123");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 10000 });
  expect(page.url()).not.toContain("/login");
});

// ── Auth bypass ───────────────────────────────────────────────────────────────

test("dev bypass token in localStorage allows access to /projects", async ({ page }) => {
  await setupAuth(page);
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: MOCK_PROJECTS }) }),
  );
  await page.goto("/projects");
  await expect(page.locator("body")).not.toContainText("UNAUTHORIZED");
});

test("dev bypass token allows access to /approvals", async ({ page }) => {
  await setupAuth(page);
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) }),
  );
  await page.goto("/approvals");
  await expect(page.locator("body")).toBeVisible();
  expect(page.url()).not.toContain("/login");
});

test("dev bypass token allows access to /audit", async ({ page }) => {
  await setupAuth(page);
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) }),
  );
  await page.goto("/audit");
  await expect(page.locator("body")).toBeVisible();
  expect(page.url()).not.toContain("/login");
});

// ── Unauthenticated redirect ──────────────────────────────────────────────────

test("API 401 response triggers redirect to /login", async ({ page }) => {
  // Pattern needs ** to match query params like /projects?limit=50
  await page.route("**/api/v1/projects**", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ ok: false, error: { code: "UNAUTHORIZED" } }) }),
  );
  await page.goto("/projects");
  await page.waitForURL("**/login", { timeout: 10000 });
  expect(page.url()).toContain("/login");
});

test("API 401 clears BLOKS_AUTH_TOKEN from localStorage", async ({ page }) => {
  // Navigate first so we can set localStorage via evaluate (addInitScript re-runs on every navigation including /login redirect)
  await page.goto("/login");
  await page.evaluate(() => window.localStorage.setItem("BLOKS_AUTH_TOKEN", "expired-token"));
  await page.route("**/api/v1/projects**", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ ok: false }) }),
  );
  await page.goto("/projects");
  await page.waitForURL("**/login", { timeout: 10000 });
  const token = await page.evaluate(() => window.localStorage.getItem("BLOKS_AUTH_TOKEN"));
  expect(token).toBeNull();
});

// ── Home redirect ─────────────────────────────────────────────────────────────

test("home page / redirects to /world", async ({ page }) => {
  await setupAuth(page);
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) }),
  );
  await page.goto("/");
  await expect(page).toHaveURL(/\/world/);
});

test("token is readable from localStorage after setupAuth", async ({ page }) => {
  await setupAuth(page);
  await page.goto("/login");
  const token = await page.evaluate(() => window.localStorage.getItem("BLOKS_AUTH_TOKEN"));
  expect(token).toBe("dev-bypass");
});

test("login page email label is visible", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("text=Email")).toBeVisible();
});
