#!/usr/bin/env node
/**
 * Adds missing columns to the tasks table in Supabase.
 * Run: node tools/add-missing-columns.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function main() {
  // Check which columns already exist
  const { data: cols, error: colErr } = await sb
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_name", "tasks")
    .eq("table_schema", "public");

  if (colErr) {
    console.error("Cannot read information_schema:", colErr.message);
    process.exit(1);
  }

  const existing = new Set(cols.map((c) => c.column_name));
  console.log("Existing tasks columns:", [...existing].sort().join(", "));

  const missing = [];
  if (!existing.has("feedback_history")) missing.push("feedback_history");
  if (!existing.has("revision_count")) missing.push("revision_count");

  if (missing.length === 0) {
    console.log("✓ All columns already exist.");
    return;
  }

  console.log("Missing columns:", missing.join(", "));

  // Supabase REST API doesn't support DDL directly — use rpc if available,
  // otherwise print the SQL to run manually.
  const sql = missing.map((col) => {
    if (col === "feedback_history") return `ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS feedback_history JSONB DEFAULT '[]'::jsonb;`;
    if (col === "revision_count") return `ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS revision_count INTEGER DEFAULT 0;`;
    return "";
  }).filter(Boolean).join("\n");

  console.log("\nSQL to run in Supabase SQL Editor:\n");
  console.log(sql);
  console.log("\nAttempting via Supabase rpc exec_sql (if available)...");

  const { error: rpcErr } = await sb.rpc("exec_sql", { sql });
  if (rpcErr) {
    console.log("rpc exec_sql not available:", rpcErr.message);
    console.log("\n→ Please run the SQL above in your Supabase project SQL Editor.");
    console.log("  https://supabase.com/dashboard → SQL Editor");
  } else {
    console.log("✓ Columns added via rpc.");
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
