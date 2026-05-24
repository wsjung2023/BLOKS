"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const MAP_COLS = 48;
const MAP_ROWS = 32;
const TILE_PX = 32;
const FULL_W = MAP_COLS * TILE_PX; // 1536
const FULL_H = MAP_ROWS * TILE_PX; // 1024

// ── Tile system ───────────────────────────────────────────────────────────────
type TileType =
  | "void"
  | "floor-wood"
  | "floor-carpet-blue"
  | "floor-carpet-red"
  | "floor-concrete"
  | "floor-tile"
  | "floor-dark"
  | "wall"
  | "wall-glass";

type Tool = "draw" | "fill" | "erase" | "seat" | "zone";
type ResizeHandle = "nw"|"n"|"ne"|"e"|"se"|"s"|"sw"|"w"|"move";

// ── Zone system ────────────────────────────────────────────────────────────────
type ZoneType =
  | "meeting-room" | "ceo-office" | "executive-room"
  | "break-room"   | "cafeteria"  | "kitchen"
  | "bathroom"     | "reception"  | "server-room"
  | "open-space"   | "storage"    | "custom";

interface Zone {
  id: string;
  type: ZoneType;
  label: string;
  x1: number; y1: number; // normalized 0-1
  x2: number; y2: number;
}

const ZONE_COLORS: Record<ZoneType, string> = {
  "meeting-room":   "rgba(100,180,255,0.25)",
  "ceo-office":     "rgba(255,215,0,0.22)",
  "executive-room": "rgba(255,165,0,0.22)",
  "break-room":     "rgba(100,220,120,0.22)",
  "cafeteria":      "rgba(220,160,80,0.22)",
  "kitchen":        "rgba(200,200,80,0.22)",
  "bathroom":       "rgba(160,220,220,0.22)",
  "reception":      "rgba(200,130,220,0.22)",
  "server-room":    "rgba(180,80,80,0.22)",
  "open-space":     "rgba(150,150,255,0.18)",
  "storage":        "rgba(160,140,120,0.22)",
  "custom":         "rgba(200,200,200,0.18)",
};

const ZONE_BORDER: Record<ZoneType, string> = {
  "meeting-room":   "#64b4ff",
  "ceo-office":     "#ffd700",
  "executive-room": "#ffa500",
  "break-room":     "#64dc78",
  "cafeteria":      "#dca050",
  "kitchen":        "#c8c850",
  "bathroom":       "#a0dcdc",
  "reception":      "#c882dc",
  "server-room":    "#b45050",
  "open-space":     "#9696ff",
  "storage":        "#a08c78",
  "custom":         "#aaaaaa",
};

const ZONE_LABELS: Record<ZoneType, string> = {
  "meeting-room":   "회의실",
  "ceo-office":     "사장실",
  "executive-room": "임원실",
  "break-room":     "휴게실",
  "cafeteria":      "카페테리아",
  "kitchen":        "탕비실",
  "bathroom":       "화장실",
  "reception":      "리셉션",
  "server-room":    "서버실",
  "open-space":     "오픈 공간",
  "storage":        "창고",
  "custom":         "커스텀",
};

const ALL_ZONE_TYPES: ZoneType[] = [
  "meeting-room", "ceo-office", "executive-room",
  "break-room", "cafeteria", "kitchen",
  "bathroom", "reception", "server-room",
  "open-space", "storage", "custom",
];

const TILE_COLORS: Record<TileType, string> = {
  "void":              "#0a0a14",
  "floor-wood":        "#c8a870",
  "floor-carpet-blue": "#4a5a8a",
  "floor-carpet-red":  "#8a4a52",
  "floor-concrete":    "#8a8a90",
  "floor-tile":        "#d0d0d8",
  "floor-dark":        "#2a2a38",
  "wall":              "#2a2a3a",
  "wall-glass":        "#7ab0d0",
};

const TILE_LABELS: Record<TileType, string> = {
  "void":              "빈 공간",
  "floor-wood":        "나무 바닥",
  "floor-carpet-blue": "카펫 (파랑)",
  "floor-carpet-red":  "카펫 (빨강)",
  "floor-concrete":    "콘크리트",
  "floor-tile":        "타일",
  "floor-dark":        "어두운 바닥",
  "wall":              "벽",
  "wall-glass":        "유리 벽",
};

const ALL_TILES: TileType[] = [
  "floor-wood", "floor-carpet-blue", "floor-carpet-red",
  "floor-concrete", "floor-tile", "floor-dark",
  "wall", "wall-glass", "void",
];

// Mirrors WorldScene SOLID_OBJECTS — objects that block character movement
const SOLID_OBJECTS = new Set([
  "desk", "executive-desk", "meeting-table", "table", "coffee-table",
  "cabinet", "server-rack", "sofa", "plant",
  "partition", "counter",
]);

// ── Object palette ─────────────────────────────────────────────────────────────
const OBJECTS = [
  { type: "desk",           src: "3f-engineering", label: "책상" },
  { type: "chair",          src: "3f-engineering", label: "의자" },
  { type: "meeting-table",  src: "3f-engineering", label: "회의 테이블" },
  { type: "meeting-chair",  src: "3f-engineering", label: "회의 의자" },
  { type: "partition",      src: "3f-engineering", label: "파티션" },
  { type: "door",           src: "3f-engineering", label: "문" },
  { type: "elevator",       src: "3f-engineering", label: "엘리베이터" },
  { type: "plant",          src: "1f-lobby",       label: "화분" },
  { type: "sofa",           src: "1f-lobby",       label: "소파" },
  { type: "table",          src: "7f-cafe",        label: "테이블" },
  { type: "server-rack",    src: "4f-research",    label: "서버 랙" },
  { type: "poster-board",   src: "5f-marketing",   label: "포스터보드" },
  { type: "executive-desk", src: "8f-executive",   label: "임원 책상" },
  { type: "counter",        src: "7f-cafe",        label: "카운터" },
  { type: "cabinet",        src: "8f-executive",   label: "캐비닛" },
  { type: "coffee-table",   src: "8f-executive",   label: "커피 테이블" },
  { type: "lamp",           src: "6f-planning",    label: "조명" },
];

interface PlacedObj {
  id: string;
  type: string;
  src: string; // source floor dir (e.g. "3f-engineering")
  x: number;  // full-resolution pixel x (0–1536)
  y: number;  // full-resolution pixel y (0–1024)
  flipH: boolean;
  north: boolean; // true = use {type}-n.png
}

interface Seat {
  id: string;
  x: number; // full-res pixel
  y: number;
  type: "desk_seat" | "meeting_seat";
}

// ── Canvas draw ───────────────────────────────────────────────────────────────
function drawTiles(
  ctx: CanvasRenderingContext2D,
  tiles: TileType[][],
  seats: Seat[],
  showGrid: boolean,
) {
  ctx.clearRect(0, 0, FULL_W, FULL_H);

  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      const t = tiles[row]![col]!;
      const x = col * TILE_PX;
      const y = row * TILE_PX;

      ctx.fillStyle = TILE_COLORS[t];
      ctx.fillRect(x, y, TILE_PX, TILE_PX);

      if (t === "floor-wood") {
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.lineWidth = 0.5;
        // horizontal plank lines
        if (Math.floor(row / 2) % 2 === col % 2) {
          ctx.beginPath();
          ctx.moveTo(x, y + 16);
          ctx.lineTo(x + TILE_PX, y + 16);
          ctx.stroke();
        }
      } else if (t === "floor-tile") {
        ctx.strokeStyle = "rgba(0,0,0,0.10)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 1, y + 1, TILE_PX - 2, TILE_PX - 2);
      } else if (t === "wall-glass") {
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.fillRect(x + 3, y + 3, 6, TILE_PX - 6);
      } else if (t === "wall") {
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.fillRect(x + 1, y + 1, TILE_PX - 2, 4);
      }
    }
  }

  // Grid
  if (showGrid) {
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= MAP_COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * TILE_PX, 0); ctx.lineTo(c * TILE_PX, FULL_H); ctx.stroke();
    }
    for (let r = 0; r <= MAP_ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * TILE_PX); ctx.lineTo(FULL_W, r * TILE_PX); ctx.stroke();
    }
  }

  // Seats
  for (const s of seats) {
    ctx.fillStyle = s.type === "meeting_seat" ? "rgba(100,200,100,0.5)" : "rgba(100,150,255,0.5)";
    ctx.beginPath();
    ctx.arc(s.x, s.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = s.type === "meeting_seat" ? "#6f6" : "#6af";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// ── Editor ─────────────────────────────────────────────────────────────────────
export default function MapEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [tiles, setTiles] = useState<TileType[][]>(() =>
    Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill("void") as TileType[])
  );
  const [activeTile, setActiveTile] = useState<TileType>("floor-wood");
  const [tool, setTool] = useState<Tool>("draw");
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(0.45);

  const [objects, setObjects] = useState<PlacedObj[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [activeZoneType, setActiveZoneType] = useState<ZoneType>("meeting-room");
  const [zoneDrawStart, setZoneDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [zoneDragCurrent, setZoneDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [resizingZone, setResizingZone] = useState<{
    zoneId: string; handle: ResizeHandle;
    startX: number; startY: number; orig: Zone;
  } | null>(null);
  const [selectedObjId, setSelectedObjId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; ox: number; oy: number } | null>(null);

  const [floorId, setFloorId] = useState("new-floor");
  const [floorLabel, setFloorLabel] = useState("신규 층");
  const [isPainting, setIsPainting] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── Redraw on change ──────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    drawTiles(ctx, tiles, seats, showGrid);
  }, [tiles, seats, showGrid]);

  // ── Coordinate helpers ────────────────────────────────────────────────────
  const screenToTile = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    const col = Math.floor(x / TILE_PX);
    const row = Math.floor(y / TILE_PX);
    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return null;
    return { col, row, px: x, py: y };
  }, [zoom]);

  // ── Painting ──────────────────────────────────────────────────────────────
  const applyTool = useCallback((col: number, row: number, px: number, py: number) => {
    if (tool === "seat") {
      setSeats(prev => [...prev, {
        id: `seat-${Date.now()}`,
        x: px, y: py,
        type: activeTile === "floor-carpet-blue" ? "meeting_seat" : "desk_seat",
      }]);
      return;
    }
    setTiles(prev => {
      const next = prev.map(r => [...r]);
      next[row]![col] = tool === "erase" ? "void" : activeTile;
      return next;
    });
    setSaved(false);
  }, [tool, activeTile]);

  const floodFill = useCallback((startCol: number, startRow: number) => {
    setTiles(prev => {
      const target = prev[startRow]![startCol]!;
      if (target === activeTile) return prev;
      const next = prev.map(r => [...r]);
      const stack: [number, number][] = [[startCol, startRow]];
      while (stack.length) {
        const [c, r] = stack.pop()!;
        if (c < 0 || c >= MAP_COLS || r < 0 || r >= MAP_ROWS) continue;
        if (next[r]![c] !== target) continue;
        next[r]![c] = activeTile;
        stack.push([c+1,r],[c-1,r],[c,r+1],[c,r-1]);
      }
      return next;
    });
    setSaved(false);
  }, [activeTile]);

  const onCanvasDown = useCallback((e: React.MouseEvent) => {
    const pos = screenToTile(e);
    if (!pos) return;
    if (tool === "fill") { floodFill(pos.col, pos.row); return; }
    if (tool === "zone") {
      setZoneDrawStart({ x: pos.px, y: pos.py });
      setZoneDragCurrent({ x: pos.px, y: pos.py });
      setIsPainting(true);
      return;
    }
    setIsPainting(true);
    applyTool(pos.col, pos.row, pos.px, pos.py);
    setSelectedObjId(null);
  }, [screenToTile, tool, floodFill, applyTool]);

  const onCanvasMove = useCallback((e: React.MouseEvent) => {
    if (!isPainting) return;
    if (tool === "zone") {
      const pos = screenToTile(e);
      if (pos) setZoneDragCurrent({ x: pos.px, y: pos.py });
      return;
    }
    if (tool === "fill" || tool === "seat") return;
    const pos = screenToTile(e);
    if (pos) applyTool(pos.col, pos.row, pos.px, pos.py);
  }, [isPainting, tool, screenToTile, applyTool]);

  // ── Object operations ─────────────────────────────────────────────────────
  const addObject = useCallback((type: string, src: string) => {
    const id = `${type}-${Date.now()}`;
    setObjects(prev => [...prev, {
      id, type, src,
      x: FULL_W * 0.35, y: FULL_H * 0.35,
      flipH: false, north: false,
    }]);
    setSelectedObjId(id);
    setSaved(false);
  }, []);

  const onObjMouseDown = useCallback((e: React.MouseEvent, obj: PlacedObj) => {
    e.stopPropagation();
    setSelectedObjId(obj.id);
    const container = containerRef.current!;
    const rect = container.getBoundingClientRect();
    // offset from mouse to object top-left corner in screen coords
    const ox = e.clientX - rect.left - obj.x * zoom;
    const oy = e.clientY - rect.top  - obj.y * zoom;
    setDragging({ id: obj.id, ox, oy });
  }, [zoom]);

  const onContainerMouseMove = useCallback((e: React.MouseEvent) => {
    onCanvasMove(e);
    if (dragging) {
      const container = containerRef.current!;
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left - dragging.ox) / zoom;
      const y = (e.clientY - rect.top  - dragging.oy) / zoom;
      setObjects(prev => prev.map(o =>
        o.id === dragging.id ? { ...o, x: Math.max(0, Math.min(FULL_W, x)), y: Math.max(0, Math.min(FULL_H, y)) } : o
      ));
    }
    if (resizingZone) {
      const container = containerRef.current!;
      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const dx = (mx - resizingZone.startX) / zoom / FULL_W;
      const dy = (my - resizingZone.startY) / zoom / FULL_H;
      const { orig, handle } = resizingZone;
      setZones(prev => prev.map(z => {
        if (z.id !== resizingZone.zoneId) return z;
        let { x1, y1, x2, y2 } = orig;
        if (handle === "move") { x1 += dx; x2 += dx; y1 += dy; y2 += dy; }
        else {
          if (handle.includes("n")) y1 = Math.min(orig.y1 + dy, y2 - 0.02);
          if (handle.includes("s")) y2 = Math.max(orig.y2 + dy, y1 + 0.02);
          if (handle.includes("w")) x1 = Math.min(orig.x1 + dx, x2 - 0.02);
          if (handle.includes("e")) x2 = Math.max(orig.x2 + dx, x1 + 0.02);
        }
        return { ...z,
          x1: Math.max(0, Math.min(1, x1)), y1: Math.max(0, Math.min(1, y1)),
          x2: Math.max(0, Math.min(1, x2)), y2: Math.max(0, Math.min(1, y2)),
        };
      }));
      setSaved(false);
    }
  }, [onCanvasMove, dragging, resizingZone, zoom]);

  const stopInteraction = useCallback(() => {
    setIsPainting(false);
    setDragging(null);
    setResizingZone(null);
    // Finalize zone rectangle
    if (tool === "zone" && zoneDrawStart && zoneDragCurrent) {
      const x1 = Math.min(zoneDrawStart.x, zoneDragCurrent.x) / FULL_W;
      const y1 = Math.min(zoneDrawStart.y, zoneDragCurrent.y) / FULL_H;
      const x2 = Math.max(zoneDrawStart.x, zoneDragCurrent.x) / FULL_W;
      const y2 = Math.max(zoneDrawStart.y, zoneDragCurrent.y) / FULL_H;
      if (x2 - x1 > 0.02 && y2 - y1 > 0.02) {
        setZones(prev => [...prev, {
          id: `zone-${Date.now()}`,
          type: activeZoneType,
          label: ZONE_LABELS[activeZoneType],
          x1, y1, x2, y2,
        }]);
        setSaved(false);
      }
    }
    setZoneDrawStart(null);
    setZoneDragCurrent(null);
  }, [tool, zoneDrawStart, zoneDragCurrent, activeZoneType]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const saveMap = async () => {
    const canvas = canvasRef.current!;
    const b64 = canvas.toDataURL("image/png").split(",")[1]!;

    const layout = {
      floor: floorId,
      label: floorLabel,
      tilemap: tiles,
      objects: objects.map(o => ({
        type: o.type,
        srcFloor: o.src,
        x: +(o.x / FULL_W).toFixed(3),
        y: +(o.y / FULL_H).toFixed(3),
        scale: 1.0,
        ...(o.flipH ? { flipH: true } : {}),
        ...(o.north ? { southFacing: false } : {}),
      })),
      seats: seats.map(s => ({
        type: s.type,
        x: +(s.x / FULL_W).toFixed(3),
        y: +(s.y / FULL_H).toFixed(3),
      })),
      zones: zones.map(z => ({
        type: z.type,
        label: z.label,
        x1: +z.x1.toFixed(3), y1: +z.y1.toFixed(3),
        x2: +z.x2.toFixed(3), y2: +z.y2.toFixed(3),
      })),
    };

    try {
      const [imgR, layoutR] = await Promise.all([
        fetch(`/api/dev/save-map-image?floor=${floorId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64: b64 }),
        }),
        fetch(`/api/dev/save-layout?floor=${floorId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(layout),
        }),
      ]);
      if (imgR.ok && layoutR.ok) setSaved(true);
      else alert("저장 실패");
    } catch {
      alert("저장 실패");
    }
  };

  const clearAll = () => {
    if (!confirm("전체 맵을 초기화하시겠습니까?")) return;
    setTiles(Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill("void") as TileType[]));
    setObjects([]);
    setSeats([]);
    setSaved(false);
  };

  const selectedObj = objects.find(o => o.id === selectedObjId);

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0a0a14", color: "#eee", fontFamily: "system-ui", userSelect: "none" }}>

      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <div style={{ width: 200, padding: 10, borderRight: "1px solid #222", display: "flex", flexDirection: "column", gap: 5, overflowY: "auto", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>🗺️ 맵 에디터</span>
          <a href="/world" style={{ fontSize: 10, color: "#778", textDecoration: "none", border: "1px solid #333", borderRadius: 3, padding: "2px 7px" }}>← 월드</a>
        </div>

        {/* Floor info */}
        <div style={sectionLabel}>층 정보:</div>
        <input
          value={floorId}
          onChange={e => setFloorId(e.target.value.replace(/[^a-z0-9-]/g, ""))}
          style={inputStyle}
          placeholder="예: 9f-server-room"
        />
        <input
          value={floorLabel}
          onChange={e => { setFloorLabel(e.target.value); setSaved(false); }}
          style={inputStyle}
          placeholder="층 표시 이름"
        />

        <div style={{ borderTop: "1px solid #222", margin: "4px 0" }} />

        {/* Tools */}
        <div style={sectionLabel}>도구:</div>
        {([
          ["draw",  "✏️ 그리기",   "#1a3a1a", "#3a7a3a", "#8f8"],
          ["fill",  "🪣 채우기",   "#1a1a3a", "#3a3a7a", "#88f"],
          ["erase", "🧹 지우개",   "#3a1a1a", "#7a3a3a", "#f88"],
          ["seat",  "🪑 자리 마크", "#1a2a3a", "#3a5a7a", "#8df"],
          ["zone",  "🏷 구역 마크", "#1a1a2a", "#4a3a6a", "#caf"],
        ] as const).map(([t, label, bg, border, color]) => (
          <button key={t} onClick={() => setTool(t)}
            style={{ ...btnStyle, background: tool === t ? bg : "#141a24", color: tool === t ? color : "#aaa", borderColor: tool === t ? border : "#2a3a4a" }}>
            {label}
          </button>
        ))}

        {/* Zone type picker — visible only when zone tool is active */}
        {tool === "zone" && (
          <>
            <div style={{ fontSize: 9, color: "#9af", marginTop: 2 }}>구역 유형:</div>
            {ALL_ZONE_TYPES.map(zt => (
              <button key={zt} onClick={() => setActiveZoneType(zt)}
                style={{ ...btnStyle, fontSize: 9, display: "flex", alignItems: "center", gap: 5,
                  background: activeZoneType === zt ? "#1a1a2a" : "#141a24",
                  borderColor: activeZoneType === zt ? ZONE_BORDER[zt] : "#2a3a4a",
                  color: activeZoneType === zt ? ZONE_BORDER[zt] : "#778" }}>
                <span style={{ width: 9, height: 9, background: ZONE_BORDER[zt], borderRadius: 2, flexShrink: 0 }} />
                {ZONE_LABELS[zt]}
              </button>
            ))}
          </>
        )}

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#777", cursor: "pointer" }}>
          <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} />
          그리드 표시
        </label>

        <div style={{ borderTop: "1px solid #222", margin: "4px 0" }} />

        {/* Tile palette */}
        <div style={sectionLabel}>타일 팔레트:</div>
        {ALL_TILES.map(t => {
          const blocked = t === "wall" || t === "wall-glass" || t === "void";
          return (
            <button key={t} onClick={() => { setActiveTile(t); if (tool === "fill" || tool === "draw" || tool === "erase") setTool("draw"); }}
              style={{ ...btnStyle, background: activeTile === t ? "#1e2a1e" : "#141a24", color: activeTile === t ? "#afa" : "#aac", borderColor: activeTile === t ? "#3a6a3a" : "#2a3a4a", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 13, height: 13, background: TILE_COLORS[t], border: "1px solid rgba(255,255,255,0.15)", display: "inline-block", borderRadius: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 10, flex: 1 }}>{TILE_LABELS[t]}</span>
              {blocked && <span style={{ fontSize: 8, color: "#f66", flexShrink: 0 }}>막힘</span>}
            </button>
          );
        })}

        <div style={{ borderTop: "1px solid #222", margin: "4px 0" }} />

        {/* Object palette */}
        <div style={sectionLabel}>오브젝트 팔레트:</div>
        <div style={{ fontSize: 9, color: "#666", marginBottom: 2 }}>
          <span style={{ color: "#f66" }}>■</span> 막힘 &nbsp;
          <span style={{ color: "#4a8" }}>■</span> 통과
        </div>
        {OBJECTS.map(o => {
          const solid = SOLID_OBJECTS.has(o.type);
          return (
            <button key={`${o.src}-${o.type}`} onClick={() => addObject(o.type, o.src)}
              style={{ ...btnStyle, color: "#ca8", borderColor: "#3a2a1a", background: "#1e1814", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ color: solid ? "#f66" : "#4a8", fontSize: 9, flexShrink: 0 }}>●</span>
              <span>+ {o.label}</span>
            </button>
          );
        })}

        <div style={{ borderTop: "1px solid #222", margin: "4px 0" }} />
        <button onClick={clearAll}
          style={{ ...btnStyle, color: "#f66", borderColor: "#4a2222", background: "#2a1414" }}>
          🗑 전체 초기화
        </button>
      </div>

      {/* ── Canvas area ────────────────────────────────────────────────────── */}
      <div
        style={{ flex: 1, overflow: "auto", cursor: dragging ? "grabbing" : tool === "erase" ? "crosshair" : "default" }}
        onMouseUp={stopInteraction}
        onMouseLeave={stopInteraction}
        onMouseMove={onContainerMouseMove}
      >
        {/* centering wrapper — centers when canvas is smaller than viewport, scrolls when larger */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: "100%", minHeight: "100%", boxSizing: "border-box", padding: 24 }}>
        {/* canvas container sized to zoomed canvas */}
        <div style={{ width: FULL_W * zoom, height: FULL_H * zoom, position: "relative", flexShrink: 0 }} ref={containerRef}>
          <canvas
            ref={canvasRef}
            width={FULL_W}
            height={FULL_H}
            style={{ display: "block", width: FULL_W * zoom, height: FULL_H * zoom, imageRendering: "pixelated" }}
            onMouseDown={onCanvasDown}
          />
          {/* Object overlay — positioned in zoomed screen space */}
          {objects.map(obj => {
            const isSelected = selectedObjId === obj.id;
            const spriteSrc = obj.north
              ? `/floors/${obj.src}/objects/${obj.type}-n.png`
              : `/floors/${obj.src}/objects/${obj.type}.png`;
            const DISPLAY_H = 80 * zoom;
            return (
              <div
                key={obj.id}
                style={{
                  position: "absolute",
                  left: obj.x * zoom,
                  top: obj.y * zoom,
                  transform: `translate(-50%, -100%) scaleX(${obj.flipH ? -1 : 1})`,
                  cursor: dragging?.id === obj.id ? "grabbing" : "grab",
                  outline: isSelected ? `${2}px solid #5af` : "none",
                  outlineOffset: 2,
                }}
                onMouseDown={e => onObjMouseDown(e, obj)}
              >
                <img
                  src={spriteSrc}
                  style={{ height: DISPLAY_H, width: "auto", display: "block", pointerEvents: "none" }}
                  alt={obj.type}
                  draggable={false}
                />
                {isSelected && (
                  <div style={{
                    position: "absolute", bottom: -14, left: "50%", transform: "translateX(-50%)",
                    fontSize: 8, color: "#5af", background: "rgba(0,0,0,0.8)",
                    padding: "1px 4px", borderRadius: 2, whiteSpace: "nowrap",
                  }}>
                    {obj.type}
                  </div>
                )}
              </div>
            );
          })}

          {/* Zone overlays */}
          {zones.map(z => {
            const sel = selectedZoneId === z.id;
            const zW = (z.x2 - z.x1) * FULL_W * zoom;
            const zH = (z.y2 - z.y1) * FULL_H * zoom;
            const HS = 8; // handle size px
            const handles: { h: ResizeHandle; l: number; t: number; cursor: string }[] = [
              { h: "nw", l: -HS/2,       t: -HS/2,       cursor: "nwse-resize" },
              { h: "n",  l: zW/2-HS/2,   t: -HS/2,       cursor: "ns-resize"   },
              { h: "ne", l: zW-HS/2,     t: -HS/2,       cursor: "nesw-resize" },
              { h: "e",  l: zW-HS/2,     t: zH/2-HS/2,   cursor: "ew-resize"   },
              { h: "se", l: zW-HS/2,     t: zH-HS/2,     cursor: "nwse-resize" },
              { h: "s",  l: zW/2-HS/2,   t: zH-HS/2,     cursor: "ns-resize"   },
              { h: "sw", l: -HS/2,       t: zH-HS/2,     cursor: "nesw-resize" },
              { h: "w",  l: -HS/2,       t: zH/2-HS/2,   cursor: "ew-resize"   },
            ];
            return (
              <div key={z.id} style={{
                position: "absolute",
                left: z.x1 * FULL_W * zoom,
                top: z.y1 * FULL_H * zoom,
                width: zW, height: zH,
                background: ZONE_COLORS[z.type],
                border: `${sel ? 2 : 1}px solid ${ZONE_BORDER[z.type]}`,
                outline: sel ? `2px dashed ${ZONE_BORDER[z.type]}` : "none",
                boxSizing: "border-box",
                pointerEvents: "auto",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: sel ? "move" : "pointer",
              }}
                onMouseDown={e => {
                  e.stopPropagation();
                  setSelectedZoneId(z.id);
                  setSelectedObjId(null);
                  const rect = containerRef.current!.getBoundingClientRect();
                  setResizingZone({ zoneId: z.id, handle: "move", startX: e.clientX - rect.left, startY: e.clientY - rect.top, orig: { ...z } });
                }}
              >
                <span style={{ fontSize: 10 * zoom, color: ZONE_BORDER[z.type], fontWeight: 700, textAlign: "center", lineHeight: 1.2, pointerEvents: "none", userSelect: "none" }}>
                  {z.label}
                </span>
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); setZones(p => p.filter(x => x.id !== z.id)); setSelectedZoneId(null); setSaved(false); }}
                  style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,0.6)", border: "none", color: "#f66", fontSize: 10 * zoom, cursor: "pointer", lineHeight: 1, padding: "1px 3px", borderRadius: 3 }}>
                  ✕
                </button>
                {sel && handles.map(({ h, l, t, cursor }) => (
                  <div key={h} onMouseDown={e => {
                    e.stopPropagation();
                    const rect = containerRef.current!.getBoundingClientRect();
                    setResizingZone({ zoneId: z.id, handle: h, startX: e.clientX - rect.left, startY: e.clientY - rect.top, orig: { ...z } });
                  }} style={{
                    position: "absolute", left: l, top: t, width: HS, height: HS,
                    background: "#fff", border: `1px solid ${ZONE_BORDER[z.type]}`,
                    cursor, boxSizing: "border-box", borderRadius: 1,
                  }} />
                ))}
              </div>
            );
          })}

          {/* Zone drag preview */}
          {tool === "zone" && zoneDrawStart && zoneDragCurrent && (
            <div style={{
              position: "absolute",
              left: Math.min(zoneDrawStart.x, zoneDragCurrent.x) * zoom,
              top: Math.min(zoneDrawStart.y, zoneDragCurrent.y) * zoom,
              width: Math.abs(zoneDragCurrent.x - zoneDrawStart.x) * zoom,
              height: Math.abs(zoneDragCurrent.y - zoneDrawStart.y) * zoom,
              background: ZONE_COLORS[activeZoneType],
              border: `2px dashed ${ZONE_BORDER[activeZoneType]}`,
              boxSizing: "border-box",
              pointerEvents: "none",
            }} />
          )}
        </div>
        </div>{/* /centering wrapper */}
      </div>

      {/* ── Right panel ────────────────────────────────────────────────────── */}
      <div style={{ width: 175, padding: 10, borderLeft: "1px solid #222", display: "flex", flexDirection: "column", gap: 6, flexShrink: 0, overflowY: "auto" }}>

        {/* Zoom */}
        <div style={sectionLabel}>확대: {Math.round(zoom * 100)}%</div>
        <input type="range" min={0.2} max={1.5} step={0.05} value={zoom} onChange={e => setZoom(+e.target.value)} style={{ width: "100%", cursor: "pointer" }} />
        <div style={{ display: "flex", gap: 4 }}>
          {[0.25, 0.5, 1.0].map(z => (
            <button key={z} onClick={() => setZoom(z)}
              style={{ ...btnStyle, flex: 1, textAlign: "center", background: Math.abs(zoom - z) < 0.01 ? "#1a3a5a" : "#141a24" }}>
              {z * 100}%
            </button>
          ))}
        </div>

        <div style={{ borderTop: "1px solid #222", margin: "2px 0" }} />

        {/* Selected object */}
        {selectedObj ? (
          <>
            <div style={{ fontSize: 11, color: "#8bc", fontWeight: 600 }}>선택: {selectedObj.type}</div>
            <div style={{ fontSize: 9, color: "#555" }}>
              ({Math.round(selectedObj.x / FULL_W * 100)}%, {Math.round(selectedObj.y / FULL_H * 100)}%)
            </div>
            <button
              onClick={() => setObjects(p => p.map(o => o.id === selectedObj.id ? { ...o, flipH: !o.flipH } : o))}
              style={btnStyle}>
              ↔ 좌우 반전
            </button>
            <button
              onClick={() => setObjects(p => p.map(o => o.id === selectedObj.id ? { ...o, north: !o.north } : o))}
              style={{ ...btnStyle, color: selectedObj.north ? "#8f8" : "#aac" }}>
              {selectedObj.north ? "⬆ 북향" : "⬇ 남향"}
            </button>
            <button
              onClick={() => { setObjects(p => p.filter(o => o.id !== selectedObjId)); setSelectedObjId(null); }}
              style={{ ...btnStyle, color: "#f88", borderColor: "#4a2222", background: "#2a1414" }}>
              🗑 삭제
            </button>
          </>
        ) : (
          <div style={{ fontSize: 10, color: "#444" }}>오브젝트 클릭 → 선택</div>
        )}

        <div style={{ borderTop: "1px solid #222", margin: "2px 0" }} />

        {/* Stats */}
        <div style={{ fontSize: 9, color: "#555" }}>
          오브젝트: {objects.length}개<br />
          자리 마크: {seats.length}개<br />
          구역: {zones.length}개
        </div>
        {seats.length > 0 && (
          <button
            onClick={() => setSeats([])}
            style={{ ...btnStyle, fontSize: 9, color: "#aaa" }}>
            자리 마크 전체 삭제
          </button>
        )}
        {zones.length > 0 && (
          <button
            onClick={() => { setZones([]); setSaved(false); }}
            style={{ ...btnStyle, fontSize: 9, color: "#aaa" }}>
            구역 전체 삭제
          </button>
        )}

        <div style={{ borderTop: "1px solid #222", margin: "2px 0" }} />

        {/* Save */}
        <button onClick={saveMap}
          style={{ ...btnStyle, background: saved ? "#0a2a0a" : "#0a1a2a", borderColor: saved ? "#2a6a2a" : "#2a4a6a", color: saved ? "#6f6" : "#6af", fontWeight: 700, fontSize: 13, padding: "8px 10px" }}>
          {saved ? "✓ 저장됨" : "💾 저장"}
        </button>
        <div style={{ fontSize: 8, color: "#333", lineHeight: 1.4 }}>
          저장 후 world-sprites.ts에<br />새 층을 추가하세요
        </div>
      </div>
    </div>
  );
}

// ── Style constants ────────────────────────────────────────────────────────────
const btnStyle: React.CSSProperties = {
  background: "#141a24",
  border: "1px solid #2a3a4a",
  color: "#aac",
  borderRadius: 3,
  padding: "3px 8px",
  cursor: "pointer",
  fontSize: 10,
  textAlign: "left",
  width: "100%",
};

const inputStyle: React.CSSProperties = {
  background: "#141a24",
  border: "1px solid #333",
  color: "#eee",
  borderRadius: 3,
  padding: "3px 6px",
  fontSize: 11,
  width: "100%",
  boxSizing: "border-box",
};

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  color: "#556",
  marginTop: 2,
};
