// AppShell-nav — LeftSidebarNav, RightContextPanel, and shared ContextPanelContext
"use client";
import React from "react";
import Link from "next/link";
import type { Route } from "next";

// ── Types ─────────────────────────────────────────────────────────────────────

export type NavItem = "world" | "projects" | "board" | "directory" | "char-editor" | "approval" | "analytics" | "prompts" | "map-editor" | "demo" | "artifacts";

export interface ContextPanelCtx {
  openPanel: (title: string, content: React.ReactNode) => void;
  closePanel: () => void;
}

export const ContextPanelContext = React.createContext<ContextPanelCtx>({
  openPanel: () => {},
  closePanel: () => {},
});

// ── Nav items ─────────────────────────────────────────────────────────────────

const NAV_ITEMS: { key: NavItem; label: string; href: Route; icon: string; dividerBefore?: boolean }[] = [
  { key: "world",        label: "월드",          href: "/world",            icon: "🏢" },
  { key: "projects",     label: "프로젝트",      href: "/projects",         icon: "🗂️" },
  { key: "board",        label: "태스크 보드",   href: "/board",            icon: "📋" },
  { key: "artifacts",    label: "아티팩트",      href: "/artifacts",        icon: "📝" },
  { key: "directory",    label: "캐릭터 목록",     href: "/characters",         icon: "👥" },
  { key: "char-editor", label: "스프라이트 에디터", href: "/characters/editor",  icon: "🎨" },
  { key: "approval",     label: "결재 센터",     href: "/approvals",        icon: "✅" },
  { key: "analytics",    label: "분석",          href: "/analytics",        icon: "📊" },
  { key: "prompts",      label: "프롬프트 콘솔", href: "/prompts",          icon: "⚡" },
  { key: "map-editor",   label: "맵 에디터",     href: "/map-editor",       icon: "🗺️", dividerBefore: true },
  { key: "demo",         label: "데모 결과",     href: "/demo",             icon: "🎬" },
];

// Standalone action links (not part of active nav tracking)
const ACTION_LINKS: { label: string; href: Route; icon: string }[] = [
  { label: "새 프로젝트", href: "/projects/new", icon: "+" },
];

// ── LeftSidebarNav ────────────────────────────────────────────────────────────

export function LeftSidebarNav({ active }: { active?: NavItem }) {
  return (
    <nav
      className="left-sidebar-nav"
      style={{
        position: "fixed", top: "var(--nav-top-h)", left: 0, bottom: "var(--ticker-h)",
        width: "var(--nav-left-w)", zIndex: 40,
        background: "var(--color-panel)", borderRight: "1px solid var(--color-border)",
        display: "flex", flexDirection: "column", padding: "0.75rem 0", overflowY: "auto",
      }}
    >
      {NAV_ITEMS.map((item) => (
        <React.Fragment key={item.key}>
          {item.dividerBefore && (
            <div style={{ borderTop: "1px solid var(--color-border)", margin: "0.5rem 0" }} />
          )}
          <Link
            href={item.href}
            style={{
              display: "flex", alignItems: "center", gap: "0.625rem",
              padding: "0.625rem 1rem",
              color: active === item.key ? "var(--color-brand)" : "var(--color-text)",
              background: active === item.key ? "rgba(92,74,50,0.08)" : "transparent",
              borderLeft: active === item.key
                ? "3px solid var(--color-brand)"
                : "3px solid transparent",
              textDecoration: "none",
              fontSize: "0.875rem",
              fontWeight: active === item.key ? 600 : 400,
              transition: "background 0.15s",
            }}
          >
            <span style={{ fontSize: "1.1rem" }}>{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </Link>
        </React.Fragment>
      ))}
      <div style={{ borderTop: "1px solid var(--color-border)", margin: "0.5rem 0" }} />
      {ACTION_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          style={{
            display: "flex", alignItems: "center", gap: "0.625rem",
            padding: "0.5rem 1rem",
            color: "rgba(100,180,255,0.85)",
            background: "rgba(100,180,255,0.07)",
            borderLeft: "3px solid rgba(100,180,255,0.35)",
            textDecoration: "none",
            fontSize: "0.82rem",
            fontWeight: 600,
            transition: "background 0.15s",
          }}
        >
          <span style={{ fontSize: "1rem", lineHeight: 1 }}>{link.icon}</span>
          <span className="sidebar-label">{link.label}</span>
        </Link>
      ))}
    </nav>
  );
}

// ── RightContextPanel ─────────────────────────────────────────────────────────

export function RightContextPanel({
  open,
  title,
  content,
  onClose,
}: {
  open: boolean;
  title: string;
  content: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <aside
      style={{
        position: "fixed", top: "var(--nav-top-h)", right: 0, bottom: "var(--ticker-h)",
        width: "var(--panel-right-w)", zIndex: 40,
        background: "var(--color-panel)", borderLeft: "1px solid var(--color-border)",
        boxShadow: "-4px 0 16px rgba(0,0,0,0.08)",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.22s cubic-bezier(0.4,0,0.2,1)",
        display: "flex", flexDirection: "column",
        pointerEvents: open ? "auto" : "none",
      }}
      aria-hidden={!open}
    >
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "0.75rem 1rem", borderBottom: "1px solid var(--color-border)",
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>
          {title || "상세 정보"}
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "1.125rem", color: "var(--color-muted)", lineHeight: 1,
          }}
          aria-label="패널 닫기"
        >
          ✕
        </button>
      </div>
      <div style={{ flex: 1, padding: "1rem", overflowY: "auto", fontSize: "0.8rem" }}>
        {content ?? (
          <span style={{ color: "var(--color-muted)" }}>
            항목을 클릭하면 상세 정보가 표시됩니다.
          </span>
        )}
      </div>
    </aside>
  );
}
