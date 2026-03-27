// AppShell — root layout: TopGlobalNav + LeftSidebarNav + MainContent + RightContextPanel + BottomLiveTicker
"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  LeftSidebarNav,
  RightContextPanel,
  ContextPanelContext,
} from "./AppShell-nav";
import { BottomLiveTicker } from "./AppShell-ticker";
import { getApiBase } from "../../lib/apiBase";

export type { NavItem } from "./AppShell-nav";
export { ContextPanelContext } from "./AppShell-nav";

// ── Types ─────────────────────────────────────────────────────────────────────

import type { NavItem } from "./AppShell-nav";

interface AppShellProps {
  children: React.ReactNode;
  activeNav?: NavItem;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE = getApiBase();
const AUTH_HEADERS = { Authorization: "Bearer dev-bypass" };

const PENDING_APPROVAL_STATES = new Set([
  "WaitingL1", "WaitingL2", "WaitingL3", "WaitingFounder",
]);

// ── TopGlobalNav ──────────────────────────────────────────────────────────────

function TopGlobalNav() {
  const [time, setTime] = useState("--:--:--");
  const [pendingCount, setPendingCount] = useState(0);

  // Live clock — ticks every second
  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    setTime(fmt());
    const id = setInterval(() => setTime(fmt()), 1_000);
    return () => clearInterval(id);
  }, []);

  // Pending approval count — refreshes every 30 s
  useEffect(() => {
    const load = () =>
      fetch(`${API_BASE}/approvals?pageSize=100`, { headers: AUTH_HEADERS })
        .then((r) => r.json())
        .then((body: { data?: { items?: { state?: string }[] } }) => {
          const n = (body.data?.items ?? []).filter(
            (a) => PENDING_APPROVAL_STATES.has(a.state ?? "")
          ).length;
          setPendingCount(n);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header
      style={{
        position: "fixed", top: 0, left: 0, right: 0,
        height: "var(--nav-top-h)", zIndex: 50,
        background: "var(--color-brand)", color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 1rem", borderBottom: "1px solid rgba(0,0,0,0.2)",
      }}
    >
      <span style={{ fontWeight: 700, fontSize: "1rem", letterSpacing: "0.1em" }}>
        {process.env["NEXT_PUBLIC_APP_NAME"] ?? "BLOKS"}
      </span>

      <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", fontSize: "0.8rem" }}>
        <span title="일일 API 비용">💰 $0.00 / $20.00</span>

        <span title="미처리 결재">
          🔔{" "}
          {pendingCount > 0 ? (
            <strong
              className="toxic-pulse"
              style={{ color: "#FFAB40", cursor: "pointer" }}
            >
              {pendingCount}건
            </strong>
          ) : (
            <span style={{ opacity: 0.6 }}>0건</span>
          )}
        </span>

        <span
          title="현재 시각"
          style={{ fontVariantNumeric: "tabular-nums", minWidth: "5.5rem", textAlign: "right" }}
        >
          🕐 {time}
        </span>
      </div>
    </header>
  );
}

// ── AppShell ──────────────────────────────────────────────────────────────────

export default function AppShell({ children, activeNav }: AppShellProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTitle, setPanelTitle] = useState("");
  const [panelContent, setPanelContent] = useState<React.ReactNode>(null);

  const openPanel = useCallback((title: string, content: React.ReactNode) => {
    setPanelTitle(title);
    setPanelContent(content);
    setPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => setPanelOpen(false), []);

  return (
    <ContextPanelContext.Provider value={{ openPanel, closePanel }}>
      <div style={{ height: "100vh", overflow: "hidden" }}>
        <TopGlobalNav />
        <LeftSidebarNav active={activeNav} />

        <main
          style={{
            position: "fixed",
            top: "var(--nav-top-h)",
            left: "var(--nav-left-w)",
            right: panelOpen ? "var(--panel-right-w)" : 0,
            bottom: "var(--ticker-h)",
            overflow: "auto",
            background: "var(--color-bg)",
            transition: "right 0.22s ease",
          }}
        >
          {children}
        </main>

        <RightContextPanel
          open={panelOpen}
          title={panelTitle}
          content={panelContent}
          onClose={closePanel}
        />
        <BottomLiveTicker />
      </div>
    </ContextPanelContext.Provider>
  );
}
