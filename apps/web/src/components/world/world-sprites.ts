// world-sprites.ts — constants, zone data, and PIXI builder utilities

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
  { col: 1, row: 4, label: "🛠 엔지니어링" },
  { col: 5, row: 1, label: "📣 마케팅" },
  { col: 5, row: 7, label: "🎨 디자인" },
  { col: 8, row: 4, label: "💰 재무" },
  { col: 10, row: 4, label: "🏛 경영" },
];

export const DIVISION_TO_ZONE: Record<string, string> = {
  engineering: "engineering", product: "engineering",
  marketing: "marketing", design: "design", finance: "finance",
  management: "management", executive: "management",
  hr: "management", operations: "management",
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
  return { x: ox + (col - row) * (TILE_W / 2), y: oy + (col + row) * (TILE_H / 2) };
}

export function shadeColor(color: number, amt: number): number {
  const r = Math.max(0, Math.min(255, ((color >> 16) & 0xff) + amt));
  const g = Math.max(0, Math.min(255, ((color >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (color & 0xff) + amt));
  return (r << 16) | (g << 8) | b;
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
