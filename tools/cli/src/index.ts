#!/usr/bin/env node
/**
 * BLOKS OS CLI
 * Usage:
 *   bloks-os init      — 최초 설정 마법사
 *   bloks-os start     — 서비스 시작
 *   bloks-os doctor    — 환경 진단
 *   bloks-os upgrade   — 업데이트 확인
 */

import { init } from "./commands/init.js";
import { start } from "./commands/start.js";
import { doctor } from "./commands/doctor.js";
import { upgrade } from "./commands/upgrade.js";

// ── ANSI 색상 유틸 ──────────────────────────────────────────────────────────

export const c = {
  reset: "\x1b[0m",
  bold:  "\x1b[1m",
  dim:   "\x1b[2m",
  green: "\x1b[32m",
  yellow:"\x1b[33m",
  red:   "\x1b[31m",
  cyan:  "\x1b[36m",
  white: "\x1b[37m",
  gray:  "\x1b[90m",
};

export function ok(msg: string)   { console.log(`${c.green}✓${c.reset} ${msg}`); }
export function warn(msg: string) { console.log(`${c.yellow}⚠${c.reset} ${msg}`); }
export function fail(msg: string) { console.log(`${c.red}✗${c.reset} ${msg}`); }
export function info(msg: string) { console.log(`${c.cyan}→${c.reset} ${msg}`); }
export function sep()             { console.log(`${c.gray}${"─".repeat(50)}${c.reset}`); }

// ── 버전 ─────────────────────────────────────────────────────────────────────

const VERSION = "0.1.0";

function printBanner() {
  console.log(`\n${c.bold}${c.cyan}BLOKS OS${c.reset} v${VERSION} — Local-First Agent OS\n`);
}

function printHelp() {
  printBanner();
  console.log(`${c.bold}사용법:${c.reset}`);
  console.log(`  bloks-os ${c.cyan}init${c.reset}       최초 설정 마법사 실행`);
  console.log(`  bloks-os ${c.cyan}start${c.reset}      서비스 시작`);
  console.log(`  bloks-os ${c.cyan}doctor${c.reset}     환경 진단 및 수정 안내`);
  console.log(`  bloks-os ${c.cyan}upgrade${c.reset}    업데이트 확인\n`);
  console.log(`${c.bold}옵션:${c.reset}`);
  console.log(`  --profile=local|connected   실행 프로파일 지정 (기본: local)`);
  console.log(`  --port=N                    포트 지정`);
  console.log(`  --help, -h                  도움말\n`);
}

// ── 메인 ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === "--help" || command === "-h") {
  printHelp();
  process.exit(0);
}

printBanner();

switch (command) {
  case "init":    await init(args.slice(1));    break;
  case "start":   await start(args.slice(1));   break;
  case "doctor":  await doctor(args.slice(1));  break;
  case "upgrade": await upgrade(args.slice(1)); break;
  default:
    fail(`알 수 없는 명령: ${command}`);
    info("bloks-os --help 로 사용법을 확인하세요.");
    process.exit(1);
}
