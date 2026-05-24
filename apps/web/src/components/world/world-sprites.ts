// world-sprites.ts - constants, zone data, and PIXI builder utilities

export const GRID_COLS = 12;
export const GRID_ROWS = 10;
export const TILE_W = 64;
export const TILE_H = 32;
export const TILE_DEPTH = 10;
export const DESK_W = TILE_W * 0.48;
export const DESK_H = TILE_H * 0.48;
export const DESK_DEPTH = 5;
export const DESK_COLOR = 0xe8d9b8;

export interface FloorSlot {
  x: number;
  y: number;
}

export interface FloorConfig {
  id: string;
  label: string;
  imageUrl: string;
  stageCleanUrl?: string;
  divisionCodes: string[];
  slots: FloorSlot[];
}

export const FLOORS: FloorConfig[] = [
  {
    id: "lobby",
    label: "1F Lobby",
    imageUrl: "/sprites-v2/floor-lobby-1f.png",
    stageCleanUrl: "/floors/1f-lobby/background/stage-clean.png",
    divisionCodes: [],
    slots: [
      { x: 0.32, y: 0.60 }, { x: 0.46, y: 0.65 },
      { x: 0.58, y: 0.62 }, { x: 0.70, y: 0.57 },
    ],
  },
  {
    id: "ops",
    label: "2F Ops",
    imageUrl: "/sprites-v2/floor-ops-2f.png",
    stageCleanUrl: "/floors/2f-ops/background/stage-clean.png",
    divisionCodes: ["ops", "div_ops", "operations"],
    slots: [
      { x: 0.26, y: 0.55 }, { x: 0.40, y: 0.61 },
      { x: 0.53, y: 0.55 }, { x: 0.66, y: 0.61 },
      { x: 0.79, y: 0.56 },
    ],
  },
  {
    id: "engineering",
    label: "3F Engineering",
    imageUrl: "/sprites-v2/floor-engineering-3f.png",
    stageCleanUrl: "/floors/3f-engineering/background/stage-clean.png",
    divisionCodes: ["engineering", "div_engineering"],
    slots: [
      { x: 0.27, y: 0.50 }, { x: 0.39, y: 0.57 },
      { x: 0.51, y: 0.50 }, { x: 0.63, y: 0.57 },
      { x: 0.75, y: 0.50 }, { x: 0.31, y: 0.65 },
      { x: 0.55, y: 0.65 }, { x: 0.70, y: 0.65 },
    ],
  },
  {
    id: "research",
    label: "4F Research",
    imageUrl: "/sprites-v2/floor-research-4f.png",
    stageCleanUrl: "/floors/4f-research/background/stage-clean.png",
    divisionCodes: ["research", "div_research"],
    slots: [
      { x: 0.28, y: 0.55 }, { x: 0.42, y: 0.62 },
      { x: 0.56, y: 0.55 }, { x: 0.70, y: 0.62 },
      { x: 0.49, y: 0.70 },
    ],
  },
  {
    id: "marketing",
    label: "5F Marketing",
    imageUrl: "/sprites-v2/floor-marketing-5f.png",
    stageCleanUrl: "/floors/5f-marketing/background/stage-clean.png",
    divisionCodes: ["marketing", "div_marketing"],
    slots: [
      { x: 0.31, y: 0.55 }, { x: 0.43, y: 0.62 },
      { x: 0.55, y: 0.56 }, { x: 0.67, y: 0.63 },
      { x: 0.79, y: 0.56 }, { x: 0.43, y: 0.70 },
    ],
  },
  {
    id: "finance",
    label: "6F Planning",
    imageUrl: "/sprites-v2/floor-planning-6f.png",
    stageCleanUrl: "/floors/6f-planning/background/stage-clean.png",
    divisionCodes: ["strategy", "div_strategy", "finance", "div_finance"],
    slots: [
      { x: 0.28, y: 0.55 }, { x: 0.43, y: 0.62 },
      { x: 0.58, y: 0.55 }, { x: 0.72, y: 0.62 },
    ],
  },
  {
    id: "cafe",
    label: "7F Cafe",
    imageUrl: "/sprites-v2/floor-cafe-7f.png",
    stageCleanUrl: "/floors/7f-cafe/background/stage-clean.png",
    divisionCodes: [],
    slots: [
      { x: 0.28, y: 0.57 }, { x: 0.43, y: 0.64 },
      { x: 0.58, y: 0.57 }, { x: 0.72, y: 0.62 },
    ],
  },
  {
    id: "executive",
    label: "8F Executive",
    imageUrl: "/sprites-v2/floor-executive-8f.png",
    stageCleanUrl: "/floors/8f-executive/background/stage-clean.png",
    divisionCodes: ["executive", "exec", "div_exec", "management"],
    slots: [
      // executive desk & visitor chairs (indices 0-3)
      { x: 0.18, y: 0.16 }, { x: 0.32, y: 0.09 },
      { x: 0.62, y: 0.12 }, { x: 0.78, y: 0.12 },
      // main conference table seats (indices 4-9) — used by meeting guests
      { x: 0.12, y: 0.37 }, { x: 0.24, y: 0.36 }, { x: 0.36, y: 0.37 },
      { x: 0.12, y: 0.62 }, { x: 0.24, y: 0.64 }, { x: 0.36, y: 0.62 },
    ],
  },
];

export const FLOOR_DIVISION_MAP: Record<string, string> = {};
for (const floor of FLOORS) {
  for (const code of floor.divisionCodes) {
    FLOOR_DIVISION_MAP[code.toLowerCase()] = floor.id;
  }
}

export interface RuntimeStateForSprite {
  activity_status?: string;
  runtime_status?: string;
  burnout_triggered?: boolean;
  fatigue_score?: number;
  workload_score?: number;
  current_task_count?: number;
}

export type SpritePose = "stand" | "walk" | "desk" | "meeting" | "rest" | "phone";

export function getSpritePose(rt: RuntimeStateForSprite): SpritePose {
  const status = (rt.activity_status ?? rt.runtime_status ?? "").toLowerCase();
  const fatigue = rt.fatigue_score ?? 0;
  const tasks = rt.current_task_count ?? 0;

  if (status.includes("meeting")) return "meeting";
  if (status.includes("walk") || status.includes("move")) return "walk";
  if (status.includes("desk") || status.includes("seat") || status.includes("sit")) return "desk";
  if (status.includes("phone")) return "phone";
  if (status.includes("rest") || status.includes("break")) return "rest";
  if (fatigue > 80) return "rest";
  if (fatigue > 60) return "rest";
  if (tasks > 0 || status.includes("work") || status.includes("progress")) return "desk";
  return "stand";
}

export const DIVISION_COLORS: Record<string, number> = {
  engineering: 0x5c9ce6,
  product: 0x5c9ce6,
  marketing: 0xe6905c,
  design: 0x5ce6a0,
  finance: 0xe6c85c,
  management: 0xb05ce6,
  executive: 0xe65ca0,
  hr: 0x5ce6d6,
};

export const FLOOR_DIR: Record<string, string> = {
  lobby:       "1f-lobby",
  ops:         "2f-ops",
  engineering: "3f-engineering",
  research:    "4f-research",
  marketing:   "5f-marketing",
  finance:     "6f-planning",
  cafe:        "7f-cafe",
  executive:   "8f-executive",
};

// Elevator zone position per floor (normalized 0-1). Characters walk here
// before transitioning between floors. Derived from layout.json elevator objects.
export const ELEVATOR_ZONE: { x: number; y: number } = { x: 0.88, y: 0.25 };

// Meeting zone positions per floor — clustered around a central conference table.
// Characters move here during workflow_stage: meeting_called events.
export const MEETING_ZONES: Record<string, Array<{ x: number; y: number }>> = {
  executive:   [
    { x: 0.12, y: 0.37 }, { x: 0.24, y: 0.36 }, { x: 0.36, y: 0.37 },
    { x: 0.12, y: 0.62 }, { x: 0.24, y: 0.64 }, { x: 0.36, y: 0.62 },
  ],
  engineering: [
    { x: 0.36, y: 0.38 }, { x: 0.50, y: 0.35 }, { x: 0.64, y: 0.38 },
    { x: 0.36, y: 0.50 }, { x: 0.50, y: 0.53 }, { x: 0.64, y: 0.50 },
  ],
  ops:         [
    { x: 0.35, y: 0.40 }, { x: 0.50, y: 0.37 }, { x: 0.65, y: 0.40 },
    { x: 0.35, y: 0.52 }, { x: 0.50, y: 0.55 }, { x: 0.65, y: 0.52 },
  ],
  research:    [
    { x: 0.36, y: 0.42 }, { x: 0.50, y: 0.39 }, { x: 0.64, y: 0.42 },
    { x: 0.36, y: 0.54 }, { x: 0.50, y: 0.57 }, { x: 0.64, y: 0.54 },
  ],
  marketing:   [
    { x: 0.37, y: 0.41 }, { x: 0.50, y: 0.38 }, { x: 0.63, y: 0.41 },
    { x: 0.37, y: 0.53 }, { x: 0.50, y: 0.56 }, { x: 0.63, y: 0.53 },
  ],
  finance:     [
    { x: 0.38, y: 0.42 }, { x: 0.52, y: 0.39 }, { x: 0.62, y: 0.42 },
    { x: 0.45, y: 0.54 }, { x: 0.55, y: 0.54 },
  ],
  cafe:        [
    { x: 0.36, y: 0.46 }, { x: 0.50, y: 0.43 }, { x: 0.64, y: 0.46 },
    { x: 0.42, y: 0.58 }, { x: 0.58, y: 0.58 },
  ],
};


export const ZONE_FLOOR_URLS: Record<string, string> = {
  engineering: "/sprites-v2/floor-engineering-3f.png",
  marketing: "/sprites-v2/floor-marketing-5f.png",
  management: "/sprites-v2/floor-executive-8f.png",
  research: "/sprites-v2/floor-research-4f.png",
};

export const ZONE_COLORS: Record<string, number> = {
  engineering: 0xc8deff,
  marketing: 0xffddc8,
  design: 0xd4f5d4,
  finance: 0xfff3c8,
  management: 0xf0d4f5,
};

export const ZONE_MAP: string[][] = Array.from({ length: GRID_ROWS }, (_, row) =>
  Array.from({ length: GRID_COLS }, (_, col) => {
    if (col < 4) return "engineering";
    if (col < 7) return row < 5 ? "marketing" : "design";
    if (col < 10) return "finance";
    return "management";
  })
);

// Tile size for the 1536×1024 top-down grid (48×32 tiles)
const MEETING_TILE_SIZE = 32;

// Convert MEETING_ZONES normalized positions to tile coordinates.
// Used by WorldScene for A*-pathfinding destinations.
export function getMeetingTilePositions(
  floorId: string,
): Array<{ col: number; row: number }> {
  return (MEETING_ZONES[floorId] ?? []).map((pos) => ({
    col: Math.floor(pos.x * 1536 / MEETING_TILE_SIZE),
    row: Math.floor(pos.y * 1024 / MEETING_TILE_SIZE),
  }));
}

export const ZONE_LABELS = [
  { col: 1, row: 4, label: "Engineering" },
  { col: 5, row: 1, label: "Marketing" },
  { col: 5, row: 7, label: "Design" },
  { col: 8, row: 4, label: "Research" },
  { col: 10, row: 4, label: "Management" },
];

export const DIVISION_TO_ZONE: Record<string, string> = {
  div_exec: "management",
  div_strategy: "management",
  div_marketing: "marketing",
  div_research: "finance",
  div_engineering: "engineering",
  div_ops: "management",
  engineering: "engineering",
  marketing: "marketing",
  research: "finance",
  strategy: "management",
  management: "management",
  exec: "management",
  ops: "management",
};

export function codeNameToSpriteUrl(code_name: string): string {
  return `/sprites-v2/char-${code_name.toLowerCase().replace(/_/g, "-")}-work-stand.png`;
}

function codeNameToSlug(codeName: string): string {
  return codeName.toLowerCase().replace(/_/g, "-");
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function getActivitySpriteUrl(
  codeName: string,
  _rt: RuntimeStateForSprite,
): string {
  return getRoleFallback(codeName);
}

export function getRoleFallback(codeName: string): string {
  const slug = codeNameToSlug(codeName);
  return `/sprites-v2/char-${slug}-work-stand.png`;
}

function actionPoseToFileName(pose: SpritePose): string {
  switch (pose) {
    case "walk":
      return "walk";
    case "desk":
      return "desk";
    case "meeting":
      return "meeting";
    case "rest":
      return "rest";
    case "phone":
      return "phone";
    case "stand":
    default:
      return "stand";
  }
}

export function getActivitySpriteCandidates(
  codeName: string,
  _rt: RuntimeStateForSprite,
): string[] {
  return [getRoleFallback(codeName)];
}

export function isoToScreen(col: number, row: number, ox: number, oy: number) {
  return {
    x: (col - row) * (TILE_W / 2) + ox,
    y: (col + row) * (TILE_H / 2) + oy,
  };
}

export function shadeColor(color: number, amt: number): number {
  const r = Math.max(0, Math.min(255, ((color >> 16) & 0xff) + amt));
  const g = Math.max(0, Math.min(255, ((color >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (color & 0xff) + amt));
  return (r << 16) | (g << 8) | b;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildEffect(
  PIXI: any,
  tex: any,
  x: number,
  y: number,
  w: number,
  h: number,
  emoji: string,
  emojiColor: number,
): any {
  if (tex) {
    const sp = new PIXI.Sprite(tex);
    sp.anchor.set(0.5, 1.0);
    sp.width = w;
    sp.height = h;
    sp.x = x;
    sp.y = y;
    return sp;
  }

  const t = new PIXI.Text({ text: emoji, style: { fontSize: 11, fill: emojiColor } });
  t.anchor.set(0.5, 1.0);
  t.x = x;
  t.y = y;
  return t;
}
