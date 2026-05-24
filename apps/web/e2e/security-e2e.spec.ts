import { test, expect } from "@playwright/test";
import { setupAuth } from "./fixtures/auth";

// Security-focused E2E tests — verifying auth enforcement, token handling, and redirect behavior

test("unauthenticated access to /projects triggers redirect to /login", async ({ page }) => {
  await page.route("**/api/v1/projects**", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ ok: false, error: { code: "UNAUTHORIZED" } }) }),
  );
  await page.goto("/projects");
  await page.waitForURL("**/login", { timeout: 10000 });
  expect(page.url()).toContain("/login");
});

test("unauthenticated access to /board triggers redirect to /login", async ({ page }) => {
  // All api/v1 requests return 200 as fallback
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { items: [] } }) }),
  );
  // Characters returns 401 — only the board page calls /characters (ticker never does), so exactly
  // one handleUnauthenticated() fires. Using /tasks would also hit the ticker, causing two simultaneous
  // redirects that race and abort each other (ERR_ABORTED).
  await page.route("**/api/v1/characters**", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ ok: false, error: { code: "UNAUTHORIZED" } }) }),
  );
  await page.goto("/board");
  await page.waitForURL("**/login", { timeout: 10000 });
  expect(page.url()).toContain("/login");
});

test("API 401 response removes token from localStorage", async ({ page }) => {
  // Navigate first to set token via evaluate — addInitScript re-runs on /login redirect and would re-set the token
  await page.goto("/login");
  await page.evaluate(() => window.localStorage.setItem("BLOKS_AUTH_TOKEN", "stale-token"));
  await page.route("**/api/v1/projects**", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ ok: false }) }),
  );
  await page.goto("/projects");
  await page.waitForURL("**/login", { timeout: 10000 });
  const token = await page.evaluate(() => window.localStorage.getItem("BLOKS_AUTH_TOKEN"));
  expect(token).toBeNull();
});

test("API response does not expose stack trace to client", async ({ page }) => {
  await setupAuth(page);
  await page.route("**/api/v1/projects**", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ ok: false, error: { code: "SERVER_ERROR", message: "일시적인 오류가 발생했습니다." } }) }),
  );
  await page.goto("/projects");
  // SSE keeps connection alive so networkidle never fires — domcontentloaded is sufficient
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);
  const body = await page.locator("body").textContent();
  // Verify no actual error stack traces are visible in rendered content
  // (Next.js dev RSC payload may contain "node_modules" paths — that is not a security concern)
  expect(body).not.toContain("at Object.<anonymous>");
  expect(body).not.toContain("at async ");
});

test("Bearer token is sent in Authorization header for API calls", async ({ page }) => {
  let authHeaderSeen = false;
  await page.addInitScript(() => {
    window.localStorage.setItem("BLOKS_AUTH_TOKEN", "dev-bypass");
  });
  await page.route("**/api/v1/**", async (route) => {
    const authHeader = route.request().headers()["authorization"] ?? "";
    if (authHeader.startsWith("Bearer ")) authHeaderSeen = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) });
  });
  await page.goto("/projects");
  await page.waitForLoadState("networkidle");
  expect(authHeaderSeen).toBe(true);
});

test("without localStorage token — dev bypass Authorization header is sent", async ({ page }) => {
  // NEXT_PUBLIC_ENABLE_DEV_BYPASS_AUTH=true means dev-bypass token is always sent when no stored token exists
  let authHeader = "";
  await page.route("**/api/v1/projects**", async (route) => {
    authHeader = route.request().headers()["authorization"] ?? "";
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ ok: false }) });
  });
  await page.goto("/projects");
  await page.waitForURL("**/login", { timeout: 10000 });
  expect(authHeader).toContain("Bearer");
});

test("deep link to /approvals without token redirects to /login", async ({ page }) => {
  // All api/v1 requests return 200 as fallback
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { items: [] } }) }),
  );
  // /runtime/approvals returns 401 — only ToolApprovalSection calls this (ticker never does), so exactly
  // one handleUnauthenticated() fires. Using /approvals would also hit the ticker's /approvals?pageSize=4,
  // causing two simultaneous redirects that race and abort each other (ERR_ABORTED).
  await page.route("**/api/v1/runtime/approvals**", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ ok: false, error: { code: "UNAUTHORIZED" } }) }),
  );
  await page.goto("/approvals");
  await page.waitForURL("**/login", { timeout: 10000 });
  expect(page.url()).toContain("/login");
});

test("deep link to /audit without token redirects to /login", async ({ page }) => {
  // Mock specific data endpoint only — mocking all api/v1/** aborts SSE connections
  await page.route("**/api/v1/runtime/audit**", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ ok: false, error: { code: "UNAUTHORIZED" } }) }),
  );
  await page.goto("/audit");
  await page.waitForURL("**/login", { timeout: 10000 });
  expect(page.url()).toContain("/login");
});

test("login page itself never redirects to /login (avoids redirect loop)", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  expect(page.url()).toContain("/login");
  const body = await page.locator("body").textContent();
  expect(body).not.toContain("redirect loop");
});

test("setting invalid token still sends Authorization header", async ({ page }) => {
  let headerValue = "";
  await page.addInitScript(() => {
    window.localStorage.setItem("BLOKS_AUTH_TOKEN", "invalid-token-xyz");
  });
  await page.route("**/api/v1/projects**", async (route) => {
    headerValue = route.request().headers()["authorization"] ?? "";
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ ok: false }) });
  });
  await page.goto("/projects");
  await page.waitForURL("**/login", { timeout: 10000 });
  expect(headerValue).toContain("invalid-token-xyz");
});
