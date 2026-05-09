# -*- coding: utf-8 -*-
"""
generate-north-sprites.py

Generates north-facing ({type}-n.png) variants for isometric object sprites.

In isometric view:
  {type}.png   = south-facing (SE direction) — front of object faces viewer
  {type}-n.png = north-facing (NE direction) — back of object faces viewer

Usage:
  python scripts/generate-north-sprites.py              # all floors, all objects
  python scripts/generate-north-sprites.py 1f-lobby     # single floor
  python scripts/generate-north-sprites.py 1f-lobby sofa  # single object
  python scripts/generate-north-sprites.py --skip-existing  # skip already-generated
"""

import os, sys, json, base64, time, argparse
from pathlib import Path
from io import BytesIO
from PIL import Image
import openai

sys.stdout = __import__('io').TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

FLOORS_DIR = Path(__file__).parent.parent / "client-assets/world-rebuild/floors"
PUBLIC_DIR = Path(__file__).parent.parent / "apps/web/public/floors"
client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])

SKIP_TYPES = {"wall-glass", "wall-solid", "door", "elevator", "partition",
              "bathroom-stall", "sink", "clean-background", "stair"}

FLOORS = [
    "1f-lobby", "2f-ops", "3f-engineering", "4f-research",
    "5f-marketing", "6f-planning", "7f-cafe", "8f-executive",
]

NORTH_PROMPT = """This is an isometric game sprite of a {type} viewed from the south-east direction (front view, facing the viewer).

Generate the same {type} viewed from the north-east direction — showing the back/rear side of the object as it would appear in an isometric game world. The object should face away from the viewer.

Requirements:
- Same isometric perspective angle (30° elevation, 2:1 dimetric projection)
- Same art style, color palette, and proportions as the input
- Transparent background (PNG with alpha)
- The object faces away — show the back/rear of the furniture
- Keep the same floor footprint size and scale
- Do NOT add shadows to the background — transparent only"""


def load_png_rgba(path: Path) -> bytes:
    img = Image.open(path).convert("RGBA")
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def gen_north_sprite(sprite_path: Path, obj_type: str) -> bytes:
    sprite_bytes = load_png_rgba(sprite_path)
    prompt = NORTH_PROMPT.format(type=obj_type.replace("-", " "))

    resp = client.images.edit(
        model="gpt-image-1",
        image=("sprite.png", sprite_bytes, "image/png"),
        prompt=prompt,
        n=1,
        size="1024x1024",
    )
    img_b64 = resp.data[0].b64_json
    assert img_b64
    return base64.b64decode(img_b64)


def process_floor(floor_dir: str, only_type: str | None, skip_existing: bool):
    objects_dir = FLOORS_DIR / floor_dir / "objects"
    public_objects = PUBLIC_DIR / floor_dir / "objects"

    if not objects_dir.exists():
        print(f"  [skip] {floor_dir} — objects dir not found")
        return

    sprites = sorted(objects_dir.glob("*.png"))
    # Filter: only base sprites (no -n suffix), no skipped types
    base_sprites = [
        p for p in sprites
        if not p.stem.endswith("-n")
        and p.stem not in SKIP_TYPES
        and (only_type is None or p.stem == only_type)
    ]

    if not base_sprites:
        print(f"  [skip] {floor_dir} — no matching sprites")
        return

    print(f"\n=== {floor_dir} ({len(base_sprites)} objects) ===")

    for sprite_path in base_sprites:
        obj_type = sprite_path.stem
        north_path = sprite_path.parent / f"{obj_type}-n.png"
        public_north = public_objects / f"{obj_type}-n.png"

        if skip_existing and north_path.exists():
            print(f"  [skip] {obj_type}-n.png already exists")
            continue

        print(f"  generating {obj_type}-n.png ...", end="", flush=True)
        try:
            png_bytes = gen_north_sprite(sprite_path, obj_type)

            # Save to client-assets (source of truth)
            north_path.write_bytes(png_bytes)

            # Also save to public dir for immediate web use
            public_objects.mkdir(parents=True, exist_ok=True)
            public_north.write_bytes(png_bytes)

            print(f" ✓ ({len(png_bytes)//1024}KB)")
            time.sleep(1)  # rate limit buffer

        except Exception as e:
            print(f" ✗ {e}")
            time.sleep(2)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("floor", nargs="?", help="Floor dir, e.g. 1f-lobby")
    parser.add_argument("type", nargs="?", help="Object type, e.g. sofa")
    parser.add_argument("--skip-existing", action="store_true", default=True,
                        help="Skip types that already have a -n sprite (default: True)")
    parser.add_argument("--regenerate", action="store_true",
                        help="Regenerate even if -n sprite already exists")
    args = parser.parse_args()

    skip = not args.regenerate

    floors = [args.floor] if args.floor else FLOORS
    for floor_dir in floors:
        process_floor(floor_dir, args.type, skip)

    print("\nDone.")


if __name__ == "__main__":
    main()
