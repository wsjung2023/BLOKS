import { getSupabase } from "@bloks/db";

async function main() {
  const sb = getSupabase();

  // Check existing columns
  const { data: cols, error } = await sb
    .from("information_schema.columns" as "tasks")
    .select("column_name")
    .eq("table_name" as "id", "tasks")
    .eq("table_schema" as "id", "public");

  if (error) {
    console.error("Cannot query information_schema:", error.message);
    // information_schema might not be accessible via REST — print SQL to run manually
    printSql();
    return;
  }

  const existing = new Set((cols ?? []).map((c: Record<string, string>) => c["column_name"]));
  console.log("Found columns:", [...existing].sort().join(", ") || "(none)");

  const missing: string[] = [];
  if (!existing.has("feedback_history")) missing.push("feedback_history");
  if (!existing.has("revision_count")) missing.push("revision_count");

  if (missing.length === 0) {
    console.log("✓ Both columns already exist in tasks table.");
    return;
  }

  console.log("Missing:", missing.join(", "));
  printSql();
}

function printSql() {
  console.log(`
Run this SQL in your Supabase SQL Editor:
  https://supabase.com/dashboard/project/oslooevfngnopphducql/sql

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS feedback_history JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS revision_count   INTEGER DEFAULT 0;
`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
