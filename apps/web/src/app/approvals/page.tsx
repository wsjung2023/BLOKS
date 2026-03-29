"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import { ContextPanelContext } from "@/components/layout/AppShell-nav";
import AppShell, { ToastContext } from "@/components/layout/AppShell";
import LoadStateBlock from "@/components/common/LoadStateBlock";
import { apiGet, apiPost } from "@/lib/apiClient";

interface ApprovalItem {
  id: string;
  entity_type: string;
  entity_id: string;
  approval_level: string;
  state: string;
  summary?: string | null;
  reason_code?: string | null;
  comment?: string | null;
  created_at?: string;
  updated_at?: string;
}

const REJECT_REASON_OPTIONS = [
  "OVERLOAD_REJECTION",
  "LOGIC_INSUFFICIENT",
  "BUDGET_EXCEEDED",
  "POLITICAL_REALIGNMENT",
];

function ApprovalDetailPanel({
  selected,
  busy,
  rejectReason,
  rejectComment,
  setRejectReason,
  setRejectComment,
  onApprove,
  onReject,
}: {
  selected: ApprovalItem;
  busy: boolean;
  rejectReason: string;
  rejectComment: string;
  setRejectReason: (value: string) => void;
  setRejectComment: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div style={{ marginTop: "0.8rem", display: "grid", gap: "0.7rem", fontSize: "0.82rem" }}>
      <div>ID: {selected.id}</div>
      <div>Entity: {selected.entity_type} / {selected.entity_id}</div>
      <div>Level: {selected.approval_level}</div>
      <div>State: {selected.state}</div>

      <button disabled={busy} onClick={onApprove} style={{ border: 0, borderRadius: 8, padding: "0.55rem 0.7rem", background: "#2f9e44", color: "white", cursor: "pointer" }}>
        승인 (Approve)
      </button>

      <label style={{ display: "grid", gap: "0.3rem" }}>
        반려 사유 코드
        <select value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} style={{ background: "#1f1b16", border: "1px solid var(--color-border)", borderRadius: 6, padding: "0.4rem" }}>
          {REJECT_REASON_OPTIONS.map((reason) => (
            <option key={reason} value={reason}>{reason}</option>
          ))}
        </select>
      </label>

      <label style={{ display: "grid", gap: "0.3rem" }}>
        코멘트
        <textarea
          value={rejectComment}
          onChange={(e) => setRejectComment(e.target.value)}
          rows={4}
          placeholder="반려 코멘트를 입력하세요"
          style={{ background: "#1f1b16", border: "1px solid var(--color-border)", borderRadius: 6, padding: "0.45rem", resize: "vertical" }}
        />
      </label>

      <button
        disabled={busy || !rejectComment.trim()}
        onClick={onReject}
        style={{ border: 0, borderRadius: 8, padding: "0.55rem 0.7rem", background: "#c92a2a", color: "white", cursor: "pointer" }}
      >
        반려 (Reject)
      </button>
    </div>
  );
}

export default function ApprovalsPage() {
  const { openPanel, closePanel } = useContext(ContextPanelContext);
  const { pushToast } = useContext(ToastContext);
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ApprovalItem | null>(null);
  const [rejectReason, setRejectReason] = useState<string>(REJECT_REASON_OPTIONS[0] ?? "OVERLOAD_REJECTION");
  const [rejectComment, setRejectComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadApprovals() {
    setLoading(true);
    try {
      const body = await apiGet<{ data?: { items?: ApprovalItem[] } }>("/approvals?pageSize=100");
      const next = body.data?.items ?? [];
      setItems(next);
      setSelected((prev) => next.find((it) => it.id === prev?.id) ?? null);
      setError(null);
    } catch {
      setItems([]);
      setSelected(null);
      setError("결재 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApprovals();
  }, []);

  useEffect(() => {
    if (!selected) {
      closePanel();
      return;
    }

    openPanel(
      "Approval Context",
      <ApprovalDetailPanel
        selected={selected}
        busy={busy}
        rejectReason={rejectReason}
        rejectComment={rejectComment}
        setRejectReason={setRejectReason}
        setRejectComment={setRejectComment}
        onApprove={() => approve(selected)}
        onReject={() => reject(selected)}
      />
    );
  }, [selected, busy, rejectReason, rejectComment, openPanel, closePanel]);

  const waitingCount = useMemo(
    () => items.filter((it) => it.state.startsWith("Waiting")).length,
    [items]
  );

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

  return (
    <AppShell activeNav="approval">
      <section style={{ padding: "1rem", display: "grid", gridTemplateColumns: "1fr", gap: "1rem", height: "100%" }}>
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 12, overflow: "hidden", background: "var(--color-panel)" }}>
          <header style={{ padding: "0.9rem 1rem", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between" }}>
            <strong>Approval Center</strong>
            <span style={{ color: "var(--color-toxic-red)", fontWeight: 700 }}>Waiting {waitingCount}건</span>
          </header>
          {loading ? (
            <LoadStateBlock message="결재 큐 로딩 중..." />
          ) : error ? (
            <LoadStateBlock message={error} tone="error" actionLabel="다시 시도" onAction={loadApprovals} />
          ) : items.length === 0 ? (
            <LoadStateBlock message="현재 대기 중인 결재가 없습니다." actionLabel="새로고침" onAction={loadApprovals} />
          ) : (
            <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)", textAlign: "left" }}>
                  <th style={{ padding: "0.6rem" }}>레벨</th>
                  <th style={{ padding: "0.6rem" }}>대상</th>
                  <th style={{ padding: "0.6rem" }}>상태</th>
                  <th style={{ padding: "0.6rem" }}>요약</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelected(item)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(item);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${item.id} 결재 상세 보기`}
                    style={{
                      cursor: "pointer",
                      background: selected?.id === item.id ? "rgba(92,74,50,0.14)" : "transparent",
                      borderTop: "1px solid var(--color-border)",
                    }}
                  >
                    <td style={{ padding: "0.6rem" }}>{item.approval_level}</td>
                    <td style={{ padding: "0.6rem" }}>{item.entity_type}:{item.entity_id}</td>
                    <td style={{ padding: "0.6rem", color: item.state.startsWith("Waiting") ? "var(--color-toxic-orange)" : "var(--color-muted)" }}>{item.state}</td>
                    <td style={{ padding: "0.6rem" }}>{item.summary ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </AppShell>
  );
}
