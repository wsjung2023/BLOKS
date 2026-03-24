// IsometricWorldCanvas — PixiJS 2.5D company world with real character data
"use client";
import React, {
  useEffect, useRef, useState, useCallback, useContext, useMemo,
} from "react";
import { ContextPanelContext } from "../layout/AppShell-nav";

// ── Constants ─────────────────────────────────────────────────────────────────

const GRID_COLS = 12;
const GRID_ROWS = 10;
const TILE_W = 64;
const TILE_H = 32;
const TILE_DEPTH = 10;
const DESK_W = TILE_W * 0.48;
const DESK_H = TILE_H * 0.48;
const DESK_DEPTH = 5;
const DESK_COLOR = 0xe8d9b8;

const API_BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";
const AUTH_HEADERS = { Authorization: "Bearer dev-bypass" };

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface ContextMenu {
  x: number;
  y: number;
  character: Character;
}

// ── Zone / grid helpers ───────────────────────────────────────────────────────

const ZONE_COLORS: Record<string, number> = {
  engineering: 0xc8deff,
  marketing:   0xffddc8,
  design:      0xd4f5d4,
  finance:     0xfff3c8,
  management:  0xf0d4f5,
};

const ZONE_MAP: string[][] = Array.from({ length: GRID_ROWS }, (_, row) =>
  Array.from({ length: GRID_COLS }, (_, col) => {
    if (col < 4)  return "engineering";
    if (col < 7)  return row < 5 ? "marketing" : "design";
    if (col < 10) return "finance";
    return "management";
  })
);

const ZONE_LABELS = [
  { col: 1,  row: 4, label: "🛠 엔지니어링" },
  { col: 5,  row: 1, label: "📣 마케팅" },
  { col: 5,  row: 7, label: "🎨 디자인" },
  { col: 8,  row: 4, label: "💰 재무" },
  { col: 10, row: 4, label: "🏛 경영" },
];

const DIVISION_TO_ZONE: Record<string, string> = {
  engineering: "engineering",
  product:     "engineering",
  marketing:   "marketing",
  design:      "design",
  finance:     "finance",
  management:  "management",
  executive:   "management",
  hr:          "management",
  operations:  "management",
};

const DIVISION_COLORS: Record<string, number> = {
  engineering: 0x5c9ce6,
  product:     0x5c9ce6,
  marketing:   0xe6905c,
  design:      0x5ce6a0,
  finance:     0xe6c85c,
  management:  0xb05ce6,
  executive:   0xe65ca0,
  hr:          0x5ce6d6,
};

function isoToScreen(col: number, row: number, ox: number, oy: number) {
  return {
    x: ox + (col - row) * (TILE_W / 2),
    y: oy + (col + row) * (TILE_H / 2),
  };
}

function shadeColor(color: number, amt: number): number {
  const r = Math.max(0, Math.min(255, ((color >> 16) & 0xff) + amt));
  const g = Math.max(0, Math.min(255, ((color >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (color & 0xff) + amt));
  return (r << 16) | (g << 8) | b;
}

function getRuntime(char: Character): RuntimeState {
  const rs = char.character_runtime_states;
  const fallback: RuntimeState = {
    runtime_status: "Idle", workload_score: 0,
    fatigue_score: 0, burnout_triggered: false, current_task_count: 0,
  };
  if (!rs) return fallback;
  return Array.isArray(rs) ? (rs[0] ?? fallback) : rs;
}

function getZoneTiles(zone: string): { col: number; row: number }[] {
  const tiles: { col: number; row: number }[] = [];
  for (let row = 0; row < GRID_ROWS; row++)
    for (let col = 0; col < GRID_COLS; col++)
      if (ZONE_MAP[row]?.[col] === zone) tiles.push({ col, row });
  return tiles;
}

function assignPositions(chars: Character[]): Map<string, { col: number; row: number }> {
  const byZone: Record<string, Character[]> = {};
  for (const c of chars) {
    const zone = DIVISION_TO_ZONE[(c.divisions?.code ?? "").toLowerCase()] ?? "management";
    (byZone[zone] ??= []).push(c);
  }
  const result = new Map<string, { col: number; row: number }>();
  for (const [zone, group] of Object.entries(byZone)) {
    const tiles = getZoneTiles(zone);
    const step = Math.max(1, Math.floor(tiles.length / group.length));
    group.forEach((c, i) => {
      result.set(c.id, tiles[(i * step) % tiles.length] ?? { col: 0, row: 0 });
    });
  }
  return result;
}

// ── PixiJS renderer ───────────────────────────────────────────────────────────

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
    width: container.clientWidth || 900,
    height: container.clientHeight || 600,
    backgroundColor: 0xf5f0e8,
    antialias: true,
    resolution: window.devicePixelRatio ?? 1,
    autoDensity: true,
  });
  container.appendChild(app.canvas as HTMLCanvasElement);

  const stage = app.stage;
  const ox = app.screen.width / 2;
  const oy = 80;

  // 1) Tiles
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const zone = ZONE_MAP[row]?.[col] ?? "management";
      const baseColor = ZONE_COLORS[zone] ?? 0xeeeeee;
      const avgWl = zoneWorkload.get(zone) ?? 0;
      const fill = shadeColor(baseColor, avgWl > 70 ? -20 : 0);
      const { x, y } = isoToScreen(col, row, ox, oy);

      const t = new PIXI.Graphics();
      // top face
      t.moveTo(x, y).lineTo(x + TILE_W / 2, y + TILE_H / 2)
        .lineTo(x, y + TILE_H).lineTo(x - TILE_W / 2, y + TILE_H / 2).closePath();
      t.fill({ color: fill, alpha: 0.9 });
      t.stroke({ color: 0xd4c9b0, width: 0.5, alpha: 0.6 });
      // left depth
      t.moveTo(x - TILE_W / 2, y + TILE_H / 2).lineTo(x, y + TILE_H)
        .lineTo(x, y + TILE_H + TILE_DEPTH).lineTo(x - TILE_W / 2, y + TILE_H / 2 + TILE_DEPTH).closePath();
      t.fill({ color: shadeColor(fill, -30), alpha: 0.9 });
      t.stroke({ color: 0xd4c9b0, width: 0.5, alpha: 0.4 });
      // right depth
      t.moveTo(x, y + TILE_H).lineTo(x + TILE_W / 2, y + TILE_H / 2)
        .lineTo(x + TILE_W / 2, y + TILE_H / 2 + TILE_DEPTH).lineTo(x, y + TILE_H + TILE_DEPTH).closePath();
      t.fill({ color: shadeColor(fill, -50), alpha: 0.9 });
      t.stroke({ color: 0xd4c9b0, width: 0.5, alpha: 0.4 });
      stage.addChild(t);
    }
  }

  // 2) Zone overload overlay (pulsing orange tint drawn statically at low alpha)
  for (const [zone, wl] of zoneWorkload.entries()) {
    if (wl <= 70) continue;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (ZONE_MAP[row]?.[col] !== zone) continue;
        const { x, y } = isoToScreen(col, row, ox, oy);
        const ov = new PIXI.Graphics();
        ov.moveTo(x, y).lineTo(x + TILE_W / 2, y + TILE_H / 2)
          .lineTo(x, y + TILE_H).lineTo(x - TILE_W / 2, y + TILE_H / 2).closePath();
        ov.fill({ color: 0xff6d00, alpha: 0.13 });
        stage.addChild(ov);
      }
    }
  }

  // 3) Zone labels
  for (const { col, row, label } of ZONE_LABELS) {
    const { x, y } = isoToScreen(col, row, ox, oy);
    const txt = new PIXI.Text({
      text: label,
      style: { fontSize: 11, fill: 0x5c4a32, fontFamily: "system-ui", fontWeight: "600" },
    });
    txt.x = x - txt.width / 2;
    txt.y = y - 8;
    stage.addChild(txt);
  }

  // 4) Desks + characters
  for (const [id, pos] of posMap.entries()) {
    const char = characters.find((c) => c.id === id);
    if (!char) continue;
    const { x, y } = isoToScreen(pos.col, pos.row, ox, oy);
    const rt = getRuntime(char);
    const overloaded = rt.current_task_count >= 3 || rt.runtime_status === "Overloaded";
    const fatigue = rt.fatigue_score;

    // Desk
    const dy = y - 6;
    const desk = new PIXI.Graphics();
    desk.moveTo(x, dy).lineTo(x + DESK_W / 2, dy + DESK_H / 2)
      .lineTo(x, dy + DESK_H).lineTo(x - DESK_W / 2, dy + DESK_H / 2).closePath();
    desk.fill({ color: DESK_COLOR, alpha: 0.95 });
    desk.stroke({ color: 0xb0a080, width: 0.5 });
    // desk side
    desk.moveTo(x - DESK_W / 2, dy + DESK_H / 2).lineTo(x, dy + DESK_H)
      .lineTo(x, dy + DESK_H + DESK_DEPTH).lineTo(x - DESK_W / 2, dy + DESK_H / 2 + DESK_DEPTH).closePath();
    desk.fill({ color: shadeColor(DESK_COLOR, -40), alpha: 0.95 });
    stage.addChild(desk);

    // Overloaded paper stacks
    if (overloaded) {
      const papers = new PIXI.Graphics();
      for (let i = 0; i < 3; i++) {
        papers.rect(x + 5 + i * 3, dy - 2 - i * 3, 7, 9)
          .fill({ color: 0xfafafa, alpha: 0.9 });
        papers.stroke({ color: 0xcccccc, width: 0.5 });
      }
      stage.addChild(papers);
    }

    // Avatar circle
    const divCode = (char.divisions?.code ?? "management").toLowerCase();
    const avatarColor = DIVISION_COLORS[divCode] ?? 0x8a8a8a;
    const alpha = Math.max(0.35, 1 - fatigue / 160);
    const ax = x;
    const ay = dy - 12;

    const avatar = new PIXI.Graphics();
    avatar.circle(0, 0, 9).fill({ color: avatarColor, alpha });
    avatar.circle(0, 0, 9).stroke({ color: 0xffffff, width: 1.5, alpha: 0.9 });
    if (rt.burnout_triggered) {
      avatar.circle(0, 0, 12).stroke({ color: 0xff1744, width: 2, alpha: 0.9 });
    }
    avatar.x = ax;
    avatar.y = ay;
    avatar.eventMode = "static";
    avatar.cursor = "pointer";
    avatar.on("pointerup", () => onCharClick(char));
    avatar.on("rightclick", (e: { global: { x: number; y: number } }) => {
      onCharRightClick(e.global.x, e.global.y, char);
    });
    stage.addChild(avatar);

    // Name label
    const nameLabel = new PIXI.Text({
      text: char.name,
      style: { fontSize: 9, fill: 0x3d3529, fontFamily: "system-ui" },
    });
    nameLabel.x = ax - nameLabel.width / 2;
    nameLabel.y = ay + 12;
    stage.addChild(nameLabel);

    // Burnout cloud icon
    if (rt.burnout_triggered) {
      const cloud = new PIXI.Text({ text: "☁", style: { fontSize: 12, fill: 0xff1744 } });
      cloud.x = ax - cloud.width / 2;
      cloud.y = ay - 26;
      stage.addChild(cloud);
    }
  }

  return app;
}

// ── Character detail panel content ────────────────────────────────────────────

function CharacterDetail({ char }: { char: Character }) {
  const rt = getRuntime(char);
  const fatigueColor = rt.fatigue_score > 70
    ? "var(--color-toxic-red)"
    : rt.fatigue_score > 40
    ? "var(--color-toxic-orange)"
    : "inherit";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{char.name}</div>
        <div style={{ color: "var(--color-muted)", fontSize: "0.72rem" }}>
          {char.code_name} · {char.active_mode}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.35rem 0.75rem", fontSize: "0.78rem" }}>
        <span style={{ color: "var(--color-muted)" }}>부서</span>
        <span>{char.divisions?.name ?? "—"}</span>
        <span style={{ color: "var(--color-muted)" }}>직급</span>
        <span>{char.ranks?.name ?? "—"}</span>
        <span style={{ color: "var(--color-muted)" }}>역할</span>
        <span>{char.roles?.name ?? "—"}</span>
      </div>
      <hr style={{ border: "none", borderTop: "1px solid var(--color-border)", margin: 0 }} />
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.35rem 0.75rem", fontSize: "0.78rem" }}>
        <span style={{ color: "var(--color-muted)" }}>피로도</span>
        <span style={{ color: fatigueColor }}>{rt.fatigue_score}%</span>
        <span style={{ color: "var(--color-muted)" }}>워크로드</span>
        <span>{rt.workload_score}%</span>
        <span style={{ color: "var(--color-muted)" }}>상태</span>
        <span>{rt.runtime_status}</span>
        <span style={{ color: "var(--color-muted)" }}>태스크 수</span>
        <span>{rt.current_task_count}</span>
        <span style={{ color: "var(--color-muted)" }}>번아웃</span>
        <span style={{ color: rt.burnout_triggered ? "var(--color-toxic-red)" : "inherit" }}>
          {rt.burnout_triggered ? "⚠ 발동됨" : "정상"}
        </span>
      </div>
    </div>
  );
}

// ── React component ───────────────────────────────────────────────────────────

export default function IsometricWorldCanvas() {
  const { openPanel } = useContext(ContextPanelContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<{ destroy: (o?: { removeView?: boolean }) => void } | null>(null);
  const openPanelRef = useRef(openPanel);
  useEffect(() => { openPanelRef.current = openPanel; }, [openPanel]);

  const [characters, setCharacters] = useState<Character[]>([]);

  // Fetch all characters
  useEffect(() => {
    fetch(`${API_BASE}/characters?pageSize=100`, { headers: AUTH_HEADERS })
      .then((r) => r.json())
      .then((body: { data?: { items?: Character[] } }) => {
        setCharacters(body.data?.items ?? []);
      })
      .catch(() => {});
  }, []);

  // Avg workload per zone
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
    for (const [zone, total] of totals.entries())
      avg.set(zone, total / (counts.get(zone) ?? 1));
    return avg;
  }, [characters]);

  const handleCharClick = useCallback((char: Character) => {
    openPanelRef.current(char.name, <CharacterDetail char={char} />);
  }, []);

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  const handleRightClick = useCallback((x: number, y: number, char: Character) => {
    setContextMenu({ x, y, character: char });
  }, []);

  // Init Pixi when characters load
  useEffect(() => {
    if (!containerRef.current || characters.length === 0) return;
    const container = containerRef.current;
    let cancelled = false;
    const posMap = assignPositions(characters);

    initPixi(container, characters, posMap, zoneWorkload, handleCharClick, handleRightClick)
      .then((app) => {
        if (cancelled) { app.destroy({ removeView: true }); return; }
        appRef.current = app;
      })
      .catch((err: unknown) => console.error("[IsometricWorldCanvas]", err));

    return () => {
      cancelled = true;
      appRef.current?.destroy({ removeView: true });
      appRef.current = null;
      while (container.firstChild) container.removeChild(container.firstChild);
    };
  }, [characters, zoneWorkload, handleCharClick, handleRightClick]);

  // Dismiss context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const dismiss = () => setContextMenu(null);
    window.addEventListener("pointerdown", dismiss);
    return () => window.removeEventListener("pointerdown", dismiss);
  }, [contextMenu]);

  const MENU_ACTIONS = [
    {
      label: "🔍 상세 보기",
      action: (c: Character) => { handleCharClick(c); setContextMenu(null); },
    },
    { label: "💬 면담 호출", action: () => setContextMenu(null) },
    { label: "😴 강제 휴식", action: () => setContextMenu(null) },
  ];

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        width: "100%", height: "100%",
        overflow: "hidden", background: "var(--color-bg)",
        position: "relative",
      }}
      aria-label="아이소메트릭 회사 월드"
    >
      {characters.length === 0 && (
        <div
          style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--color-muted)", fontSize: "0.875rem",
          }}
        >
          월드 로딩 중...
        </div>
      )}

      {contextMenu && (
        <div
          style={{
            position: "absolute",
            left: contextMenu.x,
            top: contextMenu.y,
            background: "var(--color-panel)",
            border: "1px solid var(--color-border)",
            borderRadius: "0.375rem",
            boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
            zIndex: 100,
            overflow: "hidden",
            minWidth: "9rem",
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {MENU_ACTIONS.map(({ label, action }) => (
            <button
              key={label}
              onClick={() => action(contextMenu.character)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "0.5rem 0.75rem",
                background: "none", border: "none",
                cursor: "pointer", fontSize: "0.8rem",
                color: "var(--color-text)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(92,74,50,0.08)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "none";
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
