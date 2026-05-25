"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import AppShell from "@/components/layout/AppShell";
import { apiGet, apiPost, apiPut } from "@/lib/apiClient";

// Monaco loaded lazily so SSR doesn't break
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface Artifact {
  id: string;
  project_id: string;
  task_id: string | null;
  artifact_type: string;
  title: string;
  content_markdown: string;
  status: "Draft" | "Final" | "Archived";
  author_character_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ArtifactResponse { ok: boolean; data?: Artifact; error?: { message: string } }

const STATUS_OPTS = ["Draft", "Final", "Archived"] as const;
const STATUS_COLOR: Record<string, string> = {
  Draft: "#4263eb",
  Final: "#2f9e44",
  Archived: "#868e96",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

function ImageArtifactViewer({ content }: { content: string }) {
  // content_markdown 형식: "![title](url_or_data_uri)\n\n> provider 정보"
  const imgMatch = content.match(/!\[([^\]]*)\]\(([^)]+)\)/);
  const caption = content.split("\n").find((l) => l.startsWith(">"))?.replace(/^>\s*/, "") ?? "";
  if (!imgMatch) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-muted)", fontSize: "0.9rem" }}>
        이미지를 불러올 수 없습니다.
      </div>
    );
  }
  return (
    <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", gap: "1rem", background: "#111" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgMatch[2]} alt={imgMatch[1]} style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 8, boxShadow: "0 4px 32px rgba(0,0,0,0.6)" }} />
      {caption && <p style={{ color: "#888", fontSize: "0.78rem" }}>{caption}</p>}
    </div>
  );
}

export default function ArtifactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.["id"] as string;

  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // Editor state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"Draft" | "Final" | "Archived">("Draft");
  const [editingTitle, setEditingTitle] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // AI revision
  const [instruction, setInstruction] = useState("");
  const [revising, setRevising] = useState(false);
  const [reviseErr, setReviseErr] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setLoadErr(null);
    apiGet<ArtifactResponse>(`/artifacts/${id}`)
      .then((r) => {
        if (!r.ok || !r.data) throw new Error(r.error?.message ?? "로드 실패");
        setArtifact(r.data);
        setTitle(r.data.title);
        setContent(r.data.content_markdown);
        setStatus(r.data.status);
        setDirty(false);
      })
      .catch((e: unknown) => setLoadErr(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) titleInputRef.current.focus();
  }, [editingTitle]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const r = await apiPut<ArtifactResponse>(`/artifacts/${id}`, { title, content, status });
      if (!r.ok) throw new Error(r.error?.message ?? "저장 실패");
      setArtifact(r.data!);
      setDirty(false);
      setSaveMsg({ text: "저장 완료!", ok: true });
    } catch (e: unknown) {
      setSaveMsg({ text: String(e), ok: false });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  };

  const handleRevise = async () => {
    if (!instruction.trim()) return;
    setRevising(true);
    setReviseErr(null);
    try {
      const r = await apiPost<ArtifactResponse>(`/artifacts/${id}/revise`, {
        instruction: instruction.trim(),
        characterId: artifact?.author_character_id ?? undefined,
      });
      if (!r.ok) throw new Error(r.error?.message ?? "AI 수정 실패");
      const revised = r.data!.content_markdown;
      setContent(revised);
      setDirty(true);
      setInstruction("");
    } catch (e: unknown) {
      setReviseErr(String(e));
    } finally {
      setRevising(false);
    }
  };

  if (loading) return (
    <AppShell activeNav="artifacts">
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh", color: "var(--color-muted)" }}>
        로딩 중...
      </div>
    </AppShell>
  );

  if (loadErr || !artifact) return (
    <AppShell activeNav="artifacts">
      <div style={{ textAlign: "center", padding: "4rem" }}>
        <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>⚠️</div>
        <p style={{ color: "var(--color-muted)" }}>{loadErr ?? "아티팩트를 찾을 수 없습니다."}</p>
        <button onClick={() => router.push("/artifacts")} style={{ marginTop: "1rem", padding: "0.5rem 1rem", border: "1px solid var(--color-border)", borderRadius: 6, background: "var(--color-panel)", color: "var(--color-text)", cursor: "pointer" }}>
          목록으로
        </button>
      </div>
    </AppShell>
  );

  return (
    <AppShell activeNav="artifacts">
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        {/* Toolbar */}
        <div style={{
          display: "flex", alignItems: "center", gap: "0.75rem",
          padding: "0.625rem 1rem", borderBottom: "1px solid var(--color-border)",
          background: "var(--color-panel)", flexShrink: 0, flexWrap: "wrap",
        }}>
          <button
            onClick={() => router.push("/artifacts")}
            style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", fontSize: "0.82rem", padding: "0.2rem 0" }}
          >
            ← 목록
          </button>

          <div style={{ width: 1, height: 18, background: "var(--color-border)" }} />

          {/* Editable title */}
          {editingTitle ? (
            <input
              ref={titleInputRef}
              value={title}
              onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => { if (e.key === "Enter") setEditingTitle(false); }}
              style={{
                flex: 1, minWidth: 180,
                border: "1px solid var(--color-brand)", borderRadius: 4,
                padding: "0.2rem 0.5rem", background: "var(--color-bg)",
                color: "var(--color-text)", fontSize: "0.875rem", fontWeight: 600,
              }}
            />
          ) : (
            <span
              onClick={() => setEditingTitle(true)}
              style={{ flex: 1, fontWeight: 600, fontSize: "0.875rem", cursor: "text", minWidth: 120 }}
              title="클릭하여 제목 편집"
            >
              {title}
            </span>
          )}

          {/* Status selector */}
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value as typeof status); setDirty(true); }}
            style={{
              padding: "0.25rem 0.5rem", borderRadius: 12, border: "none",
              background: STATUS_COLOR[status] ?? "#555", color: "#fff",
              fontWeight: 600, fontSize: "0.72rem", cursor: "pointer",
            }}
          >
            {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <span style={{ fontSize: "0.72rem", color: "var(--color-muted)" }}>
            {fmtDate(artifact.updated_at)}
          </span>

          {dirty && (
            <span style={{ fontSize: "0.7rem", color: "#f59f00", fontWeight: 600 }}>
              미저장
            </span>
          )}

          {saveMsg && (
            <span style={{ fontSize: "0.72rem", color: saveMsg.ok ? "#2f9e44" : "#c92a2a", fontWeight: 600 }}>
              {saveMsg.text}
            </span>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            style={{
              padding: "0.35rem 0.9rem", borderRadius: 6,
              background: dirty ? "var(--color-brand)" : "var(--color-border)",
              border: "none", color: "#fff", fontWeight: 600, fontSize: "0.8rem",
              cursor: dirty && !saving ? "pointer" : "default",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>

        {/* Editor area */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {artifact.artifact_type === "image_production" ? (
            <ImageArtifactViewer content={content} />
          ) : (
            <MonacoEditor
              height="100%"
              language="markdown"
              theme="vs-dark"
              value={content}
              onChange={(val) => { setContent(val ?? ""); setDirty(true); }}
              options={{
                minimap: { enabled: false },
                wordWrap: "on",
                fontSize: 14,
                lineHeight: 22,
                padding: { top: 16, bottom: 16 },
                scrollBeyondLastLine: false,
                renderWhitespace: "none",
              }}
            />
          )}
        </div>

        {/* AI revision panel */}
        <div style={{
          borderTop: "1px solid var(--color-border)", background: "var(--color-panel)",
          padding: "0.625rem 1rem", flexShrink: 0,
        }}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 600, whiteSpace: "nowrap" }}>AI 수정 요청</span>
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !revising) handleRevise(); }}
              placeholder="예: 결론 부분을 더 간결하게 해줘, 영문으로 번역해줘..."
              disabled={revising}
              style={{
                flex: 1, minWidth: 240, padding: "0.35rem 0.65rem",
                border: "1px solid var(--color-border)", borderRadius: 6,
                background: "var(--color-bg)", color: "var(--color-text)", fontSize: "0.8rem",
              }}
            />
            <button
              onClick={handleRevise}
              disabled={revising || !instruction.trim()}
              style={{
                padding: "0.35rem 0.9rem", borderRadius: 6,
                background: "#7048e8", border: "none", color: "#fff", fontWeight: 600, fontSize: "0.8rem",
                cursor: !revising && instruction.trim() ? "pointer" : "default",
                opacity: revising || !instruction.trim() ? 0.5 : 1,
              }}
            >
              {revising ? "처리 중..." : "AI 수정"}
            </button>
            {reviseErr && <span style={{ fontSize: "0.72rem", color: "#c92a2a" }}>{reviseErr}</span>}
            {revising && <span style={{ fontSize: "0.72rem", color: "var(--color-muted)" }}>AI가 내용을 수정 중입니다...</span>}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
