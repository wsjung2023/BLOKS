# -*- coding: utf-8 -*-
"""
generate-topdown-floors.py

Generates top-down 2D RPG style office floor backgrounds using gpt-image-1.
Saves to apps/web/public/floors/{dir}/background/topdown.png

Usage:
  python scripts/generate-topdown-floors.py              # all missing
  python scripts/generate-topdown-floors.py 4f-research  # single floor
  python scripts/generate-topdown-floors.py --regenerate # overwrite existing
"""

import os, sys, base64, argparse, time
from pathlib import Path
from io import BytesIO
from PIL import Image
import openai

sys.stdout = __import__('io').TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

PUBLIC_DIR = Path(__file__).parent.parent / "apps/web/public/floors"
client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])

FLOORS = {
    "1f-lobby": {
        "name": "Corporate Lobby",
        "desc": "reception desk, waiting sofas, elevator bank, info kiosk, plant decorations, open ceiling with natural light",
    },
    "2f-ops": {
        "name": "Operations Center",
        "desc": "rows of workstations with dual monitors, server racks along walls, large central display board, dark moody lighting with blue/green glow, cable management trays",
    },
    "3f-engineering": {
        "name": "Engineering Floor",
        "desc": "open desk clusters with monitors, whiteboards, collaborative pods, standing desks, blue LED accent lighting, component bins, cable-strewn desks",
    },
    "4f-research": {
        "name": "Research Lab",
        "desc": "lab benches with scientific equipment, microscopes, computer workstations, bookshelf walls, purple accent lighting, specimen storage, clean room feel",
    },
    "5f-marketing": {
        "name": "Marketing Floor",
        "desc": "colorful open floor plan, brainstorming pods with writable walls, large mood boards, warm wood desks, brand collateral displays, orange/amber lighting",
    },
    "6f-planning": {
        "name": "Finance & Planning",
        "desc": "formal desk rows, filing cabinets, large conference table in center, Bloomberg terminal-style workstations, corporate blue lighting, organized and minimal",
    },
    "7f-cafe": {
        "name": "Cafeteria & Break Room",
        "desc": "kitchen counter with coffee machines, dining tables, lounge sofas, vending machines, plants, food preparation area, bright warm natural lighting, casual seating",
    },
    "8f-executive": {
        "name": "Executive Suite",
        "desc": "large private offices with wood paneling, executive desks, a boardroom with long table and leather chairs, panoramic view windows, premium decor, gold accents",
    },
}

PROMPT_TEMPLATE = """Top-down 2D RPG office floor, {name}. {desc}.

Style: RPG Maker / Stardew Valley / Desk RPG pixel art aesthetic, viewed directly from above (bird's eye view). Clean, readable art. The room shows the complete floor from above with all furniture visible from top-down perspective.

Include: a glass-walled meeting room in one corner, a bathroom area, the main work area.

Requirements:
- Pure top-down bird's eye view (no perspective, no isometric angle)
- Pixel art style with clear tile boundaries
- Transparent or solid floor tiles
- All furniture shown as top-down silhouettes
- 1536x1024 pixels, landscape orientation
- No characters, only the environment"""


def generate_floor(floor_dir: str, regenerate: bool) -> bool:
    out_path = PUBLIC_DIR / floor_dir / "background" / "topdown.png"
    if out_path.exists() and not regenerate:
        print(f"  [skip] {floor_dir} — topdown.png already exists")
        return True

    floor = FLOORS.get(floor_dir)
    if not floor:
        print(f"  [skip] {floor_dir} — not in config")
        return False

    print(f"  generating {floor_dir}/background/topdown.png ...", end="", flush=True)
    prompt = PROMPT_TEMPLATE.format(name=floor["name"], desc=floor["desc"])

    try:
        resp = client.images.generate(
            model="gpt-image-1",
            prompt=prompt,
            n=1,
            size="1536x1024",
        )
        img_b64 = resp.data[0].b64_json
        assert img_b64
        img_bytes = base64.b64decode(img_b64)

        # Clean white background from generated image
        img = Image.open(BytesIO(img_bytes)).convert("RGBA")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(out_path, format="PNG")
        print(f" OK ({len(img_bytes) // 1024}KB)")
        return True
    except Exception as e:
        print(f" FAIL: {e}")
        return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("floor", nargs="?", help="Single floor dir, e.g. 4f-research")
    parser.add_argument("--regenerate", action="store_true")
    args = parser.parse_args()

    floors = [args.floor] if args.floor else list(FLOORS.keys())
    print(f"Generating {len(floors)} floor(s)...\n")

    for floor_dir in floors:
        generate_floor(floor_dir, args.regenerate)
        time.sleep(1)

    print("\nDone.")


if __name__ == "__main__":
    main()
