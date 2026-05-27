/**
 * Runtime profile — always "local" (in-memory DB, no external dependencies).
 * Set BLOKS_PROFILE=connected for legacy connected mode (deprecated).
 */
export type RuntimeProfile = "local" | "connected";

export function getRuntimeProfile(): RuntimeProfile {
  const explicit = process.env["BLOKS_PROFILE"];
  if (explicit === "connected") return "connected";
  return "local";
}
