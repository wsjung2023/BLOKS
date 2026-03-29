export interface WorldLayerConfig {
  floorTexture: string;
  tileWidth: number;
  tileHeight: number;
}

export interface GridPoint {
  col: number;
  row: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export const DEFAULT_WORLD_LAYER: WorldLayerConfig = {
  floorTexture: "floor-lobby-1f.png",
  tileWidth: 64,
  tileHeight: 32,
};

export function projectIsoToScreen(
  point: GridPoint,
  origin: ScreenPoint,
  tileWidth: number,
  tileHeight: number,
): ScreenPoint {
  return {
    x: origin.x + (point.col - point.row) * (tileWidth / 2),
    y: origin.y + (point.col + point.row) * (tileHeight / 2),
  };
}

export function shadeRgbColor(color: number, amount: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;

  const clamp = (value: number) => Math.max(0, Math.min(255, value));

  const nr = clamp(r + amount);
  const ng = clamp(g + amount);
  const nb = clamp(b + amount);

  return (nr << 16) | (ng << 8) | nb;
}
