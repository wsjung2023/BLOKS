"use client";

import { useContext, useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import LoadStateBlock from "@/components/common/LoadStateBlock";
import { ContextPanelContext } from "@/components/layout/AppShell-nav";
import { apiGet, apiPatch } from "@/lib/apiClient";
import { PromptsHelp } from "@/components/layout/AppHelp";

interface PromptTemplate {
  id: string;
  task_type: string;
  template_body: string;
  version: number;
  active_flag: boolean;
  character_id?: string | null;
  role_id?: string | null;
  created_at: string;
}

interface PromptListResponse {
  data?: { items?: PromptTemplate[]; total?: number };
}

const TASK_TYPE_LABELS: Record<string, string> = {
  planningDocument: "기획 문서",
  prd_draft: "PRD 초안",
  research_summary: "리서치 요약",
  marketing_copy: "마케팅 카피",
  approval_analysis: "승인 분석",
  character_action: "캐릭터 액션",
};

export default function PromptsPage() {
  const { openPanel, closePanel } = useContext(ContextPanelContext);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeOnly, setActiveOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  function loadTemplates() {
    setLoading(true);
    apiGet<PromptListResponse>(`/prompts?activeOnly=${activeOnly}&pageSize=50`)
      .then((body) => {
        setTemplates(body.data?.items ?? []);
        setError(null);
      })
      .catch(() => setError("프롬프트 템플릿을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTemplates();
  }, [activeOnly]);

  function openEditor(tpl: PromptTemplate) {
    setEditingId(tpl.id);
    setEditBody(tpl.template_body);
    setSaveError(null);

    openPanel(
      `편집: ${TASK_TYPE_LABELS[tpl.task_type] ?? tpl.task_type}`,
      <PromptEditorPanel
        template={tpl}
        onSave={async (body) => {
          setSaving(true);
          setSaveError(null);
          try {
            await apiPatch(`/prompts/${tpl.id}`, { templateBody: body });
            loadTemplates();
            closePanel();
          } catch {
            setSaveError("저장에 실패했습니다. 다시 시도해 주세요.");
          } finally {
            setSaving(false);
          }
        }}
        saving={saving}
        saveError={saveError}
      />
    );
  }

  const taskTypes = [...new Set(templates.map((t) => t.task_type))].sort();

  return (
    <AppShell activeNav="prompts" helpContent={<PromptsHelp />}>
      <section style={{ padding: "1rem", height: "100%", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: "1.05rem" }}>Prompt Console</h1>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              style={{ accentColor: "var(--color-accent)" }}
            />
            활성 템플릿만
          </label>
        </div>

        {loading ? (
          <LoadStateBlock message="템플릿 로딩 중..." />
        ) : error ? (
          <LoadStateBlock message={error} tone="error" actionLabel="다시 시도" onAction={loadTemplates} />
        ) : templates.length === 0 ? (
          <LoadStateBlock message="등록된 프롬프트 템플릿이 없습니다." actionLabel="새로고침" onAction={loadTemplates} />
        ) : (
          <div style={{ overflowY: "auto", flex: 1, display: "grid", gap: "0.75rem", alignContent: "start" }}>
            {taskTypes.map((taskType) => {
              const group = templates.filter((t) => t.task_type === taskType);
              return (
                <div key={taskType} style={{ border: "1px solid var(--color-border)", borderRadius: 10, background: "var(--color-panel)", overflow: "hidden" }}>
                  <div style={{ padding: "0.6rem 0.9rem", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                      {TASK_TYPE_LABELS[taskType] ?? taskType}
                    </span>
                    <span style={{ fontSize: "0.72rem", color: "var(--color-muted)" }}>{group.length}개</span>
                  </div>
                  <div style={{ display: "grid", gap: 0 }}>
                    {group.map((tpl, idx) => (
                      <div
                        key={tpl.id}
                        style={{
                          padding: "0.6rem 0.9rem",
                          borderTop: idx > 0 ? "1px solid var(--color-border)" : undefined,
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: "0.5rem",
                          alignItems: "start",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                            <span style={{
                              fontSize: "0.68rem",
                              padding: "0.1rem 0.45rem",
                              borderRadius: 999,
                              background: tpl.active_flag ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.06)",
                              color: tpl.active_flag ? "#4ade80" : "var(--color-muted)",
                            }}>
                              {tpl.active_flag ? "활성" : "비활성"}
                            </span>
                            <span style={{ fontSize: "0.68rem", color: "var(--color-muted)" }}>v{tpl.version}</span>
                            {tpl.character_id && (
                              <span style={{ fontSize: "0.68rem", color: "var(--color-muted)" }}>캐릭터 전용</span>
                            )}
                          </div>
                          <pre style={{
                            margin: 0,
                            fontSize: "0.75rem",
                            color: "var(--color-text)",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            maxHeight: "4.5rem",
                            overflow: "hidden",
                            opacity: 0.8,
                          }}>
                            {tpl.template_body.slice(0, 200)}{tpl.template_body.length > 200 ? "…" : ""}
                          </pre>
                        </div>
                        <button
                          onClick={() => openEditor(tpl)}
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid var(--color-border)",
                            color: "var(--color-text)",
                            borderRadius: 6,
                            padding: "0.3rem 0.7rem",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        >
                          편집
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}

// ── Editor panel rendered inside RightContextPanel ────────────────────────────

function PromptEditorPanel({
  template,
  onSave,
  saving,
  saveError,
}: {
  template: PromptTemplate;
  onSave: (body: string) => Promise<void>;
  saving: boolean;
  saveError: string | null;
}) {
  const [body, setBody] = useState(template.template_body);
  const isDirty = body !== template.template_body;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", height: "100%" }}>
      <div style={{ display: "grid", gap: "0.25rem", fontSize: "0.78rem", color: "var(--color-muted)" }}>
        <div>태스크 유형: <strong style={{ color: "var(--color-text)" }}>{template.task_type}</strong></div>
        <div>버전: v{template.version} → 저장 시 v{template.version + 1}</div>
        {template.character_id && <div>캐릭터 ID: {template.character_id}</div>}
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        spellCheck={false}
        style={{
          flex: 1,
          resize: "vertical",
          minHeight: 280,
          background: "rgba(0,0,0,0.2)",
          border: `1px solid ${isDirty ? "var(--color-accent)" : "var(--color-border)"}`,
          borderRadius: 8,
          color: "var(--color-text)",
          fontFamily: "monospace",
          fontSize: "0.78rem",
          lineHeight: 1.6,
          padding: "0.75rem",
          outline: "none",
        }}
      />

      {saveError && (
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--color-toxic-red)" }}>{saveError}</p>
      )}

      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
        <span style={{ fontSize: "0.72rem", color: "var(--color-muted)", alignSelf: "center" }}>
          {body.length}자
        </span>
        <button
          onClick={() => onSave(body)}
          disabled={!isDirty || saving}
          style={{
            background: isDirty && !saving ? "var(--color-accent)" : "rgba(255,255,255,0.06)",
            border: "none",
            color: isDirty && !saving ? "#000" : "var(--color-muted)",
            borderRadius: 6,
            padding: "0.45rem 1rem",
            fontSize: "0.82rem",
            cursor: isDirty && !saving ? "pointer" : "default",
            fontWeight: 600,
          }}
        >
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>
    </div>
  );
}
