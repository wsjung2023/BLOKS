/**
 * bloks-os start
 * 프로파일에 맞는 서비스 시작 + 준비 완료 시 브라우저 자동 오픈
 */
import { spawn, exec } from "node:child_process";
import { existsSync, readFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { ok, warn, info, fail, sep, c } from "../index.js";

const ROOT = join(import.meta.dirname, "../../../..");
const WEB_PORT = 3000;
const WEB_URL = `http://localhost:${WEB_PORT}`;
const READY_POLL_INTERVAL_MS = 1500;
const READY_TIMEOUT_MS = 60_000;

function readEnvVar(key: string): string | undefined {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return process.env[key];
  const lines = readFileSync(envPath, "utf-8").split("\n");
  const line = lines.find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : process.env[key];
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) warn(`브라우저 자동 오픈 실패 — 수동으로 ${url} 를 열어주세요.`);
  });
}

async function waitForWeb(): Promise<boolean> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(WEB_URL, { signal: AbortSignal.timeout(1000) });
      if (res.ok || res.status === 307 || res.status === 200) return true;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, READY_POLL_INTERVAL_MS));
  }
  return false;
}

function spawnDev(profile: string): ReturnType<typeof spawn> {
  const child = spawn("pnpm", ["dev"], {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, BLOKS_PROFILE: profile },
  });

  child.on("error", (err) => {
    fail(`프로세스 시작 실패: ${err.message}`);
    process.exit(1);
  });

  child.on("exit", (code) => {
    if (code !== 0) fail(`프로세스 종료 (코드 ${code ?? "알 수 없음"})`);
  });

  process.on("SIGINT", () => {
    child.kill("SIGINT");
  });

  return child;
}

export async function start(args: string[]): Promise<void> {
  const profile = args.find((a) => a.startsWith("--profile="))?.split("=")[1]
    ?? readEnvVar("BLOKS_PROFILE")
    ?? "local";

  sep();
  info(`실행 프로파일: ${c.bold}${profile}${c.reset}`);

  if (!existsSync(join(ROOT, ".env"))) {
    const examplePath = join(ROOT, ".env.example");
    if (existsSync(examplePath)) {
      copyFileSync(examplePath, join(ROOT, ".env"));
      ok(".env 파일이 없어 .env.example 기본값으로 자동 생성했습니다.");
      info("AI 기능이 필요하면 .env 파일에 API 키를 추가하거나 'pnpm bloks-os init' 을 실행하세요.");
    } else {
      warn(".env 파일이 없습니다. 먼저 'pnpm bloks-os init' 을 실행하세요.");
      process.exit(1);
    }
  }

  if (profile !== "local") {
    const required = ["REDIS_URL"];
    const missing = required.filter((k) => !readEnvVar(k));
    if (missing.length > 0) {
      fail(`연결 모드에 필요한 환경 변수가 없습니다: ${missing.join(", ")}`);
      info("'bloks-os init' 으로 다시 설정하거나 .env 를 직접 수정하세요.");
      process.exit(1);
    }
    info("연결 모드 — Redis 를 사용합니다.");
  } else {
    info("로컬 모드 — Redis 없이 시작합니다.");
  }

  console.log();
  spawnDev(profile);
  ok("서비스 시작됨. Ctrl+C 로 종료합니다.");

  // 브라우저 자동 오픈 — 웹 서버가 응답할 때까지 폴링 후 열기
  info(`웹 서버 준비 대기 중... (${WEB_URL})`);
  const ready = await waitForWeb();
  if (ready) {
    ok(`웹 서버 준비 완료 — 브라우저 오픈: ${c.cyan}${WEB_URL}${c.reset}`);
    openBrowser(WEB_URL);
  } else {
    warn(`웹 서버 ${READY_TIMEOUT_MS / 1000}초 내 응답 없음 — 수동으로 ${WEB_URL} 를 여세요.`);
  }
}
