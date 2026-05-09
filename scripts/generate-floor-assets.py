# -*- coding: utf-8 -*-
"""
generate-floor-assets.py

Checklist items 4, 5, 6:
  4. stage-clean.png  — floor background without any objects/furniture
  5. objects/*.png    — each individual object as transparent sprite
  6. floor-base.png   — just the floor/ground surface tile

Usage:
  python scripts/generate-floor-assets.py              # all floors
  python scripts/generate-floor-assets.py 1f-lobby     # single floor
  python scripts/generate-floor-assets.py 1f-lobby --objects-only
  python scripts/generate-floor-assets.py 1f-lobby --bg-only
"""

import os, sys, json, base64, time, argparse
from pathlib import Path
from io import BytesIO
from PIL import Image
import openai

sys.stdout = __import__('io').TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

FLOORS_DIR = Path(__file__).parent.parent / "client-assets/world-rebuild/floors"
client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])

SIZE = "1536x1024"   # gpt-image-1 wide landscape (matches floor aspect ratio ~16:9)
QUALITY = "high"


def encode_b64(path: Path) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()


def analyze_style(ref_path: Path, floor_name: str) -> dict:
    """Ask GPT-4o to describe the floor's art style, palette, lighting, and key features."""
    print(f"  → GPT-4o 스타일 분석 중...")
    b64 = encode_b64(ref_path)
    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{b64}", "detail": "high"},
                },
                {
                    "type": "text",
                    "text": (
                        f"This is an isometric office floor image for '{floor_name}'. "
                        "Analyze and describe:\n"
                        "1. Art style (pixel art / cartoon / anime / realistic)\n"
                        "2. Color palette (main colors, mood)\n"
                        "3. Lighting style (warm/cool/neon, direction)\n"
                        "4. Floor surface material and color\n"
                        "5. Wall style (color, glass/solid)\n"
                        "6. Isometric perspective angle\n"
                        "7. Overall mood and atmosphere\n"
                        "Be precise and concise. This will be used as a generation prompt. "
                        "Do NOT describe any furniture or objects — only the room structure, walls, floor, lighting."
                    ),
                },
            ],
        }],
        max_tokens=400,
    )
    style_desc = resp.choices[0].message.content.strip()
    print(f"  ✓ 스타일 분석 완료")
    return {"style": style_desc}


def generate_image(prompt: str, output_path: Path, ref_path: Path | None = None) -> bool:
    """Generate image with gpt-image-1. Returns True on success."""
    try:
        kwargs = dict(
            model="gpt-image-1",
            prompt=prompt,
            n=1,
            size=SIZE,
            quality=QUALITY,
        )
        # Use image reference if provided (for style consistency)
        if ref_path:
            pass  # gpt-image-1 generate doesn't support image input; style captured via GPT-4o analysis

        resp = client.images.generate(**kwargs)
        item = resp.data[0]

        if hasattr(item, 'b64_json') and item.b64_json:
            img_data = base64.b64decode(item.b64_json)
        else:
            import urllib.request
            with urllib.request.urlopen(item.url) as r:
                img_data = r.read()

        img = Image.open(BytesIO(img_data)).convert("RGBA")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(output_path)
        return True
    except Exception as e:
        print(f"    ✗ 생성 실패: {e}")
        return False


def remove_bg(img: Image.Image) -> Image.Image:
    """Flood-fill white/near-white background removal from edges."""
    img = img.convert("RGBA")
    w, h = img.size
    pixels = img.load()
    visited = [[False] * h for _ in range(w)]
    queue = (
        [(x, 0) for x in range(w)] +
        [(x, h-1) for x in range(w)] +
        [(0, y) for y in range(1, h-1)] +
        [(w-1, y) for y in range(1, h-1)]
    )
    while queue:
        x, y = queue.pop()
        if x < 0 or x >= w or y < 0 or y >= h or visited[x][y]:
            continue
        visited[x][y] = True
        r, g, b, a = pixels[x, y]
        if r < 210 or g < 210 or b < 210:
            continue
        pixels[x, y] = (r, g, b, 0)
        queue += [(x-1, y), (x+1, y), (x, y-1), (x, y+1)]
    return img


def gen_stage_clean(floor_dir: Path, ref_path: Path) -> bool:
    """Generate stage-clean.png by editing the reference to remove all furniture."""
    out = floor_dir / "background/stage-clean.png"
    if out.exists():
        print(f"  ⏭ stage-clean.png 이미 있음, 스킵")
        return True

    print(f"  → stage-clean.png 생성 중 (reference 편집 방식)...")

    # gpt-image-1 images.edit: feed reference, ask to remove furniture only
    # Resize reference to 1536x1024 maintaining wide aspect ratio
    ref_img = Image.open(ref_path).convert("RGBA")
    ref_img = ref_img.resize((1536, 1024), Image.LANCZOS)

    buf = BytesIO()
    ref_img.save(buf, format="PNG")
    buf.seek(0)

    prompt = (
        "Remove ALL furniture and movable objects from this isometric office floor image. "
        "Keep EVERYTHING ELSE exactly as-is: "
        "the exact same isometric camera angle, room shape, walls, floor surface, "
        "ceiling, windows, fixed lighting, elevator doors, structural doors, floor markings. "
        "The result must be the identical room structure with completely empty floor space. "
        "No chairs, no desks, no sofas, no tables, no plants, no decorations, no people. "
        "Only the architectural shell of the room remains."
    )

    try:
        resp = client.images.edit(
            model="gpt-image-1",
            image=("reference.png", buf, "image/png"),
            prompt=prompt,
            n=1,
            size=SIZE,
        )
        item = resp.data[0]
        if hasattr(item, 'b64_json') and item.b64_json:
            img_data = base64.b64decode(item.b64_json)
        else:
            import urllib.request
            with urllib.request.urlopen(item.url) as r:
                img_data = r.read()

        img = Image.open(BytesIO(img_data)).convert("RGBA")
        out.parent.mkdir(parents=True, exist_ok=True)
        img.save(out)
        print(f"  ✓ stage-clean.png 저장")
        return True
    except Exception as e:
        print(f"  ✗ stage-clean 실패: {e}")
        return False


def gen_floor_base(floor_dir: Path, floor_name: str, style: dict) -> bool:
    """Generate floor-base.png — just the floor tile/surface."""
    out = floor_dir / "background/floor-base.png"
    if out.exists():
        print(f"  ⏭ floor-base.png 이미 있음, 스킵")
        return True

    print(f"  → floor-base.png 생성 중...")
    prompt = (
        f"Isometric floor tile for '{floor_name}' office game sprite. "
        f"Art style: {style['style'][:200]} "
        "CRITICAL: True isometric projection — 45-degree top-down view like SimCity or Stardew Valley. "
        "Show ONLY the floor surface/tiles — the ground material filling the frame. "
        "No walls, no furniture, no ceiling, no objects, no text labels. "
        "The floor tiles should match the exact color and material from the style description. "
        "Black or transparent background outside the floor shape. "
        "Clean game-ready isometric floor tile sprite."
    )
    success = generate_image(prompt, out)
    if success:
        print(f"  ✓ floor-base.png 저장")
    return success


def gen_object(floor_dir: Path, floor_name: str, obj_name: str, style: dict) -> bool:
    """Generate individual object sprite."""
    out = floor_dir / f"objects/{obj_name}.png"
    if out.exists():
        print(f"    ⏭ {obj_name}.png 이미 있음")
        return True

    # Human-readable object names
    obj_labels = {
        "desk": "office desk",
        "chair": "office chair",
        "meeting-table": "meeting room table",
        "meeting-chair": "meeting room chair",
        "sofa": "office sofa / couch",
        "partition": "office partition divider",
        "wall-glass": "glass wall panel",
        "wall-solid": "solid wall panel",
        "door": "office door",
        "elevator": "elevator doors",
        "plant": "indoor office plant",
        "table": "lobby table",
        "server-rack": "server rack unit",
        "poster-board": "marketing poster board",
        "executive-desk": "large executive desk",
        "executive-chair": "executive leather chair",
        "coffee-table": "coffee table",
        "cabinet": "filing cabinet",
        "lamp": "floor lamp",
        "counter": "cafe counter",
        "bathroom-stall": "bathroom stall",
        "sink": "sink",
        "clean-background": None,  # skip, handled separately
    }

    if obj_name == "clean-background":
        return True  # handled by gen_stage_clean

    label = obj_labels.get(obj_name, obj_name.replace("-", " "))
    print(f"    → {obj_name}.png 생성 중...")

    prompt = (
        f"Single isometric game sprite: {label}. "
        f"Art style matching '{floor_name}' office: {style['style'][:200]} "
        "Single object only, centered in frame. "
        "Pure transparent/white background. "
        "Isometric 45-degree perspective view. "
        "No shadow on the background. "
        "Game-ready sprite, same art style and scale as the floor reference. "
        "High quality, clean edges."
    )

    success = generate_image(prompt, out)
    if success:
        # Apply background removal for object sprites
        img = Image.open(out)
        img = remove_bg(img)
        img.save(out)
        print(f"    ✓ {obj_name}.png 저장 (배경 제거 완료)")
    return success


def process_floor(floor_name: str, bg_only=False, objects_only=False):
    floor_dir = FLOORS_DIR / floor_name
    if not floor_dir.exists():
        print(f"⏭ 폴더 없음: {floor_name}")
        return

    ref_path = floor_dir / "reference-full.png"
    if not ref_path.exists():
        print(f"⏭ 레퍼런스 없음: {floor_name}")
        return

    obj_list_path = floor_dir / "object-list.json"
    objects = []
    if obj_list_path.exists():
        with open(obj_list_path) as f:
            objects = json.load(f).get("objects", [])

    print(f"\n{'='*50}")
    print(f"[{floor_name}]")

    # Analyze style once
    style = analyze_style(ref_path, floor_name)
    time.sleep(1)

    success_count = 0
    fail_count = 0

    if not objects_only:
        # Item 4: stage-clean background
        if gen_stage_clean(floor_dir, ref_path):
            success_count += 1
        else:
            fail_count += 1
        time.sleep(13)

        # Item 6: floor base
        if gen_floor_base(floor_dir, floor_name, style):
            success_count += 1
        else:
            fail_count += 1
        time.sleep(13)

    if not bg_only:
        # Item 5: individual objects
        for i, obj in enumerate(objects):
            if obj == "clean-background":
                continue
            if gen_object(floor_dir, floor_name, obj, style):
                success_count += 1
            else:
                fail_count += 1
            if i < len(objects) - 1:
                time.sleep(13)

    print(f"\n  [{floor_name}] 완료 — 성공: {success_count}, 실패: {fail_count}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("floors", nargs="*", help="Floor names (e.g. 1f-lobby 3f-engineering)")
    parser.add_argument("--bg-only", action="store_true", help="Only generate backgrounds (items 4+6)")
    parser.add_argument("--objects-only", action="store_true", help="Only generate objects (item 5)")
    args = parser.parse_args()

    all_floors = sorted(f.name for f in FLOORS_DIR.iterdir() if f.is_dir())
    targets = args.floors if args.floors else all_floors

    print(f"처리할 층: {targets}")
    print(f"모드: {'배경만' if args.bg_only else '오브젝트만' if args.objects_only else '전체'}\n")

    for floor in targets:
        process_floor(floor, bg_only=args.bg_only, objects_only=args.objects_only)

    print("\n\n전체 완료!")


if __name__ == "__main__":
    main()
