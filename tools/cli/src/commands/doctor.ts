/**
 * bloks-os doctor
 * 환경 진단: Node 버전, .env, 포트 리스닝, Redis/Supabase 연결
 *
 * --export[=path]  진단 결과를 JSON 번들로 저장 (기본 파일명: bloks-diagnostics-<ts>.json)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import { join } from "node:path";
import { ok, warn, fail, info, sep, c } from "../index.js";

const ROOT = join(import.meta.dirname, "../../../..");

// Sensitive env var names whose values should be masked in the export
const SENSITIVE_KEYS = new Set([
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "DATABASE_URL",
  "REDIS_URL",
  "JWT_SECRET",
  "SECRET_KEY",
]);

function readEnvFile(): Record<string, string> {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return {};
  const result: Record<string, string> = {};
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const [key, ...rest] = line.split("=");
    if (key && rest.length > 0) result[key.trim()] = rest.join("=").trim();
  }
  return result;
}

function checkPort(host: string, port: number, timeoutMs = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection({ host, port });
    const timer = setTimeout(() => { sock.destroy(); resolve(false); }, timeoutMs);
    sock.on("connect", () => { clearTimeout(timer); sock.destroy(); resolve(true); });
    sock.on("error", () => { clearTimeout(timer); resolve(false); });
  });
}

function maskEnvForExport(env: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).map(([k, v]) => [k, SENSITIVE_KEYS.has(k) ? "[REDACTED]" : v]),
  );
}

export async function doctor(args: string[]): Promise<void> {
  const exportArg = args.find((a) => a === "--export" || a.startsWith("--export="));
  const doExport = exportArg !== undefined;
  const exportPath = exportArg?.includes("=")
    ? exportArg.split("=")[1]!
    : join(ROOT, `bloks-diagnostics-${Date.now()}.json`);

  console.log(`\n${c.bold}환경 진단 시작${c.reset}\n`);

  const env = readEnvFile();
  const profile = env["BLOKS_PROFILE"] ?? "local";
  let issues = 0;

  const bundle: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    nodeVersion: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    profile,
    env: maskEnvForExport(env),
    checks: [] as unknown[],
  };
  const checks = bundle["checks"] as Record<string, unknown>[];

  // ── 1. Node.js 버전 ──
  sep();
  const nodeVer = process.versions.node;
  const [major] = nodeVer.split(".").map(Number);
  if ((major ?? 0) >= 20) {
    ok(`Node.js v${nodeVer} (>= 20 ✓)`);
    checks.push({ check: "node_version", status: "ok", detail: nodeVer });
  } else {
    fail(`Node.js v${nodeVer} — 20+ 필요`);
    info("https://nodejs.org 에서 최신 LTS 설치");
    checks.push({ check: "node_version", status: "fail", detail: nodeVer });
    issues++;
  }

  // ── 2. .env 파일 ──
  sep();
  const envPath = join(ROOT, ".env");
  if (existsSync(envPath)) {
    ok(".env 파일 존재");
    checks.push({ check: "env_file", status: "ok" });
  } else {
    fail(".env 파일 없음 — 'bloks-os init' 실행 필요");
    checks.push({ check: "env_file", status: "fail" });
    issues++;
  }

  // ── 3. 프로파일 확인 ──
  info(`현재 프로파일: ${c.bold}${profile}${c.reset}`);

  // ── 4. 필수 환경변수 ──
  sep();
  console.log(`${c.bold}환경 변수 확인${c.reset}`);

  const localRequired = ["PORT"];
  const connectedRequired = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "REDIS_URL"];

  for (const key of localRequired) {
    if (env[key]) {
      ok(`${key}=${env[key]}`);
      checks.push({ check: `env_var:${key}`, status: "ok" });
    } else {
      warn(`${key} 미설정 (기본값 사용)`);
      checks.push({ check: `env_var:${key}`, status: "warn", detail: "using default" });
    }
  }

  if (profile === "connected") {
    for (const key of connectedRequired) {
      if (env[key]) {
        ok(`${key} 설정됨`);
        checks.push({ check: `env_var:${key}`, status: "ok" });
      } else {
        fail(`${key} 미설정 — 연결 모드에 필수`);
        checks.push({ check: `env_var:${key}`, status: "fail" });
        issues++;
      }
    }
  }

  if (env["OPENAI_API_KEY"]) {
    ok("OPENAI_API_KEY 설정됨 (AI 기능 활성화)");
    checks.push({ check: "env_var:OPENAI_API_KEY", status: "ok" });
  } else {
    warn("OPENAI_API_KEY 미설정 — AI 기능 비활성화 (툴/결재/감사는 동작)");
    checks.push({ check: "env_var:OPENAI_API_KEY", status: "warn" });
  }

  // ── 5. 포트 리스닝 확인 ──
  sep();
  console.log(`${c.bold}서비스 포트 확인${c.reset}`);

  const apiPort = Number(env["PORT"] ?? 4000);
  const webPort = 3000;

  const [apiUp, webUp] = await Promise.all([
    checkPort("127.0.0.1", apiPort),
    checkPort("127.0.0.1", webPort),
  ]);

  if (apiUp) { ok(`API 서버 (${apiPort}) 응답 중`); checks.push({ check: "port:api", status: "ok", port: apiPort }); }
  else { warn(`API 서버 (${apiPort}) 응답 없음 — 'bloks-os start' 로 시작`); checks.push({ check: "port:api", status: "warn", port: apiPort }); }

  if (webUp) { ok(`웹 서버 (${webPort}) 응답 중`); checks.push({ check: "port:web", status: "ok", port: webPort }); }
  else { warn(`웹 서버 (${webPort}) 응답 없음`); checks.push({ check: "port:web", status: "warn", port: webPort }); }

  // ── 6. Redis 연결 (연결 모드) ──
  if (profile === "connected" && env["REDIS_URL"]) {
    sep();
    console.log(`${c.bold}Redis 연결 확인${c.reset}`);
    try {
      const url = new URL(env["REDIS_URL"]);
      const redisPort = Number(url.port || 6379);
      const redisHost = url.hostname;
      const redisUp = await checkPort(redisHost, redisPort);
      if (redisUp) {
        ok(`Redis (${redisHost}:${redisPort}) 연결 가능`);
        checks.push({ check: "redis", status: "ok", host: redisHost, port: redisPort });
      } else {
        fail(`Redis (${redisHost}:${redisPort}) 연결 실패`);
        checks.push({ check: "redis", status: "fail", host: redisHost, port: redisPort });
        issues++;
      }
    } catch {
      fail("REDIS_URL 파싱 실패");
      checks.push({ check: "redis", status: "fail", detail: "URL parse error" });
      issues++;
    }
  }

  // ── 결과 요약 ──
  sep();
  bundle["issueCount"] = issues;
  if (issues === 0) {
    console.log(`\n${c.green}${c.bold}모든 진단 통과!${c.reset}\n`);
  } else {
    console.log(`\n${c.yellow}${c.bold}문제 ${issues}건 발견${c.reset} — 위 안내를 참고하세요.\n`);
  }

  // ── 내보내기 ──
  if (doExport) {
    writeFileSync(exportPath, JSON.stringify(bundle, null, 2), "utf-8");
    ok(`진단 번들 저장됨: ${c.cyan}${exportPath}${c.reset}`);
  }
}
