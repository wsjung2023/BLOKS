/**
 * bloks-os init
 * 최초 설정 마법사: .env 생성, 프로파일 선택, API 키 설정
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { ok, warn, info, fail, sep, c } from "../index.js";

const ROOT = join(import.meta.dirname, "../../../..");

function prompt(question: string, defaultVal = ""): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    const hint = defaultVal ? ` ${c.gray}[${defaultVal}]${c.reset}` : "";
    rl.question(`  ${question}${hint}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultVal);
    });
  });
}

function promptYN(question: string, defaultYes = true): Promise<boolean> {
  return prompt(`${question} ${defaultYes ? "(Y/n)" : "(y/N)"}`, defaultYes ? "Y" : "N")
    .then((a) => /^y/i.test(a));
}

export async function init(_args: string[]): Promise<void> {
  console.log(`${c.bold}BLOKS OS 설치 마법사${c.reset}\n`);
  sep();

  // ── 1. Node.js 버전 확인 ──────────────────────────────────────────────────
  const nodeVer = process.versions.node;
  const [major] = nodeVer.split(".").map(Number);
  if ((major ?? 0) < 20) {
    fail(`Node.js 20+ 필요 (현재: v${nodeVer})`);
    info("https://nodejs.org 에서 최신 LTS 설치 후 다시 시도하세요.");
    process.exit(1);
  }
  ok(`Node.js v${nodeVer}`);

  // ── 2. 프로파일 선택 ──────────────────────────────────────────────────────
  sep();
  console.log(`\n${c.bold}실행 프로파일 선택${c.reset}`);
  console.log(`  ${c.green}1) 로컬 모드${c.reset} (권장) — Supabase/Redis 불필요, 즉시 시작 가능`);
  console.log(`  ${c.yellow}2) 연결 모드${c.reset} — Supabase + Redis 필요, 팀 협업 지원`);
  const profileChoice = await prompt("선택", "1");
  const profile = profileChoice === "2" ? "connected" : "local";
  ok(`프로파일: ${c.bold}${profile}${c.reset}`);

  // ── 3. .env 파일 생성 ─────────────────────────────────────────────────────
  sep();
  const envPath = join(ROOT, ".env");
  const examplePath = join(ROOT, ".env.example");

  let envLines: string[] = [];
  if (existsSync(envPath)) {
    warn(".env 파일이 이미 존재합니다. 기존 값을 유지하고 누락된 항목만 추가합니다.");
    envLines = readFileSync(envPath, "utf-8").split("\n");
  } else if (existsSync(examplePath)) {
    envLines = readFileSync(examplePath, "utf-8").split("\n");
    info(".env.example 기반으로 .env 생성");
  }

  function setEnvVar(key: string, value: string) {
    const idx = envLines.findIndex((l) => l.startsWith(`${key}=`));
    const line = `${key}=${value}`;
    if (idx >= 0) {
      envLines[idx] = line;
    } else {
      envLines.push(line);
    }
  }

  // 프로파일 설정
  setEnvVar("BLOKS_PROFILE", profile);

  // ── 4. OpenAI API 키 (선택) ───────────────────────────────────────────────
  console.log(`\n${c.bold}AI 기능 설정 (선택사항)${c.reset}`);
  console.log(`  ${c.dim}AI 키 없이도 툴 실행, 결재, 감사 기능은 모두 동작합니다.${c.reset}`);
  const wantAI = await promptYN("OpenAI API 키를 지금 설정하시겠습니까?", false);
  if (wantAI) {
    const key = await prompt("OpenAI API 키 (sk-...)");
    if (key.startsWith("sk-")) {
      setEnvVar("OPENAI_API_KEY", key);
      ok("OpenAI API 키 저장됨");
    } else {
      warn("유효하지 않은 키 형식 — 나중에 .env 파일에서 직접 설정하세요.");
    }
  } else {
    info("AI 키 설정 건너뜀 — 나중에 .env에서 OPENAI_API_KEY= 로 추가 가능");
  }

  // ── 5. Supabase 설정 (연결 모드일 때만) ──────────────────────────────────
  if (profile === "connected") {
    sep();
    console.log(`\n${c.bold}Supabase 설정${c.reset}`);
    console.log(`  ${c.dim}Supabase 프로젝트 → Settings → API 에서 확인할 수 있습니다.${c.reset}`);
    const supabaseUrl = await prompt("SUPABASE_URL (Project URL)", "https://your-project.supabase.co");
    const supabaseKey = await prompt("SUPABASE_SERVICE_ROLE_KEY (service_role 키)");
    if (supabaseUrl && supabaseKey) {
      setEnvVar("SUPABASE_URL", supabaseUrl);
      setEnvVar("SUPABASE_SERVICE_ROLE_KEY", supabaseKey);
      ok("Supabase 설정 저장됨");
    }
    console.log(`\n  ${c.dim}Supabase 프로젝트 → Settings → Database → Connection string (URI) 에서 확인.${c.reset}`);
    const dbUrl = await prompt("DATABASE_URL (PostgreSQL 연결 문자열)", "postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres");
    if (dbUrl && dbUrl.startsWith("postgresql://")) {
      setEnvVar("DATABASE_URL", dbUrl);
      ok("DATABASE_URL 저장됨");
    } else {
      warn("DATABASE_URL 형식이 올바르지 않습니다 — 나중에 .env에서 직접 설정하세요.");
    }
  }

  // ── 6. 기본 포트 설정 ─────────────────────────────────────────────────────
  setEnvVar("PORT", "4000");
  setEnvVar("DAEMON_PORT", "4001");
  setEnvVar("NEXT_PUBLIC_ENABLE_DEV_BYPASS_AUTH", "true");
  setEnvVar("NEXT_PUBLIC_API_URL", "http://localhost:4000/api/v1");

  // ── 7. .env 저장 ──────────────────────────────────────────────────────────
  writeFileSync(envPath, envLines.filter(Boolean).join("\n") + "\n", "utf-8");
  sep();
  ok(`.env 파일 저장 완료: ${envPath}`);

  // ── 8. 완료 안내 ──────────────────────────────────────────────────────────
  console.log(`
${c.bold}${c.green}설정 완료!${c.reset}

다음 명령으로 시작하세요:

  ${c.cyan}pnpm bloks-os start${c.reset}    ${c.gray}# 서비스 시작${c.reset}
  ${c.cyan}pnpm bloks-os doctor${c.reset}   ${c.gray}# 환경 진단${c.reset}
`);
}
