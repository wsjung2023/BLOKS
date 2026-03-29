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
  return { Authorization: `Bearer ${token}` };
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API_GET_FAILED ${res.status} ${path}`);
  }

  return (await res.json()) as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`API_POST_FAILED ${res.status} ${path}`);
  }

  return (await res.json()) as T;
}
