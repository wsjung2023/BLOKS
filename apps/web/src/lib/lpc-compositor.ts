// LPC Spritesheet Compositor — DeskRPG compatible format
// Composites DeskRPG-format layers into a 576×256 spritesheet (9×4 frames of 64×64).
// Format: 9 cols × 4 rows: row 0=up, row 1=left, row 2=down, row 3=right

export interface LpcLayer {
  url: string;   // path relative to base (e.g. "body/male/light.png")
  zPos: number;  // render order (lower = drawn first)
}

export const LPC_FRAME_W = 64;
export const LPC_FRAME_H = 64;
// DeskRPG walk sheet: 9 cols × 4 rows = 576×256
export const LPC_COLS        = 9;
export const LPC_ROWS        = 4;
export const LPC_SHEET_W     = LPC_FRAME_W * LPC_COLS;  // 576
export const LPC_SHEET_H     = LPC_FRAME_H * LPC_ROWS;  // 256
export const LPC_WALK_FRAMES = 9;

// Row indices
export const LPC_WALK_UP_ROW    = 0;
export const LPC_WALK_LEFT_ROW  = 1;
export const LPC_WALK_DOWN_ROW  = 2;
export const LPC_WALK_RIGHT_ROW = 3;

// Frame index of the first walk-down frame (row 2 × 9 cols)
export const LPC_DOWN_START  = 2 * 9; // 18
export const LPC_UP_START    = 0 * 9; // 0
export const LPC_LEFT_START  = 1 * 9; // 9
export const LPC_RIGHT_START = 3 * 9; // 27

// Composite multiple layer images into one spritesheet.
// `basePath` is the URL prefix (e.g. "/assets/lpc2/").
export async function compositeCharacter(
  layers: LpcLayer[],
  basePath = "/assets/lpc2/",
): Promise<string> {
  const sorted = [...layers].sort((a, b) => a.zPos - b.zPos);

  const canvas = new OffscreenCanvas(LPC_SHEET_W, LPC_SHEET_H); // 576×256
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  for (const layer of sorted) {
    const img = await loadImage(basePath + layer.url);
    ctx.drawImage(img, 0, 0); // natural size — all DeskRPG layers are 576×256
  }

  const blob = await canvas.convertToBlob({ type: "image/png" });
  return URL.createObjectURL(blob);
}

async function loadImage(url: string): Promise<ImageBitmap> {
  const res = await fetch(url);
  const blob = await res.blob();
  return createImageBitmap(blob);
}
