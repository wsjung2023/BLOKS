import { existsSync, copyFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const examplePath = join(root, ".env.example");

if (!existsSync(envPath)) {
  if (existsSync(examplePath)) {
    copyFileSync(examplePath, envPath);
    console.log("✓ .env 파일이 없어 .env.example 기본값으로 자동 생성했습니다.");
    console.log("  AI 기능이 필요하면 .env 파일에 API 키를 추가하세요.");
  } else {
    console.warn("⚠ .env.example 파일이 없습니다. .env를 직접 만들어야 합니다.");
  }
}
