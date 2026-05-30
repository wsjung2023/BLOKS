"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { apiGet } from "@/lib/apiClient";
import { SpriteEditorHelp } from "@/components/layout/AppHelp";
import { compositeCharacter, LPC_COLS, LPC_DOWN_START, type LpcLayer } from "@/lib/lpc-compositor";

// ── Option definitions ─────────────────────────────────────────────────────────

const GENDERS = [
  { label: "남성", value: "male"   },
  { label: "여성", value: "female" },
];

const SKINS = [
  { label: "밝은 피부",  value: "light",  hex: "#f5c9a0" },
  { label: "올리브",     value: "olive",  hex: "#c8a87c" },
  { label: "브론즈",     value: "bronze", hex: "#a0693a" },
  { label: "갈색",       value: "brown",  hex: "#7a4a28" },
  { label: "호박색",     value: "amber",  hex: "#c07040" },
  { label: "황갈색",     value: "taupe",  hex: "#9e7060" },
  { label: "짙은 피부",  value: "black",  hex: "#4a2e1c" },
];

const EYE_COLORS = [
  { label: "파란 눈",   value: "blue"  },
  { label: "갈색 눈",   value: "brown" },
  { label: "회색 눈",   value: "gray"  },
  { label: "초록 눈",   value: "green" },
];

const EYEBROW_STYLES = [
  { label: "두꺼운 눈썹", value: "thick" },
  { label: "얇은 눈썹",   value: "thin"  },
  { label: "없음",        value: ""      },
];

const NOSE_STYLES = [
  { label: "기본 코", value: "button" },
  { label: "없음",    value: ""       },
];

const HAIR_STYLES = [
  { label: "짧은 앞머리", value: "bangsshort" },
  { label: "긴 앞머리",   value: "bangslong"  },
  { label: "단발",        value: "bob"        },
  { label: "긴 머리",     value: "long"       },
  { label: "픽시컷",      value: "pixie"      },
  { label: "버즈컷",      value: "buzzcut"    },
  { label: "베드헤드",    value: "bedhead"    },
  { label: "땋은 머리",   value: "braid"      },
  { label: "없음",        value: ""           },
];

const HAIR_COLORS = [
  { label: "검정",   value: "black"    },
  { label: "밤색",   value: "chestnut" },
  { label: "금발",   value: "blonde"   },
  { label: "회색",   value: "ash"      },
  { label: "흰색",   value: "white"    },
  { label: "생강색", value: "ginger"   },
];

const BEARD_STYLES = [
  { label: "없음",      value: ""              },
  { label: "5시 수염",  value: "5oclock_shadow"},
  { label: "기본 수염", value: "basic"         },
  { label: "중간 수염", value: "medium"        },
  { label: "다듬은 수염",value: "trimmed"      },
];

const MUSTACHE_STYLES = [
  { label: "없음",      value: ""       },
  { label: "기본",      value: "basic"  },
  { label: "핸들바",    value: "handlebar" },
  { label: "쉐브론",    value: "chevron"},
];

const GLASSES_STYLES = [
  { label: "없음",      value: ""          },
  { label: "기본 안경", value: "glasses"   },
  { label: "둥근 안경", value: "round"     },
  { label: "비서 안경", value: "secretary" },
  { label: "너드 안경", value: "nerd"      },
];

// SHIRT type depends on gender
const SHIRT_STYLES_M = [
  { label: "긴소매 셔츠", value: "shirt"   },
  { label: "카디건",      value: "jacket"  },
  { label: "정장 재킷",   value: "jacket2" },
  { label: "수트 재킷",   value: "suit"    },
  { label: "조끼",        value: "vest"    },
  { label: "오버롤",      value: "overalls"},
];
const SHIRT_STYLES_F = [
  { label: "긴소매 블라우스", value: "blouse_long" },
  { label: "블라우스",        value: "blouse"      },
  { label: "긴소매 셔츠",     value: "shirt"       },
  { label: "카디건",          value: "jacket"      },
  { label: "정장 재킷",       value: "jacket2"     },
  { label: "조끼",            value: "vest"        },
  { label: "원피스 드레스",   value: "dress_bodice"},
  { label: "포멀 드레스",     value: "dress_slit"  },
];

const SHIRT_COLORS = [
  { label: "파란",    value: "blue"     },
  { label: "노란",    value: "yellow"   },
  { label: "초록",    value: "green"    },
  { label: "주황",    value: "orange"   },
  { label: "보라",    value: "purple"   },
  { label: "네이비",  value: "navy"     },
  { label: "흰색",    value: "white"    },
  { label: "검정",    value: "black"    },
  { label: "차콜",    value: "charcoal" },
  { label: "빨강",    value: "red"      },
  { label: "핑크",    value: "pink"     },
  { label: "하늘색",  value: "sky"      },
  { label: "라벤더",  value: "lavender" },
  { label: "청록",    value: "teal"     },
  { label: "초록숲",  value: "forest"   },
  { label: "갈색",    value: "brown"    },
  { label: "회색",    value: "gray"     },
  { label: "청회색",  value: "bluegray" },
  { label: "와인",    value: "maroon"   },
  { label: "로즈",    value: "rose"     },
  { label: "탄",      value: "tan"      },
  { label: "가죽",    value: "leather"  },
  { label: "슬레이트",value: "slate"    },
  { label: "월넛",    value: "walnut"   },
];

const PANTS_STYLES = [
  { label: "정장 바지", value: "formal" },
  { label: "캐주얼",    value: "pants"  },
  { label: "스커트",    value: "skirt", femaleOnly: true },
];

const PANTS_COLORS = [
  { label: "차콜",  value: "charcoal" },
  { label: "검정",  value: "black"    },
  { label: "갈색",  value: "brown"    },
  { label: "네이비",value: "navy"     },
  { label: "회색",  value: "gray"     },
  { label: "흰색",  value: "white"    },
];

const SHOES_STYLES = [
  { label: "기본 구두", value: "shoes"  },
  { label: "클래식",    value: "shoes2" },
];

const SHOES_COLORS = [
  { label: "검정",  value: "black" },
  { label: "갈색",  value: "brown" },
  { label: "회색",  value: "gray"  },
  { label: "네이비",value: "navy"  },
  { label: "흰색",  value: "white" },
];

// ── Presets ────────────────────────────────────────────────────────────────────

const GLASSES_COLORS = [
  { label: "검정",  value: "black"  },
  { label: "갈색",  value: "brown"  },
  { label: "금색",  value: "gold"   },
  { label: "은색",  value: "silver" },
];

type Preset = {
  gender: string; skin: string; eyeColor: string; eyebrow: string; nose: string;
  hairStyle: string; hairColor: string; beard: string; mustache: string;
  glasses: string; glassesColor: string;
  shirtStyle: string; shirtColor: string; pantsStyle: string; pantsColor: string;
  shoesStyle: string; shoesColor: string;
};

const DEFAULT_M: Preset = {
  gender: "male", skin: "light", eyeColor: "brown", eyebrow: "thick", nose: "button",
  hairStyle: "bangsshort", hairColor: "black", beard: "", mustache: "",
  glasses: "", glassesColor: "black",
  shirtStyle: "shirt", shirtColor: "blue", pantsStyle: "formal", pantsColor: "charcoal",
  shoesStyle: "shoes", shoesColor: "black",
};

const PRESETS: { label: string; config: Partial<Preset> }[] = [
  { label: "랜덤",      config: {} }, // handled specially
  { label: "개발자",    config: { ...DEFAULT_M, shirtColor: "blue",    hairColor: "black" } },
  { label: "마케터",    config: { ...DEFAULT_M, shirtColor: "yellow",  hairColor: "chestnut" } },
  { label: "연구원",    config: { ...DEFAULT_M, shirtColor: "green",   hairColor: "brown", skin: "olive" } },
  { label: "운영팀",    config: { ...DEFAULT_M, shirtColor: "orange",  hairColor: "black" } },
  { label: "전략팀",    config: { ...DEFAULT_M, shirtColor: "purple",  hairColor: "ash" } },
  { label: "임원",      config: { ...DEFAULT_M, shirtStyle: "jacket2", shirtColor: "navy", pantsColor: "black", hairColor: "ash" } },
  { label: "여성 임원", config: { gender: "female", skin: "olive", shirtStyle: "dress_bodice", shirtColor: "navy", pantsStyle: "skirt", pantsColor: "black", hairStyle: "long", hairColor: "black", eyeColor: "brown", eyebrow: "thin", nose: "button", beard: "", mustache: "", glasses: "", shoesStyle: "shoes", shoesColor: "black" } },
];

function randomPreset(): Preset {
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]!;
  const g = Math.random() > 0.5 ? "male" : "female";
  const shirtStyles = g === "male" ? SHIRT_STYLES_M : SHIRT_STYLES_F;
  return {
    gender: g,
    skin: pick(SKINS).value,
    eyeColor: pick(EYE_COLORS).value,
    eyebrow: pick(EYEBROW_STYLES.filter(e => e.value !== "")).value,
    nose: "button",
    hairStyle: pick(HAIR_STYLES.filter(h => h.value !== "")).value,
    hairColor: pick(HAIR_COLORS).value,
    beard: Math.random() > 0.7 && g === "male" ? pick(BEARD_STYLES.filter(b => b.value !== "")).value : "",
    mustache: "",
    glasses: Math.random() > 0.8 ? pick(GLASSES_STYLES.filter(gl => gl.value !== "")).value : "",
    glassesColor: pick(GLASSES_COLORS).value,
    shirtStyle: pick(shirtStyles).value,
    shirtColor: pick(SHIRT_COLORS).value,
    pantsStyle: g === "male" ? "formal" : pick(["formal", "skirt"]),
    pantsColor: pick(PANTS_COLORS).value,
    shoesStyle: pick(SHOES_STYLES).value,
    shoesColor: pick(SHOES_COLORS).value,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function shirtUrl(g: string, style: string, color: string): string | null {
  if (!style || !color) return null;
  if (style === "dress_bodice") return `dress/bodice/female/${color}.png`;
  if (style === "dress_slit")   return `dress/slit/female/${color}.png`;
  if (style === "suit")         return `torso/suit/${g}/${color}.png`;
  if (style === "blouse") return `torso/blouse/${g}/${color}.png`;
  if (style === "blouse_long") return `torso/blouse_long/${g}/${color}.png`;
  return `torso/${style}/${g}/${color}.png`;
}

function pantsUrl(g: string, style: string, color: string): string | null {
  if (!style || !color) return null;
  if (style === "skirt") return `legs/skirt/female/${color}.png`;
  return `legs/${style}/${g}/${color}.png`;
}

// Nose only exists for: light, olive, bronze, brown, black
const NOSE_SKIN_MAP: Record<string, string> = { amber: "bronze", taupe: "olive" };
// Eyebrows only have black.png (monochrome outline, works for all skins)
// Glasses color options: black, brown, gold, silver
const DEFAULT_GLASSES_COLOR = "black";

function buildLayers(p: Preset): LpcLayer[] {
  const g = p.gender as "male" | "female";
  const s = p.skin;
  const noseSkin = NOSE_SKIN_MAP[s] ?? s;
  const layers: LpcLayer[] = [
    { url: "shadow/shadow.png", zPos: -1 },
    { url: `body/${g}/${s}.png`, zPos: 0 },
    { url: `head/${g}/${s}.png`, zPos: 5 },
  ];
  const addUrl = (url: string | null, zPos: number) => { if (url) layers.push({ url, zPos }); };

  addUrl(p.nose     ? `nose/button/${noseSkin}.png` : null, 6);
  addUrl(p.eyebrow  ? `eyes/eyebrows/${p.eyebrow}/black.png` : null, 7);
  addUrl(p.eyeColor ? `eyes/default/${p.eyeColor}.png` : null, 8);

  const pants = pantsUrl(g, p.pantsStyle, p.pantsColor);
  addUrl(pants, 9);

  const sh = shirtUrl(g, p.shirtStyle, p.shirtColor);
  addUrl(sh, 10);

  addUrl(p.glasses ? `glasses/${p.glasses}/${p.glassesColor ?? DEFAULT_GLASSES_COLOR}.png` : null, 15);
  addUrl((g === "male" && p.beard)    ? `beards/${p.beard}/${p.hairColor}.png` : null, 16);
  addUrl((g === "male" && p.mustache) ? `mustache/${p.mustache}/${p.hairColor}.png` : null, 17);
  addUrl(p.hairStyle ? `hair/${p.hairStyle}/${p.hairColor}.png` : null, 20);
  addUrl(p.shoesStyle ? `feet/${p.shoesStyle}/${g}/${p.shoesColor}.png` : null, 25);

  return layers;
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface Character {
  id: string;
  name: string;
  code_name: string;
  divisions?: { division_type?: string };
  ranks?:     { name?: string };
  roles?:     { name?: string };
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CharacterEditorPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [preset, setPreset] = useState<Preset>({ ...DEFAULT_M });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const sheetUrlRef = useRef<string | null>(null);
  const animRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  const update = useCallback((patch: Partial<Preset>) => setPreset(p => ({ ...p, ...patch })), []);

  useEffect(() => {
    apiGet<{ data?: { items?: Character[] } }>("/characters?pageSize=100")
      .then((body) => {
        const items = body.data?.items ?? [];
        setCharacters(items.filter((c) => c.code_name));
        if (items[0]) setSelectedId(items[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const layers = buildLayers(preset);
    let cancelled = false;
    if (animRef.current) cancelAnimationFrame(animRef.current);

    compositeCharacter(layers, "/assets/lpc2/").then((url) => {
      if (cancelled) return;
      if (sheetUrlRef.current) URL.revokeObjectURL(sheetUrlRef.current);
      sheetUrlRef.current = url;
      startAnimation(url);
    }).catch(() => {});

    return () => {
      cancelled = true;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [preset]);

  function startAnimation(sheetUrl: string) {
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = sheetUrl;
    img.onload = () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      const FRAME_W = 64, FRAME_H = 64, SCALE = 4, FPS = 8;
      canvas.width  = FRAME_W * SCALE;
      canvas.height = FRAME_H * SCALE;
      ctx!.imageSmoothingEnabled = false;
      let frame = 0, lastTime = 0;

      function draw(now: number) {
        if (now - lastTime > 1000 / FPS) {
          const col = (LPC_DOWN_START + frame) % LPC_COLS;
          const row = Math.floor((LPC_DOWN_START + frame) / LPC_COLS);
          ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
          ctx!.drawImage(img, col * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H, 0, 0, FRAME_W * SCALE, FRAME_H * SCALE);
          frame = (frame + 1) % 9;
          lastTime = now;
        }
        animRef.current = requestAnimationFrame(draw);
      }
      animRef.current = requestAnimationFrame(draw);
    };
  }

  async function handleSave() {
    const char = characters.find((c) => c.id === selectedId);
    if (!char || !sheetUrlRef.current) return;
    const slug = char.code_name.toLowerCase().replace(/_/g, "-");
    setSaving(true); setSaved(false);
    try {
      const res = await fetch(sheetUrlRef.current);
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      await fetch("/api/sprite-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, data: btoa(binary) }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  function applyPreset(p: typeof PRESETS[number]) {
    if (p.label === "랜덤") { setPreset(randomPreset()); return; }
    setPreset(prev => ({ ...prev, ...p.config }));
  }

  const g = preset.gender;
  const shirtStyles = g === "male" ? SHIRT_STYLES_M : SHIRT_STYLES_F;
  const selectedChar = characters.find((c) => c.id === selectedId);

  return (
    <AppShell helpContent={<SpriteEditorHelp />}>
      <div style={{ padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem" }}>
          <a href="/world" style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.82rem", color: "var(--color-muted)", textDecoration: "none", padding: "0.3rem 0.7rem", border: "1px solid var(--color-border)", borderRadius: 6 }}>
            ← 월드
          </a>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>
            캐릭터 스프라이트 에디터
          </h1>
        </div>

        {/* Character selector */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={labelStyle}>캐릭터 선택</label>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={selectStyle}>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code_name}) — {c.divisions?.division_type ?? "팀 미배정"} / {c.ranks?.name ?? ""} / {c.roles?.name ?? ""}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* ── Left panel ── */}
          <div style={{ flex: "1 1 480px", display: "grid", gap: "1rem" }}>

            {/* Presets */}
            <Section title="프리셋">
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {PRESETS.map((p) => (
                  <button key={p.label} onClick={() => applyPreset(p)} style={presetBtn(p.label === "랜덤")}>
                    {p.label === "랜덤" ? "🎲 랜덤" : p.label}
                  </button>
                ))}
              </div>
            </Section>

            {/* Gender */}
            <Section title="성별">
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {GENDERS.map((gi) => (
                  <button
                    key={gi.value}
                    onClick={() => update(gi.value === "female"
                      ? { gender: gi.value, beard: "", mustache: "" }
                      : { gender: gi.value }
                    )}
                    style={chipStyle(preset.gender === gi.value, true)}
                  >
                    {gi.label}
                  </button>
                ))}
              </div>
            </Section>

            {/* Skin */}
            <Section title="피부색">
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {SKINS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => update({ skin: s.value })}
                    title={s.label}
                    style={{
                      width: 28, height: 28, borderRadius: "50%", cursor: "pointer",
                      background: s.hex,
                      border: preset.skin === s.value ? "3px solid #7c6af7" : "2px solid #444",
                      outline: preset.skin === s.value ? "2px solid #c4b5fd" : "none",
                    }}
                  />
                ))}
              </div>
            </Section>

            {/* Eyes */}
            <Section title="눈 & 눈썹">
              <div style={{ display: "grid", gap: "0.5rem" }}>
                <SmallLabel>눈 색깔</SmallLabel>
                <ChipRow options={EYE_COLORS}    value={preset.eyeColor}  onChange={(v) => update({ eyeColor: v })} />
                <SmallLabel>눈썹</SmallLabel>
                <ChipRow options={EYEBROW_STYLES} value={preset.eyebrow}  onChange={(v) => update({ eyebrow: v })} />
              </div>
            </Section>

            {/* Nose */}
            <Section title="코">
              <ChipRow options={NOSE_STYLES} value={preset.nose} onChange={(v) => update({ nose: v })} />
            </Section>

            {/* Hair & Beard */}
            <Section title="헤어 & 수염">
              <div style={{ display: "grid", gap: "0.5rem" }}>
                <SmallLabel>헤어 스타일</SmallLabel>
                <ChipRow options={HAIR_STYLES}  value={preset.hairStyle}  onChange={(v) => update({ hairStyle: v })}  />
                <SmallLabel>헤어 색상</SmallLabel>
                <ChipRow options={HAIR_COLORS}  value={preset.hairColor}  onChange={(v) => update({ hairColor: v })}  />
                {g === "male" && <>
                  <SmallLabel>수염</SmallLabel>
                  <ChipRow options={BEARD_STYLES}    value={preset.beard}     onChange={(v) => update({ beard: v })}     />
                  <SmallLabel>콧수염</SmallLabel>
                  <ChipRow options={MUSTACHE_STYLES} value={preset.mustache}  onChange={(v) => update({ mustache: v })}  />
                </>}
              </div>
            </Section>

            {/* Glasses */}
            <Section title="안경">
              <div style={{ display: "grid", gap: "0.5rem" }}>
                <SmallLabel>스타일</SmallLabel>
                <ChipRow options={GLASSES_STYLES} value={preset.glasses} onChange={(v) => update({ glasses: v })} />
                {preset.glasses && <>
                  <SmallLabel>프레임 색상</SmallLabel>
                  <ChipRow options={GLASSES_COLORS} value={preset.glassesColor} onChange={(v) => update({ glassesColor: v })} />
                </>}
              </div>
            </Section>

            {/* Shirt */}
            <Section title="상의">
              <div style={{ display: "grid", gap: "0.5rem" }}>
                <SmallLabel>스타일</SmallLabel>
                <ChipRow options={shirtStyles}  value={preset.shirtStyle} onChange={(v) => update({ shirtStyle: v })} />
                <SmallLabel>색상</SmallLabel>
                <ChipRow options={SHIRT_COLORS} value={preset.shirtColor} onChange={(v) => update({ shirtColor: v })} />
              </div>
            </Section>

            {/* Pants */}
            <Section title="하의">
              <div style={{ display: "grid", gap: "0.5rem" }}>
                <SmallLabel>스타일</SmallLabel>
                <ChipRow
                  options={PANTS_STYLES.filter(ps => !ps.femaleOnly || g === "female")}
                  value={preset.pantsStyle}
                  onChange={(v) => update({ pantsStyle: v })}
                />
                <SmallLabel>색상</SmallLabel>
                <ChipRow options={PANTS_COLORS} value={preset.pantsColor} onChange={(v) => update({ pantsColor: v })} />
              </div>
            </Section>

            {/* Shoes */}
            <Section title="신발">
              <div style={{ display: "grid", gap: "0.5rem" }}>
                <SmallLabel>스타일</SmallLabel>
                <ChipRow options={SHOES_STYLES}  value={preset.shoesStyle} onChange={(v) => update({ shoesStyle: v })} />
                <SmallLabel>색상</SmallLabel>
                <ChipRow options={SHOES_COLORS}  value={preset.shoesColor} onChange={(v) => update({ shoesColor: v })} />
              </div>
            </Section>
          </div>

          {/* ── Right: Preview + Save ── */}
          <div style={{ flex: "0 0 auto", textAlign: "center", position: "sticky", top: "1rem" }}>
            <div style={previewBoxStyle}>
              <canvas ref={previewRef} style={{ imageRendering: "pixelated" }} />
            </div>
            <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#888" }}>
              {selectedChar ? `${selectedChar.name} (${selectedChar.code_name})` : "—"}
            </div>
            <button onClick={handleSave} disabled={saving || !selectedId} style={saveButtonStyle(saving, saved)}>
              {saving ? "저장 중…" : saved ? "저장 완료!" : "스프라이트 저장"}
            </button>
            <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#666" }}>
              저장하면 월드 캔버스에 즉시 반영됩니다
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#12121f", border: "1px solid #1e1e3a", borderRadius: 8, padding: "0.75rem 1rem" }}>
      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#7c6af7", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.6rem" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function SmallLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "0.7rem", color: "#666", marginTop: "0.1rem" }}>{children}</div>;
}

function ChipRow({
  options, value, onChange,
}: { options: { label: string; value: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
      {options.map((opt) => (
        <button key={opt.value} onClick={() => onChange(opt.value)} style={chipStyle(value === opt.value)}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "0.8rem", fontWeight: 600,
  color: "#aaa", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em",
};

const selectStyle: React.CSSProperties = {
  width: "100%", padding: "0.5rem 0.75rem",
  background: "#1e1e2e", border: "1px solid #333", borderRadius: 6,
  color: "#eee", fontSize: "0.875rem",
};

const chipStyle = (active: boolean, large = false): React.CSSProperties => ({
  padding: large ? "0.4rem 1.2rem" : "0.25rem 0.6rem",
  borderRadius: 20, fontSize: "0.75rem", cursor: "pointer",
  border: active ? "1px solid #7c6af7" : "1px solid #2a2a40",
  background: active ? "#2d2550" : "#0f0f1e",
  color: active ? "#c4b5fd" : "#888",
  transition: "all 0.12s",
  whiteSpace: "nowrap" as const,
});

const presetBtn = (isRandom: boolean): React.CSSProperties => ({
  padding: "0.3rem 0.75rem", borderRadius: 6, fontSize: "0.78rem", cursor: "pointer",
  border: "1px solid " + (isRandom ? "#f59e0b" : "#2a2a40"),
  background: isRandom ? "#2d1e0a" : "#0f0f1e",
  color: isRandom ? "#f59e0b" : "#aaa",
  transition: "all 0.12s",
});

const previewBoxStyle: React.CSSProperties = {
  width: 256, height: 256, background: "#0a0a16",
  border: "2px solid #2d2d4e", borderRadius: 12,
  display: "flex", alignItems: "center", justifyContent: "center",
};

const saveButtonStyle = (saving: boolean, saved: boolean): React.CSSProperties => ({
  marginTop: "1rem", padding: "0.6rem 1.6rem",
  background: saved ? "#166534" : saving ? "#333" : "#4f46e5",
  color: "#fff", border: "none", borderRadius: 8,
  fontSize: "0.875rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
  width: "100%", transition: "background 0.2s",
});
