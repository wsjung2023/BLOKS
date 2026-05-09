# -*- coding: utf-8 -*-
"""
analyze-floor-layout.py

Uses GPT-4o vision to analyze each floor's reference image and extract:
- Object positions (x, y as fractions 0-1 of image dimensions)
- Seat positions for desk chairs and meeting chairs
- Object scale hints

Output: client-assets/world-rebuild/floors/{floor}/layout.json
"""

import os, sys, json, base64, time, argparse
from pathlib import Path

import openai

sys.stdout = __import__('io').TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

FLOORS_DIR = Path(__file__).parent.parent / "client-assets/world-rebuild/floors"
client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])


def encode_b64(path: Path) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()


def analyze_floor(floor_name: str) -> dict:
    floor_dir = FLOORS_DIR / floor_name
    ref_path = floor_dir / "reference-full.png"
    obj_list_path = floor_dir / "object-list.json"

    if not ref_path.exists():
        print(f"  ⏭ reference 없음: {floor_name}")
        return {}

    objects = []
    if obj_list_path.exists():
        with open(obj_list_path) as f:
            objects = [o for o in json.load(f).get("objects", []) if o != "clean-background"]

    print(f"\n{'='*50}")
    print(f"[{floor_name}] 분석 중... (오브젝트: {objects})")

    b64 = encode_b64(ref_path)

    prompt = f"""This is an isometric office floor image for '{floor_name}'.
The image uses isometric perspective (top-down 45-degree view).
Image coordinate system: (0,0) = top-left, (1,1) = bottom-right.

Objects present in this floor: {objects}

For each object listed, analyze the image and return its position.
For objects that appear multiple times (e.g. multiple desks, multiple chairs), list each instance.

Return ONLY valid JSON with this exact structure:
{{
  "floor": "{floor_name}",
  "image_size_hint": "1536x1024 wide isometric",
  "objects": [
    {{
      "type": "desk",
      "x": 0.35,
      "y": 0.55,
      "scale": 1.0,
      "instance": 1
    }},
    ...
  ],
  "seats": [
    {{
      "type": "desk_seat",
      "x": 0.35,
      "y": 0.62,
      "facing": "south",
      "linked_object_index": 0
    }},
    ...
  ],
  "meeting_seats": [
    {{
      "type": "meeting_seat",
      "x": 0.5,
      "y": 0.45,
      "facing": "south"
    }},
    ...
  ]
}}

Rules:
- x, y are fractions from 0.0 to 1.0 (relative to image width/height)
- For "desk" type: place seat (chair position) slightly south/below the desk center
- For "meeting-table": place meeting_seats around the table perimeter
- For "executive-desk": treat like desk but larger
- "facing" is the direction the character faces when seated: "south", "north", "east", "west"
- In isometric view, "south" means facing toward bottom-right of screen
- Scale 1.0 is default, use 0.8 for smaller objects, 1.2 for large ones
- Only include objects that are clearly visible in the image
- Be precise — character sprites will be placed at the seat positions

Return ONLY the JSON, no explanation."""

    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{b64}", "detail": "high"},
                },
                {"type": "text", "text": prompt},
            ],
        }],
        max_tokens=2000,
    )

    raw = resp.choices[0].message.content.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        layout = json.loads(raw)
        out_path = floor_dir / "layout.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(layout, f, indent=2, ensure_ascii=False)
        print(f"  ✓ layout.json 저장 ({len(layout.get('objects', []))} objects, "
              f"{len(layout.get('seats', []))} seats, "
              f"{len(layout.get('meeting_seats', []))} meeting seats)")
        return layout
    except json.JSONDecodeError as e:
        print(f"  ✗ JSON 파싱 실패: {e}")
        print(f"  Raw: {raw[:200]}")
        return {}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("floors", nargs="*", help="Floor names")
    args = parser.parse_args()

    all_floors = sorted(f.name for f in FLOORS_DIR.iterdir() if f.is_dir())
    targets = args.floors if args.floors else all_floors

    print(f"분석할 층: {targets}")

    results = {}
    for i, floor in enumerate(targets):
        layout = analyze_floor(floor)
        results[floor] = layout
        if i < len(targets) - 1:
            time.sleep(2)

    print("\n\n전체 완료!")
    total_seats = sum(
        len(r.get("seats", [])) + len(r.get("meeting_seats", []))
        for r in results.values()
    )
    print(f"총 좌석 수: {total_seats}")


if __name__ == "__main__":
    main()
