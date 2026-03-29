"use client";
import React from "react";

interface LoadStateBlockProps {
  message: string;
  tone?: "muted" | "error";
  actionLabel?: string;
  onAction?: () => void;
}

export default function LoadStateBlock({ message, tone = "muted", actionLabel, onAction }: LoadStateBlockProps) {
  return (
    <div style={{ padding: "1rem", display: "grid", gap: "0.6rem", justifyItems: "start" }}>
      <div style={{ color: tone === "error" ? "var(--color-toxic-red)" : "var(--color-muted)" }}>{message}</div>
      {actionLabel && onAction ? (
        <button
          onClick={onAction}
          style={{ border: "1px solid var(--color-border)", background: "var(--color-panel)", color: "var(--color-text)", borderRadius: 8, padding: "0.4rem 0.7rem", cursor: "pointer" }}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
