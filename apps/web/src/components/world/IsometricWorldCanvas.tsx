// IsometricWorldCanvas — PixiJS 2.5D company world with real character data
"use client";
import React, { useEffect, useRef, useState, useCallback, useContext, useMemo } from "react";
import { ContextPanelContext } from "../layout/AppShell-nav";
import {
  GRID_COLS, GRID_ROWS, TILE_W, TILE_H, TILE_DEPTH,
  DESK_W, DESK_H, DESK_DEPTH, DESK_COLOR,
  ZONE_COLORS, ZONE_MAP, ZONE_LABELS, DIVISION_TO_ZONE, DIVISION_COLORS,
  ZONE_FLOOR_URLS, codeNameToSpriteUrl, getInitials, isoToScreen, shadeColor, buildEffect,
} from "./world-sprites";

const API_BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";
const AUTH_HEADERS = { Authorization: "Bearer dev-bypass" };

// ── Types ──────────────────────────────────────────────────────────────────────

interface RuntimeState {
  runtime_status: string;
  workload_score: number;
  fatigue_score: number;
  burnout_triggered: boolean;
  current_task_count: number;
}

interface Character {
  id: string;
  name: string;
  code_name: string;
  active_mode: string;
  divisions?: { code: string; name: string };
  ranks?: { name: string };
  roles?: { name: string };
  character_runtime_states?: RuntimeState | RuntimeState[];
}

interface ContextMenu { x: number; y: number; character: Character }

// ── Helpers ─────────────────────────────────────────────────────────────────────

function getRuntime(char: Character): RuntimeState {
  const rs = char.character_runtime_states;
  const fb: RuntimeState = { runtime_status: "Idle", workload_score: 0, fatigue_score: 0, burnout_triggered: false, current_task_count: 0 };
  if (!rs) return fb;
  return Array.isArray(rs) ? (rs[0] ?? fb) : rs;
}

function getZoneTiles(zone: string) {
  const tiles: { col: number; row: number }[] = [];
  for (let row = 0; row < GRID_ROWS; row++)
    for (let col = 0; col < GRID_COLS; col++)
      if (ZONE_MAP[row]?.[col] === zone) tiles.push({ col, row });
  return tiles;
}

function assignPositions(chars: Character[]) {
  const byZone: Record<string, Character[]> = {};
  for (const c of chars) {
    const zone = DIVISION_TO_ZONE[(c.divisions?.code ?? "").toLowerCase()] ?? "management";
    (byZone[zone] ??= []).push(c);
  }
  const result = new Map<string, { col: number; row: number }>();
  for (const [zone, group] of Object.entries(byZone)) {
    const tiles = getZoneTiles(zone);
    const step = Math.max(1, Math.floor(tiles.length / group.length));
    group.forEach((c, i) => { result.set(c.id, tiles[(i * step) % tiles.length] ?? { col: 0, row: 0 }); });
  }
  return result;
}

// ── PixiJS renderer ─────────────────────────────────────────────────────────────

async function initPixi(
  container: HTMLDivElement,
  characters: Character[],
  posMap: Map<string, { col: number; row: number }>,
  zoneWorkload: Map<string, number>,
  onCharClick: (char: Character) => void,
  onCharRightClick: (x: number, y: number, char: Character) => void,
) {
  const PIXI = await import("pixi.js");
  const app = new PIXI.Application();
  await app.init({
    width: Math.max(container.clientWidth, 1100) || 1100, height: Math.max(container.clientHeight, 700) || 700,
    backgroundColor: 0xf5f0e8, antialias: true,
    resolution: window.devicePixelRatio ?? 1, autoDensity: true,
  });
  container.appendChild(app.canvas as HTMLCanvasElement);
  const { stage } = app;
  const ox = app.screen.width / 2;
  const oy = 80;

  // Pre-load textures
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const load = (url: string): Promise<any> => PIXI.Assets.load(url).catch(() => null);
  const [deskTex, ringTex, burnoutTex, zzzTex] = await Promise.all([
    load("/sprites/furniture-desk-single.png"), load("/sprites/nav-selected-ring.png"),
    load("/sprites/effect-burnout-cloud.png"),  load("/sprites/effect-zzz-sleep.png"),
  ]);
  const charTexArr = await Promise.all(characters.map((c) => load(codeNameToSpriteUrl(c.code_name))));
  const charTexMap = new Map(characters.map((c, i) => [c.id, charTexArr[i]]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const floorTexMap = new Map<string, any>();
  await Promise.all(Object.entries(ZONE_FLOOR_URLS).map(async ([z, url]) => {
    const t = await load(url); if (t) floorTexMap.set(z, t);
  }));

  // Floor tiles
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const zone = ZONE_MAP[row]?.[col] ?? "management";
      const base = ZONE_COLORS[zone] ?? 0xeeeeee;
      const wl = zoneWorkload.get(zone) ?? 0;
      const fill = shadeColor(base, wl > 70 ? -20 : 0);
      const { x, y } = isoToScreen(col, row, ox, oy);
      const ft = floorTexMap.get(zone);
      const t = new PIXI.Graphics();
      t.moveTo(x, y).lineTo(x + TILE_W/2, y + TILE_H/2).lineTo(x, y + TILE_H).lineTo(x - TILE_W/2, y + TILE_H/2).closePath();
      t.fill(ft ? { texture: ft, alpha: 0.85 } : { color: fill, alpha: 0.9 });
      t.stroke({ color: 0xd4c9b0, width: 0.5, alpha: 0.6 });
      t.moveTo(x - TILE_W/2, y + TILE_H/2).lineTo(x, y + TILE_H).lineTo(x, y + TILE_H + TILE_DEPTH).lineTo(x - TILE_W/2, y + TILE_H/2 + TILE_DEPTH).closePath();
      t.fill({ color: shadeColor(fill, -30), alpha: 0.9 }).stroke({ color: 0xd4c9b0, width: 0.5, alpha: 0.4 });
      t.moveTo(x, y + TILE_H).lineTo(x + TILE_W/2, y + TILE_H/2).lineTo(x + TILE_W/2, y + TILE_H/2 + TILE_DEPTH).lineTo(x, y + TILE_H + TILE_DEPTH).closePath();
      t.fill({ color: shadeColor(fill, -50), alpha: 0.9 }).stroke({ color: 0xd4c9b0, width: 0.5, alpha: 0.4 });
      stage.addChild(t);
    }
  }

  // Zone overload overlay
  for (const [zone, wl] of zoneWorkload.entries()) {
    if (wl <= 70) continue;
    for (let row = 0; row < GRID_ROWS; row++)
      for (let col = 0; col < GRID_COLS; col++) {
        if (ZONE_MAP[row]?.[col] !== zone) continue;
        const { x, y } = isoToScreen(col, row, ox, oy);
        const ov = new PIXI.Graphics();
        ov.moveTo(x, y).lineTo(x + TILE_W/2, y + TILE_H/2).lineTo(x, y + TILE_H).lineTo(x - TILE_W/2, y + TILE_H/2).closePath();
        ov.fill({ color: 0xff6d00, alpha: 0.13 });
        stage.addChild(ov);
      }
  }

  // Zone labels
  for (const { col, row, label } of ZONE_LABELS) {
    const { x, y } = isoToScreen(col, row, ox, oy);
    const txt = new PIXI.Text({ text: label, style: { fontSize: 11, fill: 0x5c4a32, fontFamily: "system-ui", fontWeight: "600" } });
    txt.x = x - txt.width / 2; txt.y = y - 8;
    stage.addChild(txt);
  }

  // Desks ??drawn before ring/sprites for correct z-order
  for (const [id, pos] of posMap.entries()) {
    const char = characters.find((c) => c.id === id);
    if (!char) continue;
    const { x, y } = isoToScreen(pos.col, pos.row, ox, oy);
    const rt = getRuntime(char);
    if (deskTex) {
      const desk = new PIXI.Sprite(deskTex);
      desk.anchor.set(0.5, 1.0); desk.width = 48; desk.height = 32; desk.x = x; desk.y = y + 4;
      stage.addChild(desk);
    } else {
      const dy = y - 6;
      const desk = new PIXI.Graphics();
      desk.moveTo(x, dy).lineTo(x + DESK_W/2, dy + DESK_H/2).lineTo(x, dy + DESK_H).lineTo(x - DESK_W/2, dy + DESK_H/2).closePath();
      desk.fill({ color: DESK_COLOR, alpha: 0.95 }).stroke({ color: 0xb0a080, width: 0.5 });
      desk.moveTo(x - DESK_W/2, dy + DESK_H/2).lineTo(x, dy + DESK_H).lineTo(x, dy + DESK_H + DESK_DEPTH).lineTo(x - DESK_W/2, dy + DESK_H/2 + DESK_DEPTH).closePath();
      desk.fill({ color: shadeColor(DESK_COLOR, -40), alpha: 0.95 });
      stage.addChild(desk);
    }
    if (rt.current_task_count >= 3 || rt.runtime_status === "Overloaded") {
      const papers = new PIXI.Graphics();
      for (let i = 0; i < 3; i++) papers.rect(x + 5 + i * 3, y - 8 - i * 3, 7, 9).fill({ color: 0xfafafa, alpha: 0.9 }).stroke({ color: 0xcccccc, width: 0.5 });
      stage.addChild(papers);
    }
  }

  // Selected ring ??above desks, below character sprites
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ring: any = null;
  if (ringTex) {
    ring = new PIXI.Sprite(ringTex);
    ring.anchor.set(0.5, 0.5); ring.width = 72; ring.height = 36; ring.visible = false;
    stage.addChild(ring);
  }

  // Character sprites + effects
  for (const [id, pos] of posMap.entries()) {
    const char = characters.find((c) => c.id === id);
    if (!char) continue;
    const { x, y } = isoToScreen(pos.col, pos.row, ox, oy);
    const { fatigue_score: fat, burnout_triggered: burnout } = getRuntime(char);
    const sy = y - 10; // sprite feet Y
    const charTex = charTexMap.get(id);
    const onPick = () => { if (ring) { ring.x = x; ring.y = sy; ring.visible = true; } onCharClick(char); };
    const onRight = (e: { global: { x: number; y: number } }) => onCharRightClick(e.global.x, e.global.y, char);

    if (charTex) {
      const sp = new PIXI.Sprite(charTex);
      sp.anchor.set(0.5, 1.0); sp.width = 72; sp.height = 56; sp.x = x; sp.y = sy;
      sp.eventMode = "static"; sp.cursor = "pointer";
      sp.on("pointerup", onPick); sp.on("rightclick", onRight);
      stage.addChild(sp);
    } else {
      // Fallback: colored circle with initials
      const col = DIVISION_COLORS[(char.divisions?.code ?? "management").toLowerCase()] ?? 0x8a8a8a;
      const alpha = Math.max(0.35, 1 - fat / 160);
      const av = new PIXI.Graphics();
      av.circle(0, 0, 9).fill({ color: col, alpha }).stroke({ color: 0xffffff, width: 1.5, alpha: 0.9 });
      if (burnout) av.circle(0, 0, 12).stroke({ color: 0xff1744, width: 2, alpha: 0.9 });
      av.x = x; av.y = sy; av.eventMode = "static"; av.cursor = "pointer";
      av.on("pointerup", onPick); av.on("rightclick", onRight);
      stage.addChild(av);
      const ini = new PIXI.Text({ text: getInitials(char.name), style: { fontSize: 7, fill: 0xffffff, fontFamily: "system-ui", fontWeight: "bold" } });
      ini.anchor.set(0.5, 0.5); ini.x = x; ini.y = sy;
      stage.addChild(ini);
    }

    const lbl = new PIXI.Text({ text: char.name, style: { fontSize: 9, fill: 0x3d3529, fontFamily: "system-ui" } });
    lbl.x = x - lbl.width / 2; lbl.y = sy + 4;
    stage.addChild(lbl);

    if (burnout) stage.addChild(buildEffect(PIXI, burnoutTex, x, sy - 60, 40, 32, "fire", 0xff1744));
    if (fat > 70) stage.addChild(buildEffect(PIXI, zzzTex, x + 16, sy - 40, 32, 28, "zzz", 0x4a90e2));
  }

  return app;
}

// ── Character detail panel ──────────────────────────────────────────────────────

function CharacterDetail({ char }: { char: Character }) {
  const rt = getRuntime(char);
  const fc = rt.fatigue_score > 70 ? "var(--color-toxic-red)" : rt.fatigue_score > 40 ? "var(--color-toxic-orange)" : "inherit";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{char.name}</div>
      <div style={{ color: "var(--color-muted)", fontSize: "0.72rem" }}>{char.code_name} &middot; {char.active_mode}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.35rem 0.75rem", fontSize: "0.78rem" }}>
        <span style={{ color: "var(--color-muted)" }}>Fatigue</span><span style={{ color: fc }}>{rt.fatigue_score}%</span>
        <span style={{ color: "var(--color-muted)" }}>Workload</span><span style={{ color: fc }}>{rt.workload_score}%</span>
        <span style={{ color: "var(--color-muted)" }}>Status</span><span>{rt.runtime_status}</span>
        <span style={{ color: "var(--color-muted)" }}>Tasks</span><span>{rt.current_task_count}</span>
        <span style={{ color: "var(--color-muted)" }}>Burnout</span>
        <span style={{ color: rt.burnout_triggered ? "var(--color-toxic-red)" : "inherit" }}>
          {rt.burnout_triggered ? "BURNOUT" : "Normal"}
        </span>
      </div>
    </div>
  );
}

// React component

export default function IsometricWorldCanvas() {
  const { openPanel } = useContext(ContextPanelContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<{ destroy: (o?: { removeView?: boolean }) => void } | null>(null);
  const openPanelRef = useRef(openPanel);
  useEffect(() => { openPanelRef.current = openPanel; }, [openPanel]);

  const [characters, setCharacters] = useState<Character[]>([]);
  useEffect(() => {
    fetch(`${API_BASE}/characters?pageSize=100`, { headers: AUTH_HEADERS })
      .then((r) => r.json())
      .then((body: { data?: { items?: Character[] } }) => setCharacters(body.data?.items ?? []))
      .catch(() => {});
  }, []);

  const zoneWorkload = useMemo(() => {
    const totals = new Map<string, number>();
    const counts = new Map<string, number>();
    for (const c of characters) {
      const zone = DIVISION_TO_ZONE[(c.divisions?.code ?? "").toLowerCase()] ?? "management";
      const wl = getRuntime(c).workload_score;
      totals.set(zone, (totals.get(zone) ?? 0) + wl);
      counts.set(zone, (counts.get(zone) ?? 0) + 1);
    }
    const avg = new Map<string, number>();
    for (const [zone, total] of totals.entries()) avg.set(zone, total / (counts.get(zone) ?? 1));
    return avg;
  }, [characters]);

  const handleCharClick = useCallback((char: Character) => {
    openPanelRef.current(char.name, <CharacterDetail char={char} />);
  }, []);

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const handleRightClick = useCallback((x: number, y: number, char: Character) => {
    setContextMenu({ x, y, character: char });
  }, []);

  useEffect(() => {
    if (!containerRef.current || characters.length === 0) return;
    const container = containerRef.current;
    let cancelled = false;
    initPixi(container, characters, assignPositions(characters), zoneWorkload, handleCharClick, handleRightClick)
      .then((app) => { if (cancelled) { app.destroy({ removeView: true }); return; } appRef.current = app; })
      .catch((err: unknown) => console.error("[IsometricWorldCanvas]", err));
    return () => {
      cancelled = true;
      appRef.current?.destroy({ removeView: true });
      appRef.current = null;
      while (container.firstChild) container.removeChild(container.firstChild);
    };
  }, [characters, zoneWorkload, handleCharClick, handleRightClick]);

  useEffect(() => {
    if (!contextMenu) return;
    const dismiss = () => setContextMenu(null);
    window.addEventListener("pointerdown", dismiss);
    return () => window.removeEventListener("pointerdown", dismiss);
  }, [contextMenu]);

  const MENU_ACTIONS = [
  { label: "View Profile", action: (c) => { handleCharClick(c); setContextMenu(null); } },
  { label: "Send Message", action: () => setContextMenu(null) },
  { label: "Assign Task", action: () => setContextMenu(null) },
  ];

  return (
    <div ref={containerRef} onContextMenu={(e) => e.preventDefault()}
      style={{ width: "100%", height: "100%", overflow: "hidden", background: "var(--color-bg)", position: "relative" }}
  aria-label="Context menu"
    >
      {characters.length === 0 && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-muted)", fontSize: "0.875rem" }}>
    Loading...
        </div>
      )}
      {contextMenu && (
        <div style={{ position: "absolute", left: contextMenu.x, top: contextMenu.y, background: "var(--color-panel)", border: "1px solid var(--color-border)", borderRadius: "0.375rem", boxShadow: "0 4px 12px rgba(0,0,0,0.18)", zIndex: 100, overflow: "hidden", minWidth: "9rem" }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {MENU_ACTIONS.map(({ label, action }) => (
            <button key={label} onClick={() => action(contextMenu.character)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "0.5rem 0.75rem", background: "none", border: "none", cursor: "pointer", fontSize: "0.8rem", color: "var(--color-text)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(92,74,50,0.08)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
            >{label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

