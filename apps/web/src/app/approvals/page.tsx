"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
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

export default function ApprovalsPage() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ApprovalItem | null>(null);
  const [rejectReason, setRejectReason] = useState(REJECT_REASON_OPTIONS[0]);
  const [rejectComment, setRejectComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadApprovals() {
    setLoading(true);
    try {
      const body = await apiGet<{ data?: { items?: ApprovalItem[] } }>("/approvals?pageSize=100");
      const next = body.data?.items ?? [];
      setItems(next);
      setSelected((prev) => next.find((it) => it.id === prev?.id) ?? null);
    } catch {
      setItems([]);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApprovals();
  }, []);

  const waitingCount = useMemo(
    () => items.filter((it) => it.state.startsWith("Waiting")).length,
    [items]
  );

  async function approve(item: ApprovalItem) {
    setBusy(true);
    try {
      await apiPost(`/approvals/${item.id}/approve`, { comment: "Founder 승인" });
      await loadApprovals();
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
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell activeNav="approval">
      <section style={{ padding: "1rem", display: "grid", gridTemplateColumns: "1fr 320px", gap: "1rem", height: "100%" }}>
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 12, overflow: "hidden", background: "var(--color-panel)" }}>
          <header style={{ padding: "0.9rem 1rem", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between" }}>
            <strong>Approval Center</strong>
            <span style={{ color: "var(--color-toxic-red)", fontWeight: 700 }}>Waiting {waitingCount}건</span>
          </header>
          {loading ? (
            <div style={{ padding: "1rem", color: "var(--color-muted)" }}>결재 큐 로딩 중...</div>
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

        <aside style={{ border: "1px solid var(--color-border)", borderRadius: 12, padding: "1rem", background: "var(--color-panel)" }}>
          <strong>{selected ? "Approval Context" : "결재 상세"}</strong>
          {!selected ? (
            <p style={{ marginTop: "0.75rem", color: "var(--color-muted)", fontSize: "0.85rem" }}>왼쪽 테이블에서 결재 건을 선택해 주세요.</p>
          ) : (
            <div style={{ marginTop: "0.8rem", display: "grid", gap: "0.7rem", fontSize: "0.82rem" }}>
              <div>ID: {selected.id}</div>
              <div>Entity: {selected.entity_type} / {selected.entity_id}</div>
              <div>Level: {selected.approval_level}</div>
              <div>State: {selected.state}</div>

              <button disabled={busy} onClick={() => approve(selected)} style={{ border: 0, borderRadius: 8, padding: "0.55rem 0.7rem", background: "#2f9e44", color: "white", cursor: "pointer" }}>
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
                onClick={() => reject(selected)}
                style={{ border: 0, borderRadius: 8, padding: "0.55rem 0.7rem", background: "#c92a2a", color: "white", cursor: "pointer" }}
              >
                반려 (Reject)
              </button>
            </div>
          )}
        </aside>
      </section>
    </AppShell>
  );
}
