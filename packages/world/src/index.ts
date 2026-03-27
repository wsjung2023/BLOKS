export interface IsoPoint {
  col: number;
  row: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export function projectIsoToScreen(
  point: IsoPoint,
  origin: ScreenPoint,
  tileWidth: number,
  tileHeight: number
): ScreenPoint {
  return {
    x: origin.x + (point.col - point.row) * (tileWidth / 2),
    y: origin.y + (point.col + point.row) * (tileHeight / 2),
  };
}

export function shadeRgbColor(color: number, amount: number): number {
  const r = Math.max(0, Math.min(255, ((color >> 16) & 0xff) + amount));
  const g = Math.max(0, Math.min(255, ((color >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (color & 0xff) + amount));
  return (r << 16) | (g << 8) | b;
}
