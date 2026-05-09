"""
remove-floor-characters.py

For each floor image:
1. Send to GPT-4o Vision → get bounding boxes of all people/characters
2. Paint those boxes white (alpha=0) to create a mask PNG
3. Send image + mask to OpenAI images.edit → inpaint with "empty office, no people"
4. Save result over original floor image (originals backed up to floor-originals/)
"""

import os, sys, json, base64, shutil, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
from pathlib import Path
from io import BytesIO
from PIL import Image
import openai

# ── Config ─────────────────────────────────────────────────────────────────────

SPRITES_DIR = Path(__file__).parent.parent / "apps/web/public/sprites-v2"
BACKUP_DIR  = SPRITES_DIR / "floor-originals"

FLOOR_FILES = [
    "floor-engineering-3f.png",
    "floor-ops-2f.png",
    "floor-marketing-5f.png",
    "floor-research-4f.png",
    "floor-planning-6f.png",
    "floor-finance-6f.png",
    "floor-executive-8f.png",
    "floor-ceo-8f.png",
    "floor-cafe-7f.png",
    "floor-lobby-1f.png",
]

# Per-floor inpainting prompt (describe what should fill the empty space)
FLOOR_PROMPTS = {
    "floor-engineering-3f.png": "Empty cyberpunk blue-lit tech office, empty chairs at computer desks, no people, isometric view, same art style",
    "floor-ops-2f.png":         "Empty dark security operations center, empty chairs at monitor stations, no people, isometric view, same art style",
    "floor-marketing-5f.png":   "Empty warm cozy marketing office, empty chairs at desks, plants, no people, isometric view, same art style",
    "floor-research-4f.png":    "Empty research lab office, empty chairs at workstations, no people, isometric view, same art style",
    "floor-planning-6f.png":    "Empty corporate planning office, empty chairs, no people, isometric view, same art style",
    "floor-finance-6f.png":     "Empty premium corporate office, empty chairs at desks, no people, isometric view, same art style",
    "floor-executive-8f.png":   "Empty luxury dark wood executive suite, empty chairs, no people, isometric view, same art style",
    "floor-ceo-8f.png":         "Empty luxury dark wood executive suite, empty chairs, no people, isometric view, same art style",
    "floor-cafe-7f.png":        "Empty cozy office cafe, empty chairs and tables, no people, isometric view, same art style",
    "floor-lobby-1f.png":       "Empty modern office lobby, empty seating areas, no people, isometric view, same art style",
}

DEFAULT_PROMPT = "Empty office space, empty chairs at desks, no people or characters, isometric view, same art style and lighting"

client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])


def encode_image_b64(path: Path) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()


def detect_character_boxes(image_path: Path) -> list[dict]:
    """Ask GPT-4o to return bounding boxes for all people in the image."""
    print(f"  → GPT-4o 감지 중: {image_path.name}")
    b64 = encode_image_b64(image_path)
    img = Image.open(image_path)
    W, H = img.size

    response = client.chat.completions.create(
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
                        f"This is an isometric office floor image ({W}x{H} pixels). "
                        "Identify ALL human figures/people/characters drawn into the scene. "
                        "For each person, return a JSON array of objects with keys: "
                        '"x" (left pixel), "y" (top pixel), "w" (width), "h" (height). '
                        "Include a 20px padding around each person. "
                        "Return ONLY valid JSON array, no explanation. "
                        "If no people found, return []."
                    ),
                },
            ],
        }],
        max_tokens=1000,
    )

    raw = response.choices[0].message.content.strip()
    # Strip markdown code blocks if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        boxes = json.loads(raw)
        print(f"     {len(boxes)}명 감지됨")
        return boxes
    except json.JSONDecodeError:
        print(f"     ⚠ JSON 파싱 실패: {raw[:100]}")
        return []


def build_mask(image_path: Path, boxes: list[dict]) -> Image.Image:
    """
    DALL-E inpainting mask: WHITE (255) = areas to regenerate, BLACK (0) = keep.
    Must be same size as original, RGBA.
    """
    img = Image.open(image_path).convert("RGBA")
    W, H = img.size
    mask = Image.new("RGBA", (W, H), (0, 0, 0, 255))  # all black = keep everything

    from PIL import ImageDraw
    draw = ImageDraw.Draw(mask)
    for b in boxes:
        x, y, w, h = int(b["x"]), int(b["y"]), int(b["w"]), int(b["h"])
        # Clamp to image bounds
        x1, y1 = max(0, x), max(0, y)
        x2, y2 = min(W, x + w), min(H, y + h)
        # White = inpaint this area
        draw.rectangle([x1, y1, x2, y2], fill=(255, 255, 255, 255))

    return mask


def analyze_floor_style(image_path: Path) -> str:
    """Ask GPT-4o to describe the floor art style precisely for regeneration."""
    b64 = encode_image_b64(image_path)
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}", "detail": "high"}},
                {"type": "text", "text": (
                    "Describe this isometric office floor image in detail for regeneration: "
                    "art style, color palette, lighting, room layout, furniture, decorations. "
                    "Do NOT mention any people or characters. "
                    "Keep it under 200 words. This will be used as an image generation prompt."
                )},
            ],
        }],
        max_tokens=300,
    )
    return response.choices[0].message.content.strip()


def regenerate_floor(image_path: Path, style_desc: str) -> Image.Image:
    """Use gpt-image-1 images.generate to recreate the floor without people."""
    print(f"  → gpt-image-1 재생성 중...")
    orig_img = Image.open(image_path)
    orig_size = orig_img.size

    full_prompt = (
        f"{style_desc} "
        "NO people, NO human figures, NO workers, NO characters anywhere in the scene. "
        "All chairs must be empty. All desks are unoccupied. "
        "Exact same isometric perspective, same art style, same lighting, same room layout."
    )

    import base64 as _b64
    response = client.images.generate(
        model="gpt-image-1",
        prompt=full_prompt,
        n=1,
        size="1024x1024",
        quality="high",
    )

    item = response.data[0]
    if hasattr(item, 'b64_json') and item.b64_json:
        result_img = Image.open(BytesIO(_b64.b64decode(item.b64_json))).convert("RGBA")
    else:
        import urllib.request
        with urllib.request.urlopen(item.url) as resp:
            result_img = Image.open(BytesIO(resp.read())).convert("RGBA")

    result_img = result_img.resize(orig_size, Image.LANCZOS)
    return result_img


def process_floor(filename: str):
    path = SPRITES_DIR / filename
    if not path.exists():
        print(f"⏭ 건너뜀 (파일 없음): {filename}")
        return

    print(f"\n[{filename}]")

    # Backup original
    BACKUP_DIR.mkdir(exist_ok=True)
    backup = BACKUP_DIR / filename
    if not backup.exists():
        shutil.copy2(path, backup)
        print(f"  ✓ 백업 완료")

    # Step 1: Detect characters
    boxes = detect_character_boxes(path)
    if not boxes:
        print(f"  ✓ 캐릭터 없음 — 스킵")
        return

    # Step 2: Analyze style
    print(f"  → 스타일 분석 중...")
    prompt = analyze_floor_style(path)
    print(f"  ✓ 스타일 분석 완료")

    # Step 3: Regenerate without people
    try:
        result = regenerate_floor(path, prompt)
        result.save(path)
        print(f"  ✓ 저장 완료: {path.name}")
    except Exception as e:
        print(f"  ✗ 재생성 실패: {e}")


# ── Main ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    targets = sys.argv[1:] if len(sys.argv) > 1 else FLOOR_FILES
    print(f"처리할 층: {len(targets)}개\n")
    for f in targets:
        process_floor(f)
    print("\n완료!")
