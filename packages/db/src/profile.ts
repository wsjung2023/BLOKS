/**
 * Runtime profile determines which infrastructure stack is active.
 *
 * local     — no external deps; SQLite/in-memory + in-process queue.
 *             Default when SUPABASE_URL is absent or BLOKS_PROFILE=local.
 * connected — Supabase. For team/cloud use.
 */
export type RuntimeProfile = "local" | "connected";

export function getRuntimeProfile(): RuntimeProfile {
  const explicit = process.env["BLOKS_PROFILE"];
  if (explicit === "connected") return "connected";
  // Default to local — no external dependencies required.
  // Set BLOKS_PROFILE=connected to enable Supabase.
  return "local";
}
