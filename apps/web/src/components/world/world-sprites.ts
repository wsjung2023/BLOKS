// world-sprites.ts — constants, zone data, and PIXI builder utilities
import { projectIsoToScreen, shadeRgbColor } from "@bloks/world";

// ── Grid/tile constants ───────────────────────────────────────────────────────
export const GRID_COLS = 12;
export const GRID_ROWS = 10;
export const TILE_W = 64;
export const TILE_H = 32;
export const TILE_DEPTH = 10;
export const DESK_W = TILE_W * 0.48;
export const DESK_H = TILE_H * 0.48;
export const DESK_DEPTH = 5;
export const DESK_COLOR = 0xe8d9b8;

// ── Zone / division data ──────────────────────────────────────────────────────
export const ZONE_FLOOR_URLS: Record<string, string> = {
  engineering: "/sprites/building-floor-engineering.png",
  marketing:   "/sprites/building-floor-marketing.png",
  management:  "/sprites/building-floor-executive.png",
};

export const ZONE_COLORS: Record<string, number> = {
  engineering: 0xc8deff, marketing: 0xffddc8,
  design: 0xd4f5d4, finance: 0xfff3c8, management: 0xf0d4f5,
};

export const ZONE_MAP: string[][] = Array.from({ length: GRID_ROWS }, (_, row) =>
  Array.from({ length: GRID_COLS }, (_, col) => {
    if (col < 4)  return "engineering";
    if (col < 7)  return row < 5 ? "marketing" : "design";
    if (col < 10) return "finance";
    return "management";
  })
);

export const ZONE_LABELS = [
  { col: 1, row: 4, label: "Engineering" },
  { col: 5, row: 1, label: "Marketing" },
  { col: 5, row: 7, label: "Design" },
  { col: 8, row: 4, label: "Research" },
  { col: 10, row: 4, label: "Engineering" },
];

export const DIVISION_TO_ZONE: Record<string, string> = {
  // Exact DB division_id values from Supabase
  "div_exec": "management",
  "div_strategy": "management",
  "div_marketing": "marketing",
  "div_research": "finance",
  "div_engineering": "engineering",
  "div_ops": "management",
  // short fallbacks
  engineering: "engineering",
  marketing: "marketing",
  research: "finance",
  strategy: "management",
  management: "management",
  exec: "management",
  ops: "management",
};

export const DIVISION_COLORS: Record<string, number> = {
  engineering: 0x5c9ce6, product: 0x5c9ce6, marketing: 0xe6905c,
  design: 0x5ce6a0, finance: 0xe6c85c, management: 0xb05ce6,
  executive: 0xe65ca0, hr: 0x5ce6d6,
};

// ── Pure helpers ──────────────────────────────────────────────────────────────
export function codeNameToSpriteUrl(code_name: string): string {
  return `/sprites/char-${code_name.toLowerCase().replace(/_/g, "-")}.png`;
}

export function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
}

export function isoToScreen(col: number, row: number, ox: number, oy: number) {
  return projectIsoToScreen({ col, row }, { x: ox, y: oy }, TILE_W, TILE_H);
}

export function shadeColor(color: number, amt: number): number {
  return shadeRgbColor(color, amt);
}

// PIXI effect builder — sprite from texture or emoji text fallback
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildEffect(PIXI: any, tex: any, x: number, y: number, w: number, h: number, emoji: string, emojiColor: number): any {
  if (tex) {
    const sp = new PIXI.Sprite(tex);
    sp.anchor.set(0.5, 1.0); sp.width = w; sp.height = h; sp.x = x; sp.y = y;
    return sp;
  }
  const t = new PIXI.Text({ text: emoji, style: { fontSize: 11, fill: emojiColor } });
  t.anchor.set(0.5, 1.0); t.x = x; t.y = y;
  return t;
}
