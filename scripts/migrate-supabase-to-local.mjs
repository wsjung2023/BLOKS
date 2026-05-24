/**
 * Supabase → local-db.json migration
 * Usage: node scripts/migrate-supabase-to-local.mjs
 *
 * Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env
 * Dumps all known tables into .bloks-data/local-db.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { createClient } from "../packages/db/node_modules/@supabase/supabase-js/dist/index.mjs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Parse .env
function readEnv() {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) throw new Error(".env not found");
  const result = {};
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    result[key] = val;
  }
  return result;
}

const env = readEnv();
const SUPABASE_URL = env["SUPABASE_URL"];
const SUPABASE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌  SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 .env에 없습니다.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLES = [
  "characters",
  "character_runtime_states",
  "character_conversations",
  "character_bubbles",
  "projects",
  "tasks",
  "artifacts",
  "event_logs",
  "approvals",
  "agent_messages",
  "prompt_templates",
  "outbox_events",
  "request_metrics",
];

async function fetchAll(table) {
  const rows = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) {
      console.warn(`  ⚠  ${table}: ${error.message}`);
      return [];
    }
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

async function main() {
  console.log(`\n🔄  Supabase → local-db 마이그레이션 시작`);
  console.log(`   URL: ${SUPABASE_URL}\n`);

  const db = {};
  for (const table of TABLES) {
    process.stdout.write(`  📦  ${table} 가져오는 중...`);
    const rows = await fetchAll(table);
    db[table] = rows;
    console.log(` ${rows.length}건`);
  }

  const DATA_DIR = join(ROOT, ".bloks-data");
  const DB_FILE = join(DATA_DIR, "local-db.json");

  mkdirSync(DATA_DIR, { recursive: true });

  // Merge with existing local-db.json (if any) — new data wins per-table
  if (existsSync(DB_FILE)) {
    console.log(`\n  ♻️  기존 local-db.json 발견 — Supabase 데이터로 덮어씁니다.`);
  }

  writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");

  const total = Object.values(db).reduce((s, r) => s + r.length, 0);
  console.log(`\n✅  완료! 총 ${total}건 → ${DB_FILE}`);

  // Summary
  for (const [table, rows] of Object.entries(db)) {
    if (rows.length > 0) {
      console.log(`   ${table}: ${rows.length}건`);
    }
  }
  console.log();
}

main().catch((err) => {
  console.error("❌ 마이그레이션 실패:", err.message);
  process.exit(1);
});
