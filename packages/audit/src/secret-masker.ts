/**
 * Redacts common secret patterns from strings and objects before they are
 * written to the audit log or returned in API responses.
 *
 * Covers: OpenAI API keys, Supabase service role keys, generic Bearer tokens,
 * and env-var assignment syntax for known sensitive variable names.
 */

const REDACTED = "[REDACTED]";

export function maskSecrets(value: string): string {
  let result = value;
  // OpenAI keys: sk-proj-..., sk-...
  result = result.replace(/\bsk-[A-Za-z0-9\-_]{20,}/g, REDACTED);
  // Generic Bearer tokens
  result = result.replace(/\bBearer\s+[A-Za-z0-9\-_.+/=]{10,}/g, `Bearer ${REDACTED}`);
  // Environment variable assignments for known sensitive names
  result = result.replace(
    /\b(OPENAI_API_KEY|ANTHROPIC_API_KEY|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ANON_KEY|DATABASE_URL|REDIS_URL|JWT_SECRET|SECRET_KEY|PRIVATE_KEY|API_KEY|ACCESS_TOKEN|REFRESH_TOKEN)=\S+/g,
    (_match, varName: string) => `${varName}=${REDACTED}`,
  );
  // Base64-ish values longer than 40 chars following a colon or equals (heuristic)
  result = result.replace(/([:|=])\s*[A-Za-z0-9+/]{40,}={0,2}/g, `$1 ${REDACTED}`);
  return result;
}

/**
 * Recursively masks secret patterns in all string leaves of an object.
 * Returns a new object — does not mutate the original.
 */
export function maskSecretsInObject(obj: unknown): unknown {
  if (typeof obj === "string") return maskSecrets(obj);
  if (Array.isArray(obj)) return obj.map(maskSecretsInObject);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, maskSecretsInObject(v)]),
    );
  }
  return obj;
}
