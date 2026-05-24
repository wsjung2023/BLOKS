/**
 * bloks-os autostart enable | disable | status
 *
 * Windows : %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\ 에 .vbs 스크립트 등록
 * macOS   : ~/Library/LaunchAgents/com.bloks.dev.plist 등록
 */

import { existsSync, writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";
import { ok, warn, fail, info, sep, c } from "../index.js";

const ROOT = resolve(join(import.meta.dirname, "../../../.."));
const IS_WIN = process.platform === "win32";
const IS_MAC = process.platform === "darwin";

// ── Windows: Startup 폴더 경로 ───────────────────────────────────────────────

function winStartupDir(): string {
  const appData = process.env["APPDATA"] ?? join(process.env["USERPROFILE"] ?? "C:\\Users\\User", "AppData", "Roaming");
  return join(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Startup");
}

const WIN_SCRIPT_PATH = IS_WIN ? join(winStartupDir(), "bloks-os-autostart.vbs") : "";

// ── macOS: LaunchAgent plist 경로 ────────────────────────────────────────────

const MAC_PLIST_PATH = IS_MAC
  ? join(process.env["HOME"] ?? "/tmp", "Library", "LaunchAgents", "com.bloks.dev.plist")
  : "";

// ── VBScript 생성 (터미널 창 없이 백그라운드 실행) ───────────────────────────

function buildVbs(): string {
  // pnpm의 실제 경로 찾기
  let pnpmPath = "pnpm";
  try {
    pnpmPath = execSync("where pnpm", { encoding: "utf-8" }).trim().split("\n")[0]?.trim() ?? "pnpm";
  } catch { /* pnpm이 PATH에 있으면 그냥 사용 */ }

  return `Set oShell = CreateObject("WScript.Shell")
oShell.CurrentDirectory = "${ROOT.replace(/\//g, "\\")}"
oShell.Run "cmd /c ""${pnpmPath}"" dev > ""%TEMP%\\bloks-dev.log"" 2>&1", 0, False
`;
}

// ── macOS LaunchAgent plist 생성 ─────────────────────────────────────────────

function buildPlist(): string {
  let pnpmPath = "/usr/local/bin/pnpm";
  try {
    pnpmPath = execSync("which pnpm", { encoding: "utf-8" }).trim();
  } catch { /* fallback */ }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.bloks.dev</string>
  <key>ProgramArguments</key>
  <array>
    <string>${pnpmPath}</string>
    <string>dev</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${ROOT}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>StandardOutPath</key>
  <string>${process.env["HOME"]}/Library/Logs/bloks-dev.log</string>
  <key>StandardErrorPath</key>
  <string>${process.env["HOME"]}/Library/Logs/bloks-dev.log</string>
</dict>
</plist>
`;
}

// ── 상태 확인 ─────────────────────────────────────────────────────────────────

function isEnabled(): boolean {
  if (IS_WIN) return existsSync(WIN_SCRIPT_PATH);
  if (IS_MAC) return existsSync(MAC_PLIST_PATH);
  return false;
}

// ── enable ───────────────────────────────────────────────────────────────────

function enable(): void {
  if (!IS_WIN && !IS_MAC) {
    fail("자동 시작은 Windows / macOS 에서만 지원됩니다.");
    info("Linux에서는 systemd 서비스를 직접 설정하세요.");
    return;
  }

  if (isEnabled()) {
    warn("이미 자동 시작이 등록되어 있습니다.");
    info(`bloks-os autostart disable 로 해제할 수 있습니다.`);
    return;
  }

  if (IS_WIN) {
    writeFileSync(WIN_SCRIPT_PATH, buildVbs(), "utf-8");
    ok(`자동 시작 등록 완료`);
    info(`파일: ${WIN_SCRIPT_PATH}`);
    info("PC 켤 때 백그라운드에서 BLOKS가 자동으로 시작됩니다.");
    info("시작 후 브라우저에서 http://localhost:3000 으로 접속하세요.");
  }

  if (IS_MAC) {
    writeFileSync(MAC_PLIST_PATH, buildPlist(), "utf-8");
    try {
      execSync(`launchctl load "${MAC_PLIST_PATH}"`, { stdio: "ignore" });
    } catch { /* 로그인 후 자동 로드됨 */ }
    ok(`자동 시작 등록 완료`);
    info(`파일: ${MAC_PLIST_PATH}`);
    info("로그인 시 백그라운드에서 BLOKS가 자동으로 시작됩니다.");
    info("시작 후 브라우저에서 http://localhost:3000 으로 접속하세요.");
  }
}

// ── disable ──────────────────────────────────────────────────────────────────

function disable(): void {
  if (!isEnabled()) {
    warn("자동 시작이 등록되어 있지 않습니다.");
    return;
  }

  if (IS_WIN) {
    unlinkSync(WIN_SCRIPT_PATH);
    ok("자동 시작 해제 완료");
  }

  if (IS_MAC) {
    try {
      execSync(`launchctl unload "${MAC_PLIST_PATH}"`, { stdio: "ignore" });
    } catch { /* 이미 언로드됨 */ }
    unlinkSync(MAC_PLIST_PATH);
    ok("자동 시작 해제 완료");
  }
}

// ── status ───────────────────────────────────────────────────────────────────

function status(): void {
  sep();
  if (!IS_WIN && !IS_MAC) {
    warn("Windows / macOS 에서만 지원됩니다.");
    return;
  }

  if (isEnabled()) {
    ok(`자동 시작 ${c.green}활성화${c.reset}`);
    if (IS_WIN) info(`등록 파일: ${WIN_SCRIPT_PATH}`);
    if (IS_MAC) info(`등록 파일: ${MAC_PLIST_PATH}`);
  } else {
    warn(`자동 시작 ${c.yellow}비활성화${c.reset}`);
    info("bloks-os autostart enable 로 등록하세요.");
  }
  sep();
}

// ── 진입점 ────────────────────────────────────────────────────────────────────

export async function autostart(args: string[]): Promise<void> {
  const sub = args[0];

  switch (sub) {
    case "enable":  enable();  break;
    case "disable": disable(); break;
    case "status":  status();  break;
    default:
      console.log(`\n${c.bold}자동 시작 관리${c.reset}\n`);
      console.log(`  bloks-os ${c.cyan}autostart enable${c.reset}   PC 켤 때 자동으로 시작`);
      console.log(`  bloks-os ${c.cyan}autostart disable${c.reset}  자동 시작 해제`);
      console.log(`  bloks-os ${c.cyan}autostart status${c.reset}   현재 등록 상태 확인\n`);
  }
}
