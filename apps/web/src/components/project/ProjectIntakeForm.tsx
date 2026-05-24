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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !brief.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiPost<ProjectResponse>("/projects", {
        title: title.trim(),
        brief: brief.trim(),
        ...(deadline ? { dueAt: deadline } : {}),
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
