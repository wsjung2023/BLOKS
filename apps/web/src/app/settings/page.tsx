"use client";

import React, { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";

const API_BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000/api/v1";

interface KeyStatus {
  key: string;
  label: string;
  description: string;
  costNote: string;
  isFree: boolean;
  getUrl: string;
  group: string;
  isSet: boolean;
  hint: string;
}

const GROUP_LABELS: Record<string, { title: string; subtitle: string }> = {
  text: {
    title: "글쓰기 AI",
    subtitle: "보고서, 기획서, 코딩 등 텍스트 작업에 사용합니다. 하나만 있어도 됩니다.",
  },
  search: {
    title: "실시간 웹 검색",
    subtitle: "AI가 인터넷에서 최신 정보를 찾아 결과물에 반영합니다. 없어도 동작합니다.",
  },
  image: {
    title: "이미지 생성",
    subtitle: "포스터, 배너 등 이미지를 만들 때 사용합니다. OpenAI 키만 있어도 자동으로 됩니다.",
  },
  video: {
    title: "영상 생성",
    subtitle: "유튜브 영상, 릴스, 쇼츠를 AI로 만들 때 사용합니다.",
  },
};

export default function SettingsPage() {
  const [keys, setKeys] = useState<KeyStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [inputVal, setInputVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/settings/api-keys`)
      .then((r) => r.json())
      .then((r) => { if (r.ok) setKeys(r.data as KeyStatus[]); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save(keyName: string) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/settings/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: keyName, value: inputVal }),
      });
      const data = await res.json() as { ok: boolean; error?: { message: string }; data?: { isSet: boolean; hint: string } };
      if (data.ok && data.data) {
        setKeys((prev) =>
          prev.map((k) =>
            k.key === keyName ? { ...k, isSet: data.data!.isSet, hint: data.data!.hint ?? "" } : k
          )
        );
        setEditing(null);
        setInputVal("");
        setMessage({ type: "ok", text: "저장됐습니다!" });
      } else {
        setMessage({ type: "error", text: data.error?.message ?? "저장 실패" });
      }
    } catch {
      setMessage({ type: "error", text: "서버와 통신할 수 없습니다. 앱이 실행 중인지 확인하세요." });
    } finally {
      setSaving(false);
    }
  }

  const groups = ["text", "search", "image", "video"];

  return (
    <AppShell>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>설정</h1>
        <p style={{ color: "#888", marginBottom: 32, fontSize: 14 }}>
          AI 서비스 연결 키를 입력하세요. 모든 키는 <strong>내 PC에만 저장</strong>되며 외부로 전송되지 않습니다.
        </p>

        {message && (
          <div style={{
            padding: "12px 16px",
            borderRadius: 8,
            marginBottom: 24,
            background: message.type === "ok" ? "#d4edda" : "#f8d7da",
            color: message.type === "ok" ? "#155724" : "#721c24",
            fontSize: 14,
          }}>
            {message.type === "ok" ? "✅ " : "❌ "}{message.text}
          </div>
        )}

        {loading ? (
          <p style={{ color: "#888" }}>불러오는 중...</p>
        ) : (
          groups.map((group) => {
            const groupKeys = keys.filter((k) => k.group === group);
            if (groupKeys.length === 0) return null;
            const meta = GROUP_LABELS[group];
            return (
              <div key={group} style={{ marginBottom: 40 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{meta?.title}</h2>
                <p style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>{meta?.subtitle}</p>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {groupKeys.map((k) => (
                    <div key={k.key} style={{
                      border: "1px solid #e0e0e0",
                      borderRadius: 12,
                      padding: "16px 20px",
                      background: "#fff",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 20 }}>{k.isSet ? "✅" : "⬜"}</span>
                          <span style={{ fontWeight: 600, fontSize: 15 }}>{k.label}</span>
                          {k.isFree && (
                            <span style={{
                              background: "#d4edda", color: "#155724",
                              fontSize: 11, padding: "2px 8px", borderRadius: 20,
                            }}>무료 플랜 있음</span>
                          )}
                        </div>
                        {k.isSet && editing !== k.key && (
                          <span style={{ fontSize: 12, color: "#888" }}>{k.hint}</span>
                        )}
                      </div>

                      <p style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>{k.description}</p>
                      <p style={{ fontSize: 12, color: "#999", marginBottom: 12 }}>💰 {k.costNote}</p>

                      {editing === k.key ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <input
                            type="password"
                            autoComplete="off"
                            placeholder="키를 붙여넣기 하세요"
                            value={inputVal}
                            onChange={(e) => setInputVal(e.target.value)}
                            style={{
                              padding: "10px 14px",
                              borderRadius: 8,
                              border: "1px solid #ccc",
                              fontSize: 14,
                              fontFamily: "monospace",
                            }}
                          />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={() => void save(k.key)}
                              disabled={saving || !inputVal.trim()}
                              style={{
                                padding: "8px 20px",
                                borderRadius: 8,
                                border: "none",
                                background: "#2563eb",
                                color: "#fff",
                                cursor: saving ? "wait" : "pointer",
                                fontSize: 14,
                              }}
                            >
                              {saving ? "저장 중..." : "저장"}
                            </button>
                            <button
                              onClick={() => { setEditing(null); setInputVal(""); }}
                              style={{
                                padding: "8px 16px",
                                borderRadius: 8,
                                border: "1px solid #ccc",
                                background: "#fff",
                                cursor: "pointer",
                                fontSize: 14,
                              }}
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => { setEditing(k.key); setInputVal(""); }}
                            style={{
                              padding: "7px 16px",
                              borderRadius: 8,
                              border: "1px solid #2563eb",
                              background: "#fff",
                              color: "#2563eb",
                              cursor: "pointer",
                              fontSize: 13,
                            }}
                          >
                            {k.isSet ? "변경" : "키 입력하기"}
                          </button>
                          <a
                            href={k.getUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: "7px 16px",
                              borderRadius: 8,
                              border: "1px solid #ddd",
                              background: "#f9f9f9",
                              color: "#555",
                              cursor: "pointer",
                              fontSize: 13,
                              textDecoration: "none",
                            }}
                          >
                            키 발급 받기 →
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}

        <div style={{
          marginTop: 32,
          padding: "16px 20px",
          background: "#f0f4ff",
          borderRadius: 12,
          fontSize: 13,
          color: "#444",
          lineHeight: 1.7,
        }}>
          <strong>🔒 보안 안내</strong><br />
          입력한 키는 이 컴퓨터의 BLOKS 폴더 안에만 저장됩니다.<br />
          외부 서버나 클라우드로 전송되지 않으며, 다른 사람이 볼 수 없습니다.<br />
          각 AI 서비스는 키 소유자의 계정에서 직접 과금됩니다.
        </div>
      </div>
    </AppShell>
  );
}
