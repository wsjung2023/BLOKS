"use client";

import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ContextPanelContext } from "@/components/layout/AppShell-nav";
import AppShell, { ToastContext } from "@/components/layout/AppShell";
import LoadStateBlock from "@/components/common/LoadStateBlock";
import { apiGet, apiPost } from "@/lib/apiClient";
import { useWorldStream } from "@/lib/useWorldStream";

// ── 런타임 툴 실행 승인 ──────────────────────────────────────────────────────

interface ToolExecution {
  id: string;
  tool_name: string;
  risk_level: string;
  status: string;
  input: Record<string, unknown>;
  requested_by_character_id: string;
  requested_at: string;
}

const RISK_INFO: Record<string, { label: string; color: string; border: string; bg: string; description: string }> = {
  L0: { label: "안전", color: "#2f9e44", border: "rgba(47,158,68,0.4)", bg: "rgba(47,158,68,0.06)", description: "읽기 전용 작업입니다. 데이터를 변경하지 않습니다." },
  L1: { label: "일반 쓰기", color: "#1971c2", border: "rgba(25,113,194,0.4)", bg: "rgba(25,113,194,0.06)", description: "제한된 범위에서 데이터를 작성합니다. 되돌리기 가능합니다." },
  L2: { label: "승인 필요", color: "#e67700", border: "rgba(230,119,0,0.4)", bg: "rgba(230,119,0,0.06)", description: "중요한 작업입니다. 실행 전 사람의 확인이 필요합니다." },
  L3: { label: "위험", color: "#c92a2a", border: "rgba(201,42,42,0.4)", bg: "rgba(201,42,42,0.06)", description: "높은 위험도 작업입니다. 정책에 의해 차단됩니다." },
};

const TOOL_DESCRIPTION: Record<string, string> = {
  "ai.task.execute": "AI 캐릭터가 태스크를 수행하고 결과물을 작성합니다.",
  "db.write": "데이터베이스에 데이터를 저장합니다.",
  "db.delete": "데이터베이스에서 데이터를 삭제합니다.",
  "file.write": "파일 시스템에 파일을 생성 또는 수정합니다.",
  "file.delete": "파일을 삭제합니다.",
  "api.external.call": "외부 서비스 API를 호출합니다.",
  "budget.exceed": "설정된 예산 한도를 초과하는 비용이 발생합니다.",
};

function summarizeInput(input: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof input.taskId === "string") parts.push(`태스크 ID: ${input.taskId.slice(0, 12)}…`);
  if (typeof input.characterId === "string") parts.push(`캐릭터: ${input.characterId.slice(0, 12)}…`);
  if (typeof input.target === "string") parts.push(`대상: ${input.target}`);
  if (typeof input.action === "string") parts.push(`동작: ${input.action}`);
  if (parts.length === 0) {
    const keys = Object.keys(input).slice(0, 2);
    for (const k of keys) parts.push(`${k}: ${String(input[k]).slice(0, 30)}`);
  }
  return parts.join(" · ") || JSON.stringify(input).slice(0, 80);
}

function ToolApprovalSection() {
  const { pushToast } = useContext(ToastContext);
  const [pending, setPending] = useState<ToolExecution[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ data?: ToolExecution[] }>("/runtime/approvals");
      setPending(res.data ?? []);
    } catch {
      // runtime/approvals 미사용 시 조용히 무시
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useWorldStream((event) => {
    if (event.type === "tool_approval_requested") void load();
    if (event.type === "tool_approved" || event.type === "tool_denied") void load();
  });

  const handleApprove = async (id: string) => {
    setBusy(id);
    try {
      await apiPost(`/runtime/approvals/${id}/approve`, { approverId: "founder" });
      pushToast("툴 실행이 승인되었습니다.", "success");
      await load();
    } catch { pushToast("승인 처리 중 오류가 발생했습니다.", "error"); }
    finally { setBusy(null); }
  };

  const handleDeny = async (id: string) => {
    setBusy(id);
    try {
      await apiPost(`/runtime/approvals/${id}/deny`, {});
      pushToast("툴 실행이 차단되었습니다.", "success");
      await load();
    } catch { pushToast("차단 처리 중 오류가 발생했습니다.", "error"); }
    finally { setBusy(null); }
  };

  if (pending.length === 0) return null;

  return (
    <div style={{ marginBottom: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ color: "#e05c5c", fontWeight: 700, fontSize: "0.85rem" }}>
          ⚠ AI 실행 승인 요청
        </span>
        <span style={{
          background: "#c92a2a", color: "white",
          padding: "0.1rem 0.5rem", borderRadius: 999, fontSize: "0.72rem", fontWeight: 700,
        }}>
          {pending.length}건
        </span>
        <span style={{ fontSize: "0.72rem", color: "var(--color-muted)" }}>
          — 아래 항목을 검토하고 허용 여부를 결정해 주세요
        </span>
      </div>

      {pending.map((exec) => {
        const risk = RISK_INFO[exec.risk_level] ?? RISK_INFO["L2"]!;
        const toolDesc = TOOL_DESCRIPTION[exec.tool_name];
        const isBusy = busy === exec.id;
        return (
          <div key={exec.id} style={{
            border: `1px solid ${risk.border}`,
            borderRadius: 12,
            overflow: "hidden",
            background: risk.bg,
          }}>
            {/* Risk header */}
            <div style={{
              padding: "0.6rem 1rem",
              borderBottom: `1px solid ${risk.border}`,
              display: "flex", alignItems: "center", gap: "0.6rem",
              background: `${risk.bg}`,
            }}>
              <span style={{
                padding: "0.15rem 0.55rem", borderRadius: 999, fontSize: "0.7rem", fontWeight: 700,
                color: risk.color, border: `1px solid ${risk.border}`, background: "rgba(0,0,0,0.2)",
              }}>
                {exec.risk_level} · {risk.label}
              </span>
              <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "#e8e8e8" }}>
                {exec.tool_name}
              </span>
              <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: "var(--color-muted)" }}>
                {new Date(exec.requested_at).toLocaleTimeString("ko-KR")}
              </span>
            </div>

            {/* Content */}
            <div style={{ padding: "0.75rem 1rem", display: "grid", gap: "0.5rem" }}>
              {/* Plain-language description */}
              <div style={{ fontSize: "0.82rem", color: "#d0d0d0", lineHeight: 1.5 }}>
                {toolDesc ?? `${exec.tool_name} 도구를 실행하려 합니다.`}
              </div>

              {/* Risk explanation */}
              <div style={{
                fontSize: "0.75rem", color: risk.color, opacity: 0.85,
                display: "flex", alignItems: "flex-start", gap: "0.35rem",
              }}>
                <span>ℹ</span>
                <span>{risk.description}</span>
              </div>

              {/* Request summary */}
              <div style={{
                fontSize: "0.72rem", color: "var(--color-muted)",
                background: "rgba(0,0,0,0.25)", borderRadius: 6, padding: "0.35rem 0.6rem",
              }}>
                <span style={{ color: "#888" }}>요청자: </span>
                {exec.requested_by_character_id}
                <span style={{ margin: "0 0.4rem", color: "#444" }}>·</span>
                {summarizeInput(exec.input)}
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                <button
                  disabled={isBusy}
                  onClick={() => handleApprove(exec.id)}
                  style={{
                    flex: 1, border: 0, borderRadius: 8, padding: "0.5rem",
                    background: "#2f9e44", color: "white",
                    cursor: isBusy ? "default" : "pointer",
                    fontWeight: 700, fontSize: "0.82rem",
                    opacity: isBusy ? 0.6 : 1,
                  }}
                >
                  {isBusy ? "처리 중…" : "✓ 실행 허용"}
                </button>
                <button
                  disabled={isBusy}
                  onClick={() => handleDeny(exec.id)}
                  style={{
                    flex: 1, border: `1px solid ${risk.border}`, borderRadius: 8, padding: "0.5rem",
                    background: "rgba(201,42,42,0.15)", color: "#e05c5c",
                    cursor: isBusy ? "default" : "pointer",
                    fontWeight: 600, fontSize: "0.82rem",
                    opacity: isBusy ? 0.6 : 1,
                  }}
                >
                  ✗ 차단
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 워크플로우 결재 ────────────────────────────────────────────────────────────

interface ApprovalItem {
  id: string;
  entity_type: string;
  entity_id: string;
  approval_level: string;
  state: string;
  reason_code?: string | null;
  comment?: string | null;
  created_at?: string;
  decided_at?: string | null;
}

interface TaskTitle {
  id: string;
  title: string;
}

const REJECT_REASON_OPTIONS = [
  "OVERLOAD_REJECTION",
  "LOGIC_INSUFFICIENT",
  "BUDGET_EXCEEDED",
  "POLITICAL_REALIGNMENT",
];

function elapsed(created_at?: string): string {
  if (!created_at) return "";
  const ms = Date.now() - new Date(created_at).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}

const STATE_COLOR: Record<string, string> = {
  Pending: "var(--color-toxic-orange)",
  Approved: "#4caf7d",
  Rejected: "#e05c5c",
};

function ApprovalDetailPanel({
  selected,
  taskTitle,
  busy,
  rejectReason,
  rejectComment,
  setRejectReason,
  setRejectComment,
  onApprove,
  onReject,
}: {
  selected: ApprovalItem;
  taskTitle?: string | undefined;
  busy: boolean;
  rejectReason: string;
  rejectComment: string;
  setRejectReason: (v: string) => void;
  setRejectComment: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isPending = selected.state === "Pending";
  return (
    <div style={{ display: "grid", gap: "0.7rem", fontSize: "0.82rem" }}>
      {taskTitle && (
        <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{taskTitle}</div>
      )}
      <div style={{ color: "var(--color-muted)" }}>
        {selected.entity_type} · {selected.entity_id.slice(0, 8)}…
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <span style={{
          padding: "0.15rem 0.5rem", borderRadius: 999, fontSize: "0.72rem",
          background: "rgba(255,255,255,0.06)", color: STATE_COLOR[selected.state] ?? "var(--color-muted)",
        }}>{selected.state}</span>
        <span style={{ fontSize: "0.72rem", color: "var(--color-muted)" }}>{selected.approval_level}</span>
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>
        생성: {elapsed(selected.created_at)}
        {selected.decided_at && ` · 결정: ${elapsed(selected.decided_at)}`}
      </div>

      {isPending && (
        <>
          <button
            disabled={busy}
            onClick={onApprove}
            style={{ border: 0, borderRadius: 8, padding: "0.55rem 0.7rem", background: "#2f9e44", color: "white", cursor: busy ? "default" : "pointer", fontWeight: 600 }}
          >
            {busy ? "처리 중…" : "✓ 승인"}
          </button>

          <label style={{ display: "grid", gap: "0.3rem" }}>
            반려 사유
            <select
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              style={{ background: "#1f1b16", border: "1px solid var(--color-border)", borderRadius: 6, padding: "0.4rem", fontSize: "0.78rem" }}
            >
              {REJECT_REASON_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: "0.3rem" }}>
            코멘트
            <textarea
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              rows={3}
              placeholder="반려 코멘트를 입력하세요"
              style={{ background: "#1f1b16", border: "1px solid var(--color-border)", borderRadius: 6, padding: "0.45rem", resize: "vertical", fontSize: "0.78rem" }}
            />
          </label>

          <button
            disabled={busy || !rejectComment.trim()}
            onClick={onReject}
            style={{ border: 0, borderRadius: 8, padding: "0.55rem 0.7rem", background: "#c92a2a", color: "white", cursor: (busy || !rejectComment.trim()) ? "default" : "pointer", fontWeight: 600 }}
          >
            ✗ 반려
          </button>
        </>
      )}

      {!isPending && selected.comment && (
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "0.5rem 0.7rem", fontSize: "0.78rem", color: "var(--color-muted)" }}>
          {selected.comment}
        </div>
      )}
    </div>
  );
}

export default function ApprovalsPage() {
  const { openPanel, closePanel } = useContext(ContextPanelContext);
  const { pushToast } = useContext(ToastContext);
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [taskTitles, setTaskTitles] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<ApprovalItem | null>(null);
  const [rejectReason, setRejectReason] = useState<string>(REJECT_REASON_OPTIONS[0] ?? "OVERLOAD_REJECTION");
  const [rejectComment, setRejectComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadApprovals() {
    setLoading(true);
    try {
      const body = await apiGet<{ data?: { items?: ApprovalItem[] } }>("/approvals?pageSize=100");
      const next = body.data?.items ?? [];
      setItems(next);
      setSelected((prev) => next.find((it) => it.id === prev?.id) ?? null);
      setError(null);

      // Batch fetch task titles for task-type approvals
      const taskIds = [...new Set(next.filter((it) => it.entity_type === "task").map((it) => it.entity_id))];
      if (taskIds.length > 0) {
        const tasksRes = await apiGet<{ data?: { items?: TaskTitle[] } }>(
          `/tasks?ids=${taskIds.slice(0, 20).join(",")}&pageSize=20`
        ).catch(() => null);
        const map = new Map<string, string>();
        for (const t of tasksRes?.data?.items ?? []) map.set(t.id, t.title);
        setTaskTitles(map);
      }
    } catch {
      setItems([]);
      setSelected(null);
      setError("결재 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadApprovals(); }, []);

  const pendingItems = useMemo(() => items.filter((it) => it.state === "Pending"), [items]);
  const displayItems = showAll ? items : pendingItems;

  useEffect(() => {
    if (!selected) { closePanel(); return; }
    openPanel(
      "결재 상세",
      <ApprovalDetailPanel
        selected={selected}
        taskTitle={taskTitles.get(selected.entity_id)}
        busy={busy}
        rejectReason={rejectReason}
        rejectComment={rejectComment}
        setRejectReason={setRejectReason}
        setRejectComment={setRejectComment}
        onApprove={() => approve(selected)}
        onReject={() => reject(selected)}
      />
    );
  }, [selected, busy, rejectReason, rejectComment, taskTitles, openPanel, closePanel]);

  async function approve(item: ApprovalItem) {
    setBusy(true);
    try {
      await apiPost(`/approvals/${item.id}/approve`, { comment: "Founder 승인" });
      await loadApprovals();
      pushToast("결재가 승인되었습니다.", "success");
    } catch {
      pushToast("승인 처리 중 오류가 발생했습니다.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function reject(item: ApprovalItem) {
    if (!rejectComment.trim()) return;
    setBusy(true);
    try {
      await apiPost(`/approvals/${item.id}/reject`, { reasonCode: rejectReason, comment: rejectComment });
      setRejectComment("");
      await loadApprovals();
      pushToast("결재가 반려되었습니다.", "success");
    } catch {
      pushToast("반려 처리 중 오류가 발생했습니다.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function approveAll() {
    if (pendingItems.length === 0) return;
    setBulkBusy(true);
    let ok = 0;
    for (const item of pendingItems) {
      try {
        await apiPost(`/approvals/${item.id}/approve`, { comment: "일괄 승인" });
        ok++;
      } catch { /* continue */ }
    }
    await loadApprovals();
    setBulkBusy(false);
    pushToast(`${ok}건 일괄 승인 완료`, "success");
  }

  return (
    <AppShell activeNav="approval">
      <section style={{ padding: "1rem", height: "100%", overflow: "auto" }}>
        <ToolApprovalSection />
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 12, overflow: "hidden", background: "var(--color-panel)" }}>
          <header style={{ padding: "0.9rem 1rem", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <strong style={{ flex: 1 }}>결재 센터</strong>
            {pendingItems.length > 0 && (
              <span style={{ background: "rgba(230,100,50,0.15)", color: "var(--color-toxic-orange)", padding: "0.2rem 0.6rem", borderRadius: 999, fontSize: "0.78rem", fontWeight: 700 }}>
                대기 {pendingItems.length}건
              </span>
            )}
            <button
              onClick={() => setShowAll((v) => !v)}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--color-border)", borderRadius: 6, padding: "0.3rem 0.7rem", fontSize: "0.75rem", cursor: "pointer", color: "var(--color-text)" }}
            >
              {showAll ? "대기만 보기" : "전체 보기"}
            </button>
            {pendingItems.length > 1 && (
              <button
                onClick={approveAll}
                disabled={bulkBusy}
                style={{ background: "#2f9e44", border: "none", borderRadius: 6, padding: "0.3rem 0.8rem", fontSize: "0.75rem", cursor: bulkBusy ? "default" : "pointer", color: "white", fontWeight: 600 }}
              >
                {bulkBusy ? "처리 중…" : `전체 승인 (${pendingItems.length})`}
              </button>
            )}
            <button onClick={loadApprovals} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-muted)", fontSize: "0.78rem" }}>↻</button>
          </header>

          {loading ? (
            <LoadStateBlock message="결재 큐 로딩 중..." />
          ) : error ? (
            <LoadStateBlock message={error} tone="error" actionLabel="다시 시도" onAction={loadApprovals} />
          ) : displayItems.length === 0 ? (
            <LoadStateBlock
              message={showAll ? "결재 내역이 없습니다." : "대기 중인 결재가 없습니다."}
              actionLabel={showAll ? "새로고침" : "전체 보기"}
              onAction={showAll ? loadApprovals : () => setShowAll(true)}
            />
          ) : (
            <table style={{ width: "100%", fontSize: "0.82rem", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)", textAlign: "left" }}>
                  <th style={{ padding: "0.55rem 0.75rem" }}>레벨</th>
                  <th style={{ padding: "0.55rem 0.75rem" }}>태스크</th>
                  <th style={{ padding: "0.55rem 0.75rem" }}>상태</th>
                  <th style={{ padding: "0.55rem 0.75rem" }}>경과</th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((item) => {
                  const title = taskTitles.get(item.entity_id);
                  const isPending = item.state === "Pending";
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelected(item)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(item); } }}
                      role="button"
                      tabIndex={0}
                      style={{
                        cursor: "pointer",
                        background: selected?.id === item.id ? "rgba(92,74,50,0.14)" : "transparent",
                        borderTop: "1px solid var(--color-border)",
                        opacity: isPending ? 1 : 0.6,
                      }}
                    >
                      <td style={{ padding: "0.55rem 0.75rem", fontWeight: 600 }}>{item.approval_level}</td>
                      <td style={{ padding: "0.55rem 0.75rem", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {title ?? item.entity_id.slice(0, 12) + "…"}
                      </td>
                      <td style={{ padding: "0.55rem 0.75rem", color: STATE_COLOR[item.state] ?? "var(--color-muted)" }}>
                        {item.state}
                      </td>
                      <td style={{ padding: "0.55rem 0.75rem", color: "var(--color-muted)", fontSize: "0.75rem" }}>
                        {elapsed(item.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </AppShell>
  );
}
