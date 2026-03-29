"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost, setAuthToken } from "../../lib/apiClient";

type LoginResponse = {
  ok: boolean;
  data?: {
    token?: string;
  };
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body = await apiPost<LoginResponse>("/auth/login", { email, password });
      const token = body.data?.token;
      if (!token) throw new Error("TOKEN_MISSING");
      setAuthToken(token);
      router.push("/world");
      router.refresh();
    } catch {
      setError("로그인에 실패했습니다. 계정/비밀번호를 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-xl border border-gray-800 bg-gray-900 p-6 space-y-4">
        <h1 className="text-lg font-semibold">Founder 로그인</h1>
        <div className="space-y-1">
          <label className="text-xs text-gray-400">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-400">Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium disabled:opacity-60"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </main>
  );
}
