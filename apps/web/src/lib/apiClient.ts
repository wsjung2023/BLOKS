import { getApiBase } from "./apiBase";

const API_BASE = getApiBase();

function getAuthHeaders(): HeadersInit {
  if (process.env["NODE_ENV"] === "production") {
    return {};
  }

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
