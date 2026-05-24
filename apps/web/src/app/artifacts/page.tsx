"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { apiGet } from "@/lib/apiClient";

interface Artifact {
  id: string;
  project_id: string;
  task_id: string | null;
  artifact_type: string;
  title: string;
  content_markdown: string;
  status: string;
  author_character_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ArtifactsResponse {
  ok: boolean;
  data?: { items: Artifact[]; total: number; limit: number; offset: number };
}

const STATUS_COLOR: Record<string, string> = {
  Draft: "#6c8ebf",
  Final: "#2f9e44",
  Archived: "#868e96",
};

const TYPE_ICON: Record<string, string> = {
  document: "📄",
  code: "💻",
  report: "📊",
  design: "🎨",
  plan: "🗺️",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ArtifactsPage() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    apiGet<ArtifactsResponse>(`/artifacts?${params}`)
      .then((r) => {
        setArtifacts(r.data?.items ?? []);
        setTotal(r.data?.total ?? 0);
      })
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [offset]);

  useEffect(() => { load(); }, [load]);

  const filtered = artifacts.filter((a) => {
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (filterType !== "all" && a.artifact_type !== filterType) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const types = [...new Set(artifacts.map((a) => a.artifact_type))];

  return (
    <AppShell activeNav="artifacts">
      <div style={{ padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>📝 아티팩트</h1>
            <p style={{ fontSize: "0.78rem", color: "var(--color-muted)", margin: "0.25rem 0 0" }}>
              AI 에이전트가 생성한 결과물을 확인하고 편집합니다
            </p>
          </div>
          <span style={{ fontSize: "0.78rem", color: "var(--color-muted)" }}>
            총 {total}개
          </span>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="제목 검색..."
            style={{
              flex: 1, minWidth: 180, padding: "0.45rem 0.75rem",
              border: "1px solid var(--color-border)", borderRadius: 6,
              background: "var(--color-panel)", color: "var(--color-text)", fontSize: "0.82rem",
            }}
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: "0.45rem 0.65rem", border: "1px solid var(--color-border)", borderRadius: 6, background: "var(--color-panel)", color: "var(--color-text)", fontSize: "0.82rem" }}
          >
            <option value="all">상태: 전체</option>
            <option value="Draft">Draft</option>
            <option value="Final">Final</option>
            <option value="Archived">Archived</option>
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{ padding: "0.45rem 0.65rem", border: "1px solid var(--color-border)", borderRadius: 6, background: "var(--color-panel)", color: "var(--color-text)", fontSize: "0.82rem" }}
          >
            <option value="all">유형: 전체</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button
            onClick={load}
            style={{ padding: "0.45rem 0.75rem", border: "1px solid var(--color-border)", borderRadius: 6, background: "var(--color-panel)", color: "var(--color-text)", cursor: "pointer", fontSize: "0.82rem" }}
          >
            새로고침
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-muted)" }}>로딩 중...</div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#c92a2a" }}>오류: {error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem", color: "var(--color-muted)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📭</div>
            <p style={{ fontSize: "0.9rem" }}>아티팩트가 없습니다.</p>
            <p style={{ fontSize: "0.78rem" }}>AI 에이전트가 태스크를 완료하면 여기에 결과물이 쌓입니다.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "0.625rem" }}>
            {filtered.map((a) => (
              <Link
                key={a.id}
                href={`/artifacts/${a.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2rem 1fr auto auto auto",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.75rem 1rem",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    background: "var(--color-panel)",
                    cursor: "pointer",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-panel)")}
                >
                  <span style={{ fontSize: "1.2rem" }}>{TYPE_ICON[a.artifact_type] ?? "📄"}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{a.title}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--color-muted)", marginTop: 2 }}>
                      {a.artifact_type} {a.author_character_id ? `· ${a.author_character_id}` : ""}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "0.7rem", fontWeight: 600, padding: "0.2rem 0.55rem", borderRadius: 20,
                      background: STATUS_COLOR[a.status] ?? "#555", color: "#fff",
                    }}
                  >
                    {a.status}
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "var(--color-muted)", whiteSpace: "nowrap" }}>
                    {fmtDate(a.updated_at)}
                  </span>
                  <span style={{ fontSize: "0.78rem", color: "var(--color-brand)" }}>열기 →</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginTop: "1.25rem" }}>
            <button
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - limit))}
              style={{ padding: "0.4rem 0.9rem", border: "1px solid var(--color-border)", borderRadius: 6, background: "var(--color-panel)", color: "var(--color-text)", cursor: offset === 0 ? "default" : "pointer", opacity: offset === 0 ? 0.4 : 1, fontSize: "0.82rem" }}
            >
              이전
            </button>
            <span style={{ display: "flex", alignItems: "center", fontSize: "0.78rem", color: "var(--color-muted)" }}>
              {offset + 1}–{Math.min(offset + limit, total)} / {total}
            </span>
            <button
              disabled={offset + limit >= total}
              onClick={() => setOffset((o) => o + limit)}
              style={{ padding: "0.4rem 0.9rem", border: "1px solid var(--color-border)", borderRadius: 6, background: "var(--color-panel)", color: "var(--color-text)", cursor: offset + limit >= total ? "default" : "pointer", opacity: offset + limit >= total ? 0.4 : 1, fontSize: "0.82rem" }}
            >
              다음
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
