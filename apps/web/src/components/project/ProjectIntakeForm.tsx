"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/apiClient";

interface ProjectResponse {
  ok: boolean;
  data?: { id: string };
}

export default function ProjectIntakeForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [deadline, setDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Array<{ id: string; filename: string; uploading?: boolean }>>([]);

  const uploadFile = async (file: File) => {
    const tempId = `temp_${Date.now()}`;
    setAttachments(prev => [...prev, { id: tempId, filename: file.name, uploading: true }]);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = typeof window !== "undefined"
        ? (window.localStorage.getItem("BLOKS_AUTH_TOKEN") ?? "dev-bypass")
        : "dev-bypass";
      const res = await fetch("/api/v1/attachments", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await res.json() as { ok: boolean; data?: { id: string; filename: string } };
      if (json.ok && json.data) {
        setAttachments(prev => prev.map(a => a.id === tempId ? { id: json.data!.id, filename: json.data!.filename } : a));
      } else {
        setAttachments(prev => prev.filter(a => a.id !== tempId));
      }
    } catch {
      setAttachments(prev => prev.filter(a => a.id !== tempId));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !brief.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const readyIds = attachments.filter(a => !a.uploading).map(a => a.id);
      const res = await apiPost<ProjectResponse>("/projects", {
        title: title.trim(),
        brief: brief.trim(),
        ...(deadline ? { dueAt: deadline } : {}),
        ...(readyIds.length > 0 ? { attachmentIds: readyIds } : {}),
      });
      if (res.ok && res.data?.id) {
        router.push("/projects");
      }
    } catch {
      setError("프로젝트 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        새 프로젝트 의뢰
      </h1>
      <p style={{ color: "var(--color-muted)", fontSize: "0.85rem", marginBottom: "2rem" }}>
        의뢰 내용을 입력하면 오케스트레이터가 자동으로 태스크를 분해하고 팀에 배분합니다.
      </p>

      <form onSubmit={e => void submit(e)} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", color: "var(--color-muted)", marginBottom: "0.4rem" }}>
            프로젝트 제목 *
          </label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="예: Q3 마케팅 캠페인 기획"
            required
            style={{
              width: "100%", background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)", color: "var(--color-text)",
              borderRadius: 8, padding: "0.65rem 0.8rem", fontSize: "0.9rem", boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.8rem", color: "var(--color-muted)", marginBottom: "0.4rem" }}>
            의뢰 내용 * <span style={{ color: "var(--color-muted)", fontWeight: 400 }}>(자유롭게 작성)</span>
          </label>
          <textarea
            value={brief}
            onChange={e => setBrief(e.target.value)}
            placeholder="예: 여름 시즌에 맞춰 신제품 라인을 알릴 마케팅 캠페인이 필요합니다. SNS 콘텐츠, 이메일 뉴스레터, 랜딩페이지 카피를 포함해주세요. 타겟은 20-35세 여성입니다."
            required
            rows={6}
            style={{
              width: "100%", background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)", color: "var(--color-text)",
              borderRadius: 8, padding: "0.65rem 0.8rem", fontSize: "0.87rem",
              resize: "vertical", lineHeight: 1.6, boxSizing: "border-box",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.8rem", color: "var(--color-muted)", marginBottom: "0.4rem" }}>
            마감 기한 (선택)
          </label>
          <input
            type="date"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            style={{
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)", color: "var(--color-text)",
              borderRadius: 8, padding: "0.65rem 0.8rem", fontSize: "0.87rem",
            }}
          />
        </div>

        {/* 파일 첨부 */}
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", color: "var(--color-muted)", marginBottom: "0.4rem" }}>
            참고 파일 첨부 <span style={{ fontWeight: 400 }}>(선택 — PDF, DOCX, XLSX, PPTX, 이미지, 영상)</span>
          </label>
          <div
            onDrop={e => { e.preventDefault(); Array.from(e.dataTransfer.files).forEach(f => void uploadFile(f)); }}
            onDragOver={e => e.preventDefault()}
            onClick={() => (document.getElementById("project-file-input") as HTMLInputElement | null)?.click()}
            style={{
              border: "2px dashed var(--color-border)", borderRadius: 8,
              padding: "1rem", textAlign: "center", cursor: "pointer",
              color: "var(--color-muted)", fontSize: "0.82rem",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            파일을 여기에 드래그하거나 클릭해서 선택
            <input
              id="project-file-input"
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={e => Array.from(e.target.files ?? []).forEach(f => void uploadFile(f))}
            />
          </div>
          {attachments.length > 0 && (
            <div style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {attachments.map(a => (
                <span key={a.id} style={{
                  background: a.uploading ? "rgba(255,255,255,0.05)" : "rgba(100,180,255,0.12)",
                  border: `1px solid ${a.uploading ? "var(--color-border)" : "rgba(100,180,255,0.3)"}`,
                  borderRadius: 6, padding: "0.2rem 0.6rem",
                  fontSize: "0.75rem", color: a.uploading ? "var(--color-muted)" : "#7aaee8",
                  display: "flex", alignItems: "center", gap: "0.3rem",
                }}>
                  {a.uploading ? "⏳" : "✓"} {a.filename}
                  {!a.uploading && (
                    <button type="button"
                      onClick={ev => { ev.stopPropagation(); setAttachments(prev => prev.filter(x => x.id !== a.id)); }}
                      style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", padding: 0, marginLeft: 2 }}
                    >×</button>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p style={{ color: "var(--color-toxic-red)", fontSize: "0.82rem", margin: 0 }}>{error}</p>
        )}

        <div style={{ display: "flex", gap: "0.75rem", paddingTop: "0.5rem" }}>
          <button
            type="submit"
            disabled={submitting || !title.trim() || !brief.trim()}
            style={{
              background: submitting ? "rgba(255,255,255,0.06)" : "rgba(100,180,255,0.15)",
              border: "1px solid rgba(100,180,255,0.4)",
              color: submitting ? "var(--color-muted)" : "#64b4ff",
              borderRadius: 8, padding: "0.65rem 1.5rem",
              fontSize: "0.9rem", fontWeight: 600, cursor: submitting ? "default" : "pointer",
            }}
          >
            {submitting ? "오케스트레이터 실행 중…" : "프로젝트 의뢰"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              background: "transparent", border: "1px solid var(--color-border)",
              color: "var(--color-muted)", borderRadius: 8,
              padding: "0.65rem 1rem", fontSize: "0.9rem", cursor: "pointer",
            }}
          >
            취소
          </button>
        </div>
      </form>
    </div>
  );
}
