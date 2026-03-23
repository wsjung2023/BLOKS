// AppShell — root layout: TopGlobalNav + LeftSidebarNav + MainContent + RightContextPanel + BottomLiveTicker
"use client";

import React, { useState } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

export type NavItem = "world" | "board" | "directory" | "approval" | "analytics" | "prompts";

interface AppShellProps {
  children: React.ReactNode;
  activeNav?: NavItem;
}

interface TickerEvent {
  id: string;
  text: string;
  ts: string;
  level?: "info" | "warn" | "critical";
}

// ── Mock ticker data (replaced by real EventLog API in next phase) ─────────────

const MOCK_EVENTS: TickerEvent[] = [
  { id: "1", text: "김리더가 [마케팅 캠페인 기획] 태스크를 완료했습니다.", ts: "14:22", level: "info" },
  { id: "2", text: "박개발의 피로도가 위험 수준에 도달했습니다 (85%).", ts: "14:18", level: "warn" },
  { id: "3", text: "프로젝트 [신규 앱 출시] 승인 대기 중 — L4 결재 필요.", ts: "14:15", level: "critical" },
  { id: "4", text: "이재무가 예산 보고서를 제출했습니다.", ts: "14:10", level: "info" },
  { id: "5", text: "최기획이 [경쟁사 분석] 초안을 생성했습니다.", ts: "14:05", level: "info" },
];

// ── Nav definitions ───────────────────────────────────────────────────────────

const NAV_ITEMS: { key: NavItem; label: string; href: string; icon: string }[] = [
  { key: "world",     label: "월드",           href: "/world",     icon: "🏢" },
  { key: "board",     label: "프로젝트 보드",  href: "/board",     icon: "📋" },
  { key: "directory", label: "캐릭터 목록",    href: "/directory", icon: "👥" },
  { key: "approval",  label: "결재 센터",      href: "/approval",  icon: "✅" },
  { key: "analytics", label: "분석",           href: "/analytics", icon: "📊" },
  { key: "prompts",   label: "프롬프트 콘솔",  href: "/prompts",   icon: "⚡" },
];

// ── TopGlobalNav ──────────────────────────────────────────────────────────────

function TopGlobalNav() {
  const now = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
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
        <span title="일일 예산 소진">💰 $0.00 / $20.00</span>
        <span title="미처리 결재">🔔 <strong style={{ color: "#FFAB40" }}>3건</strong></span>
        <span title="현재 시각">🕐 {now}</span>
      </div>
    </header>
  );
}

// ── LeftSidebarNav ────────────────────────────────────────────────────────────

function LeftSidebarNav({ active }: { active?: NavItem }) {
  return (
    <nav
      style={{
        position: "fixed", top: "var(--nav-top-h)", left: 0, bottom: "var(--ticker-h)",
        width: "var(--nav-left-w)", zIndex: 40,
        background: "var(--color-panel)", borderRight: "1px solid var(--color-border)",
        display: "flex", flexDirection: "column", padding: "0.75rem 0",
        overflowY: "auto",
      }}
    >
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          style={{
            display: "flex", alignItems: "center", gap: "0.625rem",
            padding: "0.625rem 1rem",
            color: active === item.key ? "var(--color-brand)" : "var(--color-text)",
            background: active === item.key ? "rgba(92,74,50,0.08)" : "transparent",
            borderLeft: active === item.key ? "3px solid var(--color-brand)" : "3px solid transparent",
            textDecoration: "none", fontSize: "0.875rem", fontWeight: active === item.key ? 600 : 400,
            transition: "background 0.15s",
          }}
        >
          <span style={{ fontSize: "1rem" }}>{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

// ── RightContextPanel ─────────────────────────────────────────────────────────

function RightContextPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <aside
      style={{
        position: "fixed", top: "var(--nav-top-h)", right: 0, bottom: "var(--ticker-h)",
        width: "var(--panel-right-w)", zIndex: 40,
        background: "var(--color-panel)", borderLeft: "1px solid var(--color-border)",
        display: "flex", flexDirection: "column",
        boxShadow: "-4px 0 16px rgba(0,0,0,0.08)",
      }}
    >
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "0.75rem 1rem", borderBottom: "1px solid var(--color-border)",
      }}>
        <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>상세 정보</span>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.125rem", color: "var(--color-muted)" }}
          aria-label="패널 닫기"
        >
          ✕
        </button>
      </div>
      <div style={{ flex: 1, padding: "1rem", color: "var(--color-muted)", fontSize: "0.8rem" }}>
        항목을 클릭하면 상세 정보가 표시됩니다.
      </div>
    </aside>
  );
}

// ── BottomLiveTicker ──────────────────────────────────────────────────────────

function BottomLiveTicker() {
  const levelColor: Record<string, string> = {
    info: "var(--color-muted)",
    warn: "var(--color-toxic-orange)",
    critical: "var(--color-toxic-red)",
  };
  return (
    <footer
      style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        height: "var(--ticker-h)", zIndex: 50,
        background: "#1A1510", color: "#aaa",
        display: "flex", alignItems: "center",
        padding: "0 1rem", gap: "2rem",
        fontSize: "0.75rem", overflow: "hidden",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <span style={{ color: "var(--color-accent)", fontWeight: 700, whiteSpace: "nowrap", marginRight: "0.5rem" }}>
        ▶ LIVE
      </span>
      <div style={{ display: "flex", gap: "2.5rem", overflow: "hidden", whiteSpace: "nowrap" }}>
        {MOCK_EVENTS.map((evt) => (
          <span key={evt.id} style={{ color: levelColor[evt.level ?? "info"] }}>
            [{evt.ts}] {evt.text}
          </span>
        ))}
      </div>
    </footer>
  );
}

// ── AppShell ──────────────────────────────────────────────────────────────────

export default function AppShell({ children, activeNav }: AppShellProps) {
  const [rightPanelOpen, setRightPanelOpen] = useState(false);

  return (
    <div style={{ height: "100vh", overflow: "hidden" }}>
      <TopGlobalNav />
      <LeftSidebarNav active={activeNav} />

      <main
        style={{
          position: "fixed",
          top: "var(--nav-top-h)",
          left: "var(--nav-left-w)",
          right: rightPanelOpen ? "var(--panel-right-w)" : 0,
          bottom: "var(--ticker-h)",
          overflow: "auto",
          background: "var(--color-bg)",
          transition: "right 0.2s ease",
        }}
      >
        {children}
      </main>

      <RightContextPanel open={rightPanelOpen} onClose={() => setRightPanelOpen(false)} />
      <BottomLiveTicker />
    </div>
  );
}
