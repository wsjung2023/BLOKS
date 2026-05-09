# -*- coding: utf-8 -*-
"""
generate-character-poses.py

Generates missing pose sprites for each character:
  - work-desk  : character seated at desk, working
  - work-meeting: character seated at meeting table

Uses the existing work-stand sprite as style reference via GPT-4o analysis
then generates with gpt-image-1.

Usage:
  python scripts/generate-character-poses.py                    # all chars, all poses
  python scripts/generate-character-poses.py byte               # single char
  python scripts/generate-character-poses.py byte --pose desk   # single char, single pose
"""

import os, sys, json, base64, time, argparse
from pathlib import Path
from io import BytesIO
from PIL import Image
import openai

sys.stdout = __import__('io').TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SPRITES_DIR = Path(__file__).parent.parent / "apps/web/public/sprites-v2"
client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])

POSES = {
    "desk": "work-desk",
    "meeting": "work-meeting",
}

SIZE = "1024x1024"
QUALITY = "high"


def encode_b64(path: Path) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()


def remove_bg(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    w, h = img.size
    pixels = img.load()
    visited = [[False] * h for _ in range(w)]
    queue = (
        [(x, 0) for x in range(w)] + [(x, h-1) for x in range(w)] +
        [(0, y) for y in range(1, h-1)] + [(w-1, y) for y in range(1, h-1)]
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


def analyze_style(char_slug: str, stand_path: Path) -> str:
    b64 = encode_b64(stand_path)
    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": [
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}", "detail": "high"}},
            {"type": "text", "text": (
                f"This is a game character sprite for '{char_slug}' in standing/working pose. "
                "Describe in 2-3 sentences: art style, character appearance (hair, outfit, colors), "
                "and overall visual style. Be precise for use as an image generation prompt."
            )},
        ]}],
        max_tokens=200,
    )
    return resp.choices[0].message.content.strip()


def generate_pose(char_slug: str, pose_key: str, stand_path: Path, out_path: Path) -> bool:
    if out_path.exists():
        print(f"    ⏭ {out_path.name} 이미 있음")
        return True

    print(f"    → {out_path.name} 생성 중...")

    style = analyze_style(char_slug, stand_path)
    time.sleep(1)

    if pose_key == "desk":
        action = (
            "The character is SEATED at a desk, leaning slightly forward, "
            "hands on keyboard or looking at monitor. "
            "Isometric side-front view showing the character from roughly 45-degree angle. "
            "The character appears to be working/typing at their workstation."
        )
    else:  # meeting
        action = (
            "The character is SEATED at a meeting table, upper body visible, "
            "attentive posture, arms resting on table or holding notepad. "
            "Isometric side-front view showing the character from roughly 45-degree angle."
        )

    prompt = (
        f"Single isometric game character sprite. {style} "
        f"{action} "
        "Pure white or transparent background. "
        "Same art style, proportions, outfit and colors as the reference character. "
        "Character centered in frame, no desk or furniture in the sprite — character only. "
        "High quality, clean edges, game-ready sprite."
    )

    try:
        # Use images.edit with stand sprite as style reference
        stand_img = Image.open(stand_path).convert("RGBA")
        buf = BytesIO()
        stand_img.save(buf, format="PNG")
        buf.seek(0)

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
        img = remove_bg(img)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(out_path)
        print(f"    ✓ {out_path.name} 저장")
        return True
    except Exception as e:
        print(f"    ✗ 실패: {e}")
        return False


def process_character(char_slug: str, poses: list[str]):
    stand_path = SPRITES_DIR / f"char-{char_slug}-work-stand.png"
    if not stand_path.exists():
        print(f"  ⏭ stand 스프라이트 없음: {char_slug}")
        return

    print(f"\n[{char_slug}]")
    for pose_key in poses:
        suffix = POSES[pose_key]
        out_path = SPRITES_DIR / f"char-{char_slug}-{suffix}.png"
        generate_pose(char_slug, pose_key, stand_path, out_path)
        time.sleep(13)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("chars", nargs="*", help="Character slugs (e.g. byte forge)")
    parser.add_argument("--pose", choices=list(POSES.keys()), help="Specific pose only")
    args = parser.parse_args()

    all_chars = sorted(
        p.stem.replace("char-", "").replace("-work-stand", "")
        for p in SPRITES_DIR.glob("char-*-work-stand.png")
    )
    targets = args.chars if args.chars else all_chars
    poses = [args.pose] if args.pose else list(POSES.keys())

    print(f"캐릭터 {len(targets)}명, 포즈: {poses}")

    for char in targets:
        process_character(char, poses)

    print("\n\n전체 완료!")


if __name__ == "__main__":
    main()
