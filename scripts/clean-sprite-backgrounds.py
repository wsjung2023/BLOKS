# -*- coding: utf-8 -*-
"""
clean-sprite-backgrounds.py

Removes white background blobs from character sprites that weren't caught
by the original alpha pass. Uses two strategies:
  1. Edge + transparent-adjacent flood fill (catches border-connected white)
  2. Size-based blob removal (catches enclosed blobs > max_detail_size px)

Small white regions (shirt stripes, shoe laces, eye whites, etc.) are kept.

Usage:
  python scripts/clean-sprite-backgrounds.py                  # all sprites-v2/
  python scripts/clean-sprite-backgrounds.py char-byte        # single character
  python scripts/clean-sprite-backgrounds.py --dry-run        # preview only
  python scripts/clean-sprite-backgrounds.py --threshold 210  # stricter white detection
"""

import os, sys, argparse
from pathlib import Path
from collections import deque
from PIL import Image
import numpy as np
from scipy import ndimage

sys.stdout = __import__('io').TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SPRITES_DIR = Path(__file__).parent.parent / "apps/web/public/sprites-v2"

# White pixels with RGB >= this are candidates for removal
WHITE_THRESHOLD = 220
# Enclosed white regions larger than this (px) are removed — they're background leaks
# Typical character details: shoe stripe ~50-100px, shirt ~200px, hoodie strings ~50px
MAX_DETAIL_SIZE = 400


def clean_sprite(img_path: Path, out_path: Path, threshold: int, max_detail: int, dry_run: bool) -> dict:
    img = Image.open(img_path).convert("RGBA")
    data = np.array(img, dtype=np.uint8)
    h, w = data.shape[:2]
    r, g, b, a = data[:, :, 0], data[:, :, 1], data[:, :, 2], data[:, :, 3]

    near_white = (r >= threshold) & (g >= threshold) & (b >= threshold)
    already_transparent = a < 20
    removable = near_white & ~already_transparent

    # ── Pass 1: Flood fill from edges + transparent-adjacent pixels ──────────
    remove_mask = already_transparent.copy()
    visited = already_transparent.copy()
    q: deque = deque()

    # Seed from image borders
    for x in range(w):
        for y_edge in [0, h - 1]:
            if near_white[y_edge, x] and not visited[y_edge, x]:
                visited[y_edge, x] = True
                q.append((y_edge, x))
    for y in range(h):
        for x_edge in [0, w - 1]:
            if near_white[y, x_edge] and not visited[y, x_edge]:
                visited[y, x_edge] = True
                q.append((y, x_edge))

    # Seed from pixels adjacent to already-transparent area
    ty, tx = np.where(already_transparent)
    for y, x in zip(ty, tx):
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and near_white[ny, nx] and not visited[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))

    while q:
        y, x = q.popleft()
        remove_mask[y, x] = True
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]:
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and near_white[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))

    # ── Pass 2: Remove enclosed white blobs too large to be character details ──
    remaining = removable & ~remove_mask
    labeled, n = ndimage.label(remaining)
    blobs_removed = 0
    blobs_kept = 0
    for lbl in range(1, n + 1):
        region = labeled == lbl
        size = int(region.sum())
        if size > max_detail:
            remove_mask |= region
            blobs_removed += 1
        else:
            blobs_kept += 1

    new_transparent = int((remove_mask & ~already_transparent).sum())

    if not dry_run:
        data[remove_mask, 3] = 0
        out_path.parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray(data).save(out_path)

    return {
        "new_transparent": new_transparent,
        "blobs_removed": blobs_removed,
        "blobs_kept": blobs_kept,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("filter", nargs="?", help="Filter by prefix, e.g. char-byte")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--threshold", type=int, default=WHITE_THRESHOLD)
    parser.add_argument("--max-detail", type=int, default=MAX_DETAIL_SIZE)
    args = parser.parse_args()

    sprites = sorted(SPRITES_DIR.glob("*.png"))
    if args.filter:
        sprites = [s for s in sprites if args.filter in s.name]

    print(f"Processing {len(sprites)} sprites (threshold={args.threshold}, max_detail={args.max_detail}){'  [DRY RUN]' if args.dry_run else ''}\n")

    total_new = 0
    changed = 0
    for sprite in sprites:
        result = clean_sprite(sprite, sprite, args.threshold, args.max_detail, args.dry_run)
        new_px = result["new_transparent"]
        total_new += new_px
        if new_px > 0 or result["blobs_removed"] > 0:
            changed += 1
            tag = "✓" if not args.dry_run else "~"
            print(f"  {tag} {sprite.name}: -{new_px}px ({result['blobs_removed']} blobs removed, {result['blobs_kept']} kept)")
        else:
            print(f"  · {sprite.name}: clean")

    print(f"\nDone: {changed}/{len(sprites)} sprites updated, {total_new} px total removed.")


if __name__ == "__main__":
    main()
