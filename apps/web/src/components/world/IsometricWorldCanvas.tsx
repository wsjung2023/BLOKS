// IsometricWorldCanvas — PixiJS canvas stub with placeholder isometric grid
"use client";

import React, { useEffect, useRef } from "react";

// ── Isometric grid constants ──────────────────────────────────────────────────

const GRID_COLS = 12;
const GRID_ROWS = 10;
const TILE_W = 64;
const TILE_H = 32;
const TILE_DEPTH = 12;

// ── Isometric projection helpers ──────────────────────────────────────────────

function isoToScreen(col: number, row: number, originX: number, originY: number) {
  return {
    x: originX + (col - row) * (TILE_W / 2),
    y: originY + (col + row) * (TILE_H / 2),
  };
}

// ── Zone color palette ────────────────────────────────────────────────────────

const ZONE_COLORS: Record<string, number> = {
  engineering: 0xc8deff,
  marketing:   0xffddc8,
  design:      0xd4f5d4,
  finance:     0xfff3c8,
  management:  0xf0d4f5,
};

const ZONE_MAP: string[][] = Array.from({ length: GRID_ROWS }, (_, row) =>
  Array.from({ length: GRID_COLS }, (_, col) => {
    if (col < 4)                         return "engineering";
    if (col >= 4 && col < 7)             return row < 5 ? "marketing" : "design";
    if (col >= 7 && col < 10)            return "finance";
    return "management";
  })
);

// ── Canvas renderer ───────────────────────────────────────────────────────────

async function initPixi(container: HTMLDivElement) {
  // Dynamic import avoids SSR issues
  const PIXI = await import("pixi.js");

  const app = new PIXI.Application();
  await app.init({
    width: container.clientWidth || 900,
    height: container.clientHeight || 600,
    backgroundColor: 0xf5f0e8,
    antialias: true,
    resolution: window.devicePixelRatio ?? 1,
    autoDensity: true,
  });

  container.appendChild(app.canvas as HTMLCanvasElement);

  const stage = app.stage;
  const originX = app.screen.width / 2;
  const originY = 80;

  // Draw isometric tiles
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const zone = ZONE_MAP[row]?.[col] ?? "management";
      const fillColor = ZONE_COLORS[zone] ?? 0xeeeeee;
      const { x, y } = isoToScreen(col, row, originX, originY);

      const tile = new PIXI.Graphics();

      // Top face
      tile.moveTo(x, y);
      tile.lineTo(x + TILE_W / 2, y + TILE_H / 2);
      tile.lineTo(x, y + TILE_H);
      tile.lineTo(x - TILE_W / 2, y + TILE_H / 2);
      tile.closePath();
      tile.fill({ color: fillColor, alpha: 0.9 });
      tile.stroke({ color: 0xd4c9b0, width: 0.5, alpha: 0.6 });

      // Left depth face
      tile.moveTo(x - TILE_W / 2, y + TILE_H / 2);
      tile.lineTo(x, y + TILE_H);
      tile.lineTo(x, y + TILE_H + TILE_DEPTH);
      tile.lineTo(x - TILE_W / 2, y + TILE_H / 2 + TILE_DEPTH);
      tile.closePath();
      tile.fill({ color: shadeColor(fillColor, -30), alpha: 0.9 });
      tile.stroke({ color: 0xd4c9b0, width: 0.5, alpha: 0.4 });

      // Right depth face
      tile.moveTo(x, y + TILE_H);
      tile.lineTo(x + TILE_W / 2, y + TILE_H / 2);
      tile.lineTo(x + TILE_W / 2, y + TILE_H / 2 + TILE_DEPTH);
      tile.lineTo(x, y + TILE_H + TILE_DEPTH);
      tile.closePath();
      tile.fill({ color: shadeColor(fillColor, -50), alpha: 0.9 });
      tile.stroke({ color: 0xd4c9b0, width: 0.5, alpha: 0.4 });

      stage.addChild(tile);
    }
  }

  // Zone labels
  const ZONE_LABELS: { zone: string; col: number; row: number; label: string }[] = [
    { zone: "engineering", col: 1,  row: 4, label: "🛠 엔지니어링" },
    { zone: "marketing",   col: 5,  row: 2, label: "📣 마케팅" },
    { zone: "design",      col: 5,  row: 6, label: "🎨 디자인" },
    { zone: "finance",     col: 8,  row: 4, label: "💰 재무" },
    { zone: "management",  col: 10, row: 4, label: "🏛 경영" },
  ];

  for (const { col, row, label } of ZONE_LABELS) {
    const { x, y } = isoToScreen(col, row, originX, originY);
    const text = new PIXI.Text({
      text: label,
      style: {
        fontSize: 11,
        fill: 0x5c4a32,
        fontFamily: "system-ui",
        fontWeight: "600",
      },
    });
    text.x = x - text.width / 2;
    text.y = y - 8;
    stage.addChild(text);
  }

  // Placeholder characters as colored circles
  const CHAR_POSITIONS = [
    { col: 2, row: 2, color: 0x5c9ce6, name: "김리더" },
    { col: 3, row: 5, color: 0xe65c5c, name: "박개발" },
    { col: 5, row: 1, color: 0x5ce6a0, name: "최기획" },
    { col: 8, row: 3, color: 0xe6c85c, name: "이재무" },
    { col: 10, row: 3, color: 0xb05ce6, name: "정관리" },
  ];

  for (const char of CHAR_POSITIONS) {
    const { x, y } = isoToScreen(char.col, char.row, originX, originY);
    const dot = new PIXI.Graphics();
    dot.circle(0, 0, 10).fill({ color: char.color });
    dot.circle(0, 0, 10).stroke({ color: 0xffffff, width: 2 });
    dot.x = x;
    dot.y = y;
    dot.eventMode = "static";
    dot.cursor = "pointer";
    stage.addChild(dot);

    const label = new PIXI.Text({
      text: char.name,
      style: { fontSize: 9, fill: 0x3d3529, fontFamily: "system-ui" },
    });
    label.x = x - label.width / 2;
    label.y = y + 13;
    stage.addChild(label);
  }

  return app;
}

// ── Color shading utility ─────────────────────────────────────────────────────

function shadeColor(color: number, amount: number): number {
  const r = Math.max(0, Math.min(255, ((color >> 16) & 0xff) + amount));
  const g = Math.max(0, Math.min(255, ((color >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (color & 0xff) + amount));
  return (r << 16) | (g << 8) | b;
}

// ── React component ───────────────────────────────────────────────────────────

export default function IsometricWorldCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<{ destroy: (opts?: { removeView?: boolean }) => void } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let cancelled = false;

    initPixi(container).then((app) => {
      if (cancelled) {
        app.destroy({ removeView: true });
        return;
      }
      appRef.current = app;
    }).catch((err: unknown) => {
      console.error("[IsometricWorldCanvas] PixiJS 초기화 오류:", err);
    });

    return () => {
      cancelled = true;
      appRef.current?.destroy({ removeView: true });
      appRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", overflow: "hidden", background: "var(--color-bg)" }}
      aria-label="아이소메트릭 회사 월드"
    />
  );
}
