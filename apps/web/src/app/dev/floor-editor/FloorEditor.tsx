"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const FLOORS = [
  { id: "lobby",       dir: "1f-lobby",       label: "1F Lobby" },
  { id: "ops",         dir: "2f-ops",          label: "2F Ops" },
  { id: "engineering", dir: "3f-engineering",  label: "3F Engineering" },
  { id: "research",    dir: "4f-research",     label: "4F Research" },
  { id: "marketing",   dir: "5f-marketing",    label: "5F Marketing" },
  { id: "finance",     dir: "6f-planning",     label: "6F Planning" },
  { id: "cafe",        dir: "7f-cafe",         label: "7F Cafe" },
  { id: "executive",   dir: "8f-executive",    label: "8F Executive" },
];

const SKIP_ALWAYS = new Set(["clean-background"]);
const STRUCTURAL_KEYWORDS = ["wall", "door", "elevator", "partition", "bathroom", "sink", "stair"];
const DISPLAY_H = 110;

const FOOTPRINT_W = 0.5;
const FOOTPRINT_H = 0.30;

// Direction system:
//   southFacing=true  + flipH=false → SE  (default sprite)
//   southFacing=true  + flipH=true  → SW  (H-flip of default)
//   southFacing=false + flipH=false → NE  ({type}-n.png)
//   southFacing=false + flipH=true  → NW  (H-flip of {type}-n.png)
interface PlacedObject {
  id: string;
  type: string;
  x: number;
  y: number;
  flipH: boolean;
  southFacing: boolean; // false = use {type}-n.png (north-facing sprite)
}

interface DragState { id: string; offsetX: number; offsetY: number }
interface ImgSize { w: number; h: number }

function dirLabel(flipH: boolean, south: boolean) {
  if ( south && !flipH) return "SE";
  if ( south &&  flipH) return "SW";
  if (!south && !flipH) return "NE";
  return "NW";
}

function footprintOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  const faw = aw * FOOTPRINT_W, fah = ah * FOOTPRINT_H;
  const fbw = bw * FOOTPRINT_W, fbh = bh * FOOTPRINT_H;
  const ax1 = ax - faw / 2, ax2 = ax + faw / 2, ay1 = ay - fah, ay2 = ay;
  const bx1 = bx - fbw / 2, bx2 = bx + fbw / 2, by1 = by - fbh, by2 = by;
  return !(ax2 < bx1 || ax1 > bx2 || ay2 < by1 || ay1 > by2);
}

export default function FloorEditor() {
  const router = useRouter();
  const [floorIdx, setFloorIdx] = useState(0);
  const [placed, setPlaced] = useState<PlacedObject[]>([]);
  const [allTypes, setAllTypes] = useState<string[]>([]);
  // Track which types have a north (-n) sprite available
  const [northTypes, setNorthTypes] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<DragState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const imgSizes = useRef<Map<string, ImgSize>>(new Map());
  const floor = FLOORS[floorIdx]!;

  useEffect(() => {
    fetch(`/floors/${floor.dir}/layout.json`)
      .then((r) => r.json())
      .then((data: { objects?: Array<{ type: string; x?: number; y?: number; flipH?: boolean; southFacing?: boolean }> }) => {
        const types = [...new Set((data.objects ?? []).map((o) => o.type).filter((t) => !SKIP_ALWAYS.has(t)))];
        setAllTypes(types);
        setPlaced(
          (data.objects ?? [])
            .filter((o) => !SKIP_ALWAYS.has(o.type))
            .map((o, i) => ({
              id: `${o.type}-${i}`,
              type: o.type,
              x: o.x ?? 0.4,
              y: o.y ?? 0.5,
              flipH: o.flipH ?? false,
              southFacing: o.southFacing !== false, // default true
            }))
        );
        setSelected(null);

        // Check which types have a north sprite
        const northSet = new Set<string>();
        Promise.all(types.map((t) =>
          fetch(`/floors/${floor.dir}/objects/${t}-n.png`, { method: "HEAD" })
            .then((r) => { if (r.ok) northSet.add(t); })
            .catch(() => {})
        )).then(() => setNorthTypes(new Set(northSet)));
      })
      .catch(() => setAllTypes([]));
    setSaved(false);
  }, [floor.dir]);

  const isColliding = useCallback((id: string, x: number, y: number): boolean => {
    if (!canvasRef.current) return false;
    const { width: cw, height: ch } = canvasRef.current.getBoundingClientRect();
    const self = placed.find((o) => o.id === id);
    if (!self) return false;
    const ss = imgSizes.current.get(self.type) ?? { w: 80, h: DISPLAY_H };
    const px = x * cw, py = y * ch;
    return placed.some((other) => {
      if (other.id === id) return false;
      const os = imgSizes.current.get(other.type) ?? { w: 80, h: DISPLAY_H };
      return footprintOverlap(px, py, ss.w, ss.h, other.x * cw, other.y * ch, os.w, os.h);
    });
  }, [placed]);

  const addObject = (type: string) => {
    const id = `${type}-${Date.now()}`;
    setPlaced((prev) => [...prev, { id, type, x: 0.4, y: 0.5, flipH: false, southFacing: true }]);
    setSelected(id);
  };

  const removeSelected = useCallback(() => {
    setSelected((sel) => { if (sel) setPlaced((p) => p.filter((o) => o.id !== sel)); return null; });
  }, []);

  const setDir = useCallback((flipH: boolean, southFacing: boolean) => {
    setSelected((sel) => {
      if (sel) setPlaced((p) => p.map((o) => o.id === sel ? { ...o, flipH, southFacing } : o));
      return sel;
    });
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!drag || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left - drag.offsetX) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top  - drag.offsetY) / rect.height));
    setPlaced((prev) => prev.map((o) => o.id === drag.id ? { ...o, x, y } : o));
  }, [drag]);

  const onMouseUp = useCallback(() => setDrag(null), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selected) return;
      if (e.key === "1") setDir(false, true);   // SE
      if (e.key === "2") setDir(true,  true);   // SW
      if (e.key === "3") setDir(false, false);  // NE
      if (e.key === "4") setDir(true,  false);  // NW
      if (e.key === "Delete" || e.key === "Backspace") removeSelected();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, setDir, removeSelected]);

  const saveLayout = async () => {
    const existing = await fetch(`/floors/${floor.dir}/layout.json`).then((r) => r.json()).catch(() => ({}));
    const layout = {
      ...existing,
      floor: floor.id,
      objects: placed.map((o) => ({
        type: o.type,
        x: +o.x.toFixed(3),
        y: +o.y.toFixed(3),
        scale: 1.0,
        ...(o.flipH ? { flipH: true } : {}),
        ...(!o.southFacing ? { southFacing: false } : {}),
      })),
    };
    const res = await fetch(`/api/dev/save-layout?floor=${floor.dir}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(layout),
    });
    if (res.ok) setSaved(true);
    else alert("Save failed");
  };

  const selectedObj = placed.find((o) => o.id === selected);
  const furnitureTypes = allTypes.filter((t) => !STRUCTURAL_KEYWORDS.some((k) => t.includes(k)));
  const structuralTypes = allTypes.filter((t) =>  STRUCTURAL_KEYWORDS.some((k) => t.includes(k)));

  const DIRS = [
    { label: "↘ SE", fH: false, south: true  },
    { label: "↙ SW", fH: true,  south: true  },
    { label: "↗ NE", fH: false, south: false },
    { label: "↖ NW", fH: true,  south: false },
  ] as const;

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0f0f14", color: "#eee", fontFamily: "system-ui" }}>
      <div style={{ width: 230, padding: 12, borderRight: "1px solid #2a2a3a", display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", flexShrink: 0 }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>🗺️ 층 에디터</span>
          <button onClick={() => router.push("/world")}
            style={{ background: "#1a1a2a", border: "1px solid #333", color: "#aaa", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>
            ← 나가기
          </button>
        </div>

        <select value={floorIdx} onChange={(e) => setFloorIdx(Number(e.target.value))}
          style={{ background: "#1a1a2a", color: "#eee", border: "1px solid #333", padding: "4px 6px", borderRadius: 4, fontSize: 12 }}>
          {FLOORS.map((f, i) => <option key={f.id} value={i}>{f.label}</option>)}
        </select>

        {furnitureTypes.length > 0 && (
          <>
            <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>🪑 가구 / 소품:</div>
            {furnitureTypes.map((type) => (
              <button key={type} onClick={() => addObject(type)}
                style={{ background: "#141e2a", border: "1px solid #2a3a4a", color: "#8bc", borderRadius: 4, padding: "4px 8px", cursor: "pointer", textAlign: "left", fontSize: 11 }}>
                + {type}{northTypes.has(type) ? " ✦" : ""}
              </button>
            ))}
          </>
        )}

        {structuralTypes.length > 0 && (
          <>
            <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>🧱 벽 / 구조물:</div>
            {structuralTypes.map((type) => (
              <button key={type} onClick={() => addObject(type)}
                style={{ background: "#1e1a14", border: "1px solid #3a2a2a", color: "#ca8", borderRadius: 4, padding: "4px 8px", cursor: "pointer", textAlign: "left", fontSize: 11 }}>
                + {type}{northTypes.has(type) ? " ✦" : ""}
              </button>
            ))}
          </>
        )}

        {allTypes.length > 0 && (
          <div style={{ fontSize: 9, color: "#445" }}>✦ = 북향 스프라이트 있음</div>
        )}

        <hr style={{ borderColor: "#222", margin: "6px 0" }} />

        {selectedObj ? (
          <div style={{ background: "#14141e", border: "1px solid #2a2a4a", borderRadius: 6, padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 11, color: "#8bc", fontWeight: 600 }}>선택: {selectedObj.type}</div>
            <div style={{ fontSize: 10, color: "#666" }}>
              위치: ({selectedObj.x.toFixed(2)}, {selectedObj.y.toFixed(2)})
            </div>

            <div style={{ fontSize: 10, color: "#777" }}>방향:</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              {DIRS.map(({ label, fH, south }) => {
                const active = selectedObj.flipH === fH && selectedObj.southFacing === south;
                const needsNorth = !south;
                const hasNorth = northTypes.has(selectedObj.type);
                const disabled = needsNorth && !hasNorth;
                return (
                  <button key={label}
                    onClick={() => !disabled && setDir(fH, south)}
                    title={disabled ? `${selectedObj.type}-n.png 스프라이트 없음` : undefined}
                    style={{
                      ...btnStyle,
                      background: active ? "#1a3a5a" : "#141a24",
                      borderColor: active ? "#3a7aaa" : disabled ? "#2a2a2a" : "#2a3a4a",
                      color: active ? "#8df" : disabled ? "#333" : "#aac",
                      cursor: disabled ? "not-allowed" : "pointer",
                    }}>
                    {label}{disabled ? " 🚫" : ""}
                  </button>
                );
              })}
            </div>
            {!northTypes.has(selectedObj.type) && (
              <div style={{ fontSize: 9, color: "#554" }}>
                NE/NW: {selectedObj.type}-n.png 필요 (스크립트로 생성)
              </div>
            )}
            <div style={{ fontSize: 9, color: "#444" }}>키 1=SE · 2=SW · 3=NE · 4=NW · Del=삭제</div>

            <button onClick={removeSelected}
              style={{ ...btnStyle, background: "#2a1414", borderColor: "#4a2222", color: "#f88" }}>
              🗑 삭제 (Del)
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 10, color: "#444", textAlign: "center", padding: "8px 0" }}>오브젝트를 클릭해서 선택</div>
        )}

        <hr style={{ borderColor: "#222", margin: "6px 0" }} />

        <div style={{ fontSize: 10, color: "#555" }}>배치됨 ({placed.length}):</div>
        <div style={{ overflowY: "auto", maxHeight: 160, display: "flex", flexDirection: "column", gap: 2 }}>
          {placed.map((o) => (
            <div key={o.id} onClick={() => setSelected(o.id)}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                fontSize: 10, padding: "2px 6px", borderRadius: 3, cursor: "pointer",
                background: selected === o.id ? "#1a2a3a" : "#111",
                border: `1px solid ${selected === o.id ? "#3a6a9a" : "transparent"}`,
              }}>
              <span>{o.type} <span style={{ color: "#445" }}>{dirLabel(o.flipH, o.southFacing)}</span></span>
              <button onClick={(e) => { e.stopPropagation(); setPlaced((p) => p.filter((x) => x.id !== o.id)); if (selected === o.id) setSelected(null); }}
                style={{ background: "none", border: "none", color: "#f66", cursor: "pointer", fontSize: 12, lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>

        <hr style={{ borderColor: "#222", margin: "6px 0" }} />
        <button onClick={saveLayout}
          style={{ background: saved ? "#0a2a0a" : "#0a1a2a", border: `1px solid ${saved ? "#2a6a2a" : "#2a4a6a"}`, color: saved ? "#6f6" : "#6af", borderRadius: 4, padding: "7px 10px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
          {saved ? "✓ 저장됨" : "💾 저장"}
        </button>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", cursor: drag ? "grabbing" : "default" }}
        onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
        <div ref={canvasRef} style={{ position: "absolute", inset: 0 }}>
          <img
            src={`/floors/${floor.dir}/background/stage-clean.png`}
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            alt={floor.label}
          />

          {placed.map((obj) => {
            const colliding = drag?.id === obj.id && isColliding(obj.id, obj.x, obj.y);
            const isSelected = selected === obj.id;
            // Use {type}-n.png for north-facing, {type}.png for south-facing
            const spriteSrc = obj.southFacing
              ? `/floors/${floor.dir}/objects/${obj.type}.png`
              : `/floors/${floor.dir}/objects/${obj.type}-n.png`;
            return (
              <div
                key={obj.id}
                style={{
                  position: "absolute",
                  left: `${obj.x * 100}%`,
                  top: `${obj.y * 100}%`,
                  transform: `translate(-50%, -100%) scaleX(${obj.flipH ? -1 : 1})`,
                  cursor: drag?.id === obj.id ? "grabbing" : "grab",
                  userSelect: "none",
                  outline: colliding ? "2px solid #f44" : isSelected ? "2px solid #5af" : "2px solid transparent",
                  outlineOffset: 2,
                  borderRadius: 4,
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setSelected(obj.id);
                  setDrag({ id: obj.id, offsetX: 0, offsetY: 0 });
                }}
              >
                <img
                  src={spriteSrc}
                  style={{ height: DISPLAY_H, width: "auto", display: "block", pointerEvents: "none" }}
                  alt={obj.type}
                  draggable={false}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    const scale = DISPLAY_H / img.naturalHeight;
                    imgSizes.current.set(obj.type, { w: img.naturalWidth * scale, h: DISPLAY_H });
                  }}
                />
                {isSelected && (
                  <div style={{
                    position: "absolute", bottom: -18, left: "50%", transform: "translateX(-50%)",
                    fontSize: 9, color: colliding ? "#f44" : "#5af", background: "rgba(0,0,0,0.8)",
                    padding: "1px 5px", borderRadius: 3, whiteSpace: "nowrap",
                  }}>
                    {obj.type} {dirLabel(obj.flipH, obj.southFacing)}{colliding ? " ⚠충돌" : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  flex: 1, background: "#141a24", border: "1px solid #2a3a4a", color: "#aac",
  borderRadius: 3, padding: "3px 0", cursor: "pointer", fontSize: 10,
};
