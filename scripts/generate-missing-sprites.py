# -*- coding: utf-8 -*-
"""
generate-missing-sprites.py

For each DB character without a sprite:
1. Build a visual description from name + persona
2. Generate chibi pixel-art sprite with gpt-image-1
3. Save to apps/web/public/sprites-v2/char-{slug}-work-stand.png
"""

import os, sys, json, time, re, base64
from pathlib import Path
from io import BytesIO
import openai
from PIL import Image

sys.stdout = __import__('io').TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SPRITES_DIR = Path(__file__).parent.parent / "apps/web/public/sprites-v2"
client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])

# ── Style reference (describe existing chars-nobg style) ──────────────────────
STYLE_BASE = (
    "Chibi pixel art character sprite, super-deformed style, "
    "large head small body, standing pose facing slightly right, "
    "white background, crisp pixel art style, game character design, "
    "isometric game art, 2D sprite, colorful and expressive. "
    "NO grid lines, pure white background, character centered. "
)

# ── Character visual hints ────────────────────────────────────────────────────
# gender guess from Korean name patterns + persona
def guess_gender(name_ko: str, persona: str) -> str:
    female_names = ["소라", "레아", "나비", "베라", "미라", "픽셀스", "픽셀라", "비비드", "셀린"]
    male_names   = ["헥터", "재민", "오리온", "마르크", "악시옴", "오라클", "버즈", "펄스",
                    "반트", "오르도", "링커", "델타엠", "노드7", "케인", "라이벌", "카이트",
                    "아크", "룬", "센티넬", "오메가", "아틀라스", "퀼", "팬텀", "피봇",
                    "스택", "디버그", "옵스", "메모", "컴플라이", "시그마", "노바", "스펙온"]
    for fn in female_names:
        if fn in name_ko: return "female"
    for mn in male_names:
        if mn in name_ko: return "male"
    # fallback: check persona for gendered clues
    return "male"

def build_visual_prompt(code_name: str, name_ko: str, persona: str) -> str:
    gender = guess_gender(name_ko, persona)
    gender_str = "woman" if gender == "female" else "man"

    # Role/department hints from persona keywords
    role_hints = ""
    p = persona.lower()
    if any(w in p for w in ["ceo", "대표", "창업자", "결재"]):
        role_hints = "wearing elegant dark suit, confident posture"
    elif any(w in p for w in ["엔지니어", "개발", "코드", "서버", "api", "버그"]):
        role_hints = "wearing hoodie or casual tech outfit, glasses optional"
    elif any(w in p for w in ["디자인", "ui", "ux", "픽셀", "애니메이션", "색상"]):
        role_hints = "wearing creative colorful outfit, art supplies"
    elif any(w in p for w in ["마케팅", "카피", "광고", "콘텐츠", "sns"]):
        role_hints = "wearing trendy casual outfit, holding phone"
    elif any(w in p for w in ["재무", "회계", "예산", "cfo", "마진"]):
        role_hints = "wearing formal suit, holding documents"
    elif any(w in p for w in ["전략", "기획", "분석", "데이터"]):
        role_hints = "wearing business casual, holding notebook"
    elif any(w in p for w in ["법무", "계약", "조항", "보안"]):
        role_hints = "wearing formal dark outfit, serious expression"
    elif any(w in p for w in ["hr", "채용", "인재", "리크루터"]):
        role_hints = "wearing friendly business casual, warm smile"
    elif any(w in p for w in ["운영", "ops", "인프라", "서버실"]):
        role_hints = "wearing casual workwear, utility look"
    else:
        role_hints = "wearing smart casual office outfit"

    # Hair color variety based on code_name hash
    hair_colors = ["dark brown hair", "black hair", "light brown hair",
                   "blonde hair", "dark hair with highlights", "auburn hair",
                   "black short hair", "brown wavy hair"]
    h = sum(ord(c) for c in code_name) % len(hair_colors)
    hair = hair_colors[h]

    prompt = (
        f"{STYLE_BASE}"
        f"A chibi pixel art {gender_str}, {hair}, {role_hints}. "
        f"Character personality: {persona[:120]}. "
        f"Standing work pose, office setting prop. "
        f"Single character centered on pure white background."
    )
    return prompt


def remove_white_bg(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    w, h = img.size
    pixels = img.load()
    visited = [[False]*h for _ in range(w)]
    queue = [(x, y) for x in range(w) for y in [0, h-1]] + [(x, y) for y in range(1, h-1) for x in [0, w-1]]
    while queue:
        x, y = queue.pop()
        if x < 0 or x >= w or y < 0 or y >= h or visited[x][y]: continue
        visited[x][y] = True
        r, g, b, a = pixels[x, y]
        if r < 220 or g < 220 or b < 220: continue
        pixels[x, y] = (r, g, b, 0)
        queue += [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]
    return img


def generate_sprite(code_name: str, name_ko: str, persona: str) -> Image.Image | None:
    prompt = build_visual_prompt(code_name, name_ko, persona)
    try:
        response = client.images.generate(
            model="gpt-image-1",
            prompt=prompt,
            n=1,
            size="1024x1024",
            quality="medium",
        )
        item = response.data[0]
        if hasattr(item, 'b64_json') and item.b64_json:
            img = Image.open(BytesIO(base64.b64decode(item.b64_json)))
        else:
            import urllib.request
            with urllib.request.urlopen(item.url) as r:
                img = Image.open(BytesIO(r.read()))
        img = img.convert("RGBA").resize((512, 512), Image.LANCZOS)
        return remove_white_bg(img)
    except Exception as e:
        print(f"    ERROR: {e}")
        return None


def main():
    # Fetch all characters from API
    import urllib.request
    url = "http://localhost:4000/api/v1/characters?pageSize=100"
    req = urllib.request.Request(url, headers={"Authorization": "Bearer dev-bypass"})
    with urllib.request.urlopen(req) as r:
        data = json.loads(r.read())
    chars = data["data"]["items"]

    # Find missing ones
    missing = []
    for c in chars:
        slug = c["code_name"].lower().replace("_", "-")
        found = any(f.startswith(f"char-{slug}-") for f in os.listdir(SPRITES_DIR))
        if not found:
            missing.append({
                "code_name": c["code_name"],
                "slug": slug,
                "name_ko": c.get("name", ""),
                "persona": c.get("persona_summary", ""),
            })

    print(f"스프라이트 생성 필요: {len(missing)}명\n")

    success, fail = 0, 0
    for i, char in enumerate(missing):
        slug = char["slug"]
        out_path = SPRITES_DIR / f"char-{slug}-work-stand.png"
        if out_path.exists():
            print(f"[{i+1}/{len(missing)}] {char['code_name']} — 이미 있음, 스킵")
            continue

        print(f"[{i+1}/{len(missing)}] {char['code_name']} ({char['name_ko']}) 생성 중...")
        img = generate_sprite(char["code_name"], char["name_ko"], char["persona"])
        if img:
            img.save(out_path)
            print(f"    저장: {out_path.name}")
            success += 1
        else:
            fail += 1

        # Rate limit: 5 req/min on gpt-image-1, so ~12s between calls
        if i < len(missing) - 1:
            time.sleep(13)

    print(f"\n완료 — 성공: {success}, 실패: {fail}")


if __name__ == "__main__":
    main()
