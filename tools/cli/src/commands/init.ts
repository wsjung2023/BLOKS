/**
 * bloks-os init
 * 최초 설정 마법사: .env 생성, API 키 설정
 * 기본값: 로컬 모드 (Docker/Redis 불필요)
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

  // ── 2. .env 파일 생성 ─────────────────────────────────────────────────────
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

  // 로컬 모드 기본값
  setEnvVar("BLOKS_PROFILE", "local");
  setEnvVar("PORT", "4000");
  setEnvVar("NEXT_PUBLIC_API_URL", "http://localhost:4000/api/v1");
  setEnvVar("ENABLE_DEV_BYPASS_AUTH", "true");
  setEnvVar("NEXT_PUBLIC_ENABLE_DEV_BYPASS_AUTH", "true");
  setEnvVar("NEXT_PUBLIC_DEV_BYPASS_TOKEN", "dev-bypass");

  // ── 3. AI API 키 설정 (선택) ─────────────────────────────────────────────
  sep();
  console.log(`\n${c.bold}AI API 키 설정 (선택사항)${c.reset}`);
  console.log(`  ${c.dim}AI 키 없이도 월드 뷰, 태스크 보드, 결재, 감사 기능이 모두 동작합니다.${c.reset}`);
  console.log(`  ${c.dim}AI 캐릭터가 실제로 응답하려면 최소 하나의 키가 필요합니다.${c.reset}\n`);

  // OpenAI
  const openaiKey = await prompt("OpenAI API 키 (sk-proj-... 또는 sk-...  없으면 Enter 스킵)");
  if (openaiKey.startsWith("sk-")) {
    setEnvVar("OPENAI_API_KEY", openaiKey);
    ok("OpenAI API 키 저장됨");
  } else if (openaiKey) {
    warn("OpenAI 키 형식이 올바르지 않아 저장하지 않습니다.");
  }

  // Anthropic (Claude)
  const anthropicKey = await prompt("Anthropic API 키 (sk-ant-...  없으면 Enter 스킵)");
  if (anthropicKey.startsWith("sk-ant-")) {
    setEnvVar("ANTHROPIC_API_KEY", anthropicKey);
    ok("Anthropic(Claude) API 키 저장됨");
  } else if (anthropicKey) {
    warn("Anthropic 키 형식이 올바르지 않아 저장하지 않습니다.");
  }

  // Google AI (Gemini)
  const googleKey = await prompt("Google AI API 키 (AIza...  없으면 Enter 스킵)");
  if (googleKey.startsWith("AIza")) {
    setEnvVar("GOOGLE_AI_API_KEY", googleKey);
    ok("Google AI(Gemini) API 키 저장됨");
  } else if (googleKey) {
    warn("Google AI 키 형식이 올바르지 않아 저장하지 않습니다.");
  }

  if (!openaiKey && !anthropicKey && !googleKey) {
    info("AI 키 없이 시작합니다 — 앱 실행 후 브라우저에서 [설정] 메뉴로 언제든 추가할 수 있습니다.");
  }

  // Tavily (웹 서치)
  console.log(`\n${c.bold}실시간 웹 검색 설정 (선택사항)${c.reset}`);
  console.log(`  ${c.dim}AI가 인터넷에서 최신 정보를 찾아 결과물에 반영합니다.${c.reset}`);
  console.log(`  ${c.dim}무료 플랜: 월 1,000회 — https://app.tavily.com${c.reset}\n`);

  const tavilyKey = await prompt("Tavily 웹 검색 키 (tvly-...  없으면 Enter 스킵)");
  if (tavilyKey.startsWith("tvly-")) {
    setEnvVar("TAVILY_API_KEY", tavilyKey);
    ok("Tavily 웹 검색 키 저장됨");
  } else if (tavilyKey) {
    warn("Tavily 키 형식이 올바르지 않아 저장하지 않습니다.");
  }

  // KIE.AI (영상)
  console.log(`\n${c.bold}영상 생성 설정 (선택사항)${c.reset}`);
  console.log(`  ${c.dim}유튜브, 릴스, 쇼츠 등 AI 영상을 만들 때 필요합니다.${c.reset}`);
  console.log(`  ${c.dim}5초 영상 1개당 약 300~600원 — https://kie.ai${c.reset}\n`);

  const kieKey = await prompt("KIE.AI 영상 키 (없으면 Enter 스킵)");
  if (kieKey) {
    setEnvVar("KIE_AI_API_KEY", kieKey);
    ok("KIE.AI 영상 키 저장됨");
  }

  info("로컬 모드로 시작합니다 — 데이터는 .bloks-data/local-db.json 에 저장됩니다.");

  // ── 4. .env 저장 ──────────────────────────────────────────────────────────
  writeFileSync(envPath, envLines.filter(Boolean).join("\n") + "\n", "utf-8");
  sep();
  ok(`.env 파일 저장 완료: ${envPath}`);

  // ── 5. 완료 안내 ──────────────────────────────────────────────────────────
  console.log(`
${c.bold}${c.green}설정 완료!${c.reset}

다음 명령으로 시작하세요:

  ${c.cyan}pnpm bloks-os start${c.reset}    ${c.gray}# 서비스 시작 (브라우저 자동 오픈)${c.reset}
  ${c.cyan}pnpm bloks-os doctor${c.reset}   ${c.gray}# 환경 진단${c.reset}

${c.dim}API 키는 앱 실행 후 브라우저에서 [설정 ⚙️] 메뉴로 언제든 추가·변경할 수 있습니다.${c.reset}
`);
}
