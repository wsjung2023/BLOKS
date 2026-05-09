import { getApiBase } from "./apiBase";

const API_BASE = getApiBase();
const AUTH_TOKEN_KEY = "BLOKS_AUTH_TOKEN";

function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

const DEFAULT_RETRY_COUNT = 1;

function getAuthHeaders(): HeadersInit {
  const storedToken = getStoredAuthToken();
  if (storedToken) {
    return { Authorization: `Bearer ${storedToken}` };
  }

  if (process.env["NODE_ENV"] === "production") {
    return {};
  }

  const allowBypass = process.env["NEXT_PUBLIC_ENABLE_DEV_BYPASS_AUTH"] === "true";
  if (!allowBypass) return {};

  const token = process.env["NEXT_PUBLIC_DEV_BYPASS_TOKEN"] ?? "dev-bypass";
  return {
    Authorization: `Bearer ${token}`,
    "x-dev-bypass-auth": "1",
  };
}

function shouldRetry(status: number): boolean {
  return status >= 500 || status === 429;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestWithRetry<T>(path: string, init: RequestInit = {}, retries = DEFAULT_RETRY_COUNT): Promise<T> {
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= retries) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: {
          ...getAuthHeaders(),
          ...(init.headers ?? {}),
        },
        cache: "no-store",
      });

      if (!res.ok) {
        if (attempt < retries && shouldRetry(res.status)) {
          await sleep(200 * (attempt + 1));
          attempt += 1;
          continue;
        }

        throw new Error(`API_REQUEST_FAILED ${res.status} ${path}`);
      }

      return (await res.json()) as T;
    } catch (error) {
      lastError = error as Error;
      if (attempt < retries) {
        await sleep(200 * (attempt + 1));
        attempt += 1;
        continue;
      }
      break;
    }
  }

  throw new Error(lastError?.message ?? `API_REQUEST_FAILED unknown ${path}`);
}

export async function apiGet<T>(path: string): Promise<T> {
  return requestWithRetry<T>(path, { method: "GET" });
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return requestWithRetry<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return requestWithRetry<T>(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
