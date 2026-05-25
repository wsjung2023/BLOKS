#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const PACK_FILE = join(ROOT, "tools", "capability-packs", "packs.json");

function run(command) {
  const isWin = process.platform === "win32";
  const cmd = isWin ? "cmd.exe" : "bash";
  const args = isWin ? ["/d", "/s", "/c", command] : ["-lc", command];
  const out = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf-8", stdio: "pipe", maxBuffer: 20 * 1024 * 1024 });
  return { ok: out.status === 0, status: out.status ?? 1, stdout: out.stdout ?? "", stderr: out.stderr ?? "" };
}

function main() {
  const json = JSON.parse(readFileSync(PACK_FILE, "utf-8"));
  const packs = Array.isArray(json.packs) ? json.packs : [];

  for (const pack of packs) {
    const cmd = `node tools/capability-packs/run-pack.mjs --pack=${pack.id}`;
    const res = run(cmd);
    if (!res.ok) {
      console.error(`[capability-packs run-all] FAIL on ${pack.id}`);
      console.error(res.stderr || res.stdout);
      process.exit(1);
    }
    process.stdout.write(res.stdout);
  }

  console.log("[capability-packs run-all] PASS");
}

main();
