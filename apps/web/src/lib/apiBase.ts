const DEFAULT_API_ORIGIN = "http://localhost:4000";

export function getApiBase(): string {
  const raw = process.env["NEXT_PUBLIC_API_URL"] ?? `${DEFAULT_API_ORIGIN}/api/v1`;
  const trimmed = raw.replace(/\/+$/, "");

  if (trimmed.endsWith("/api/v1")) {
    return trimmed;
  }

  return `${trimmed}/api/v1`;
}
