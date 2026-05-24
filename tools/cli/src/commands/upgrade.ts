/**
 * bloks-os upgrade
 * 현재 버전 표시 및 pnpm install 실행
 */
import { execSync } from "node:child_process";
import { join } from "node:path";
import { ok, info, fail, sep, c } from "../index.js";

const ROOT = join(import.meta.dirname, "../../../..");
const CURRENT_VERSION = "0.1.0";

export async function upgrade(_args: string[]): Promise<void> {
  sep();
  console.log(`현재 버전: ${c.bold}v${CURRENT_VERSION}${c.reset}`);

  info("의존성 업데이트 중...");

  try {
    execSync("pnpm install", { cwd: ROOT, stdio: "inherit" });
    ok("의존성 업데이트 완료");
  } catch {
    fail("pnpm install 실패 — 수동으로 실행해주세요: pnpm install");
    process.exit(1);
  }

  sep();
  console.log(`
${c.bold}${c.green}업데이트 완료${c.reset}

변경사항이 있다면 서비스를 재시작하세요:

  ${c.cyan}bloks-os start${c.reset}
`);
}
