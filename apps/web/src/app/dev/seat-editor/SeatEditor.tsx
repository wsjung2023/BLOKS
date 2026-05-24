"use client";
import React, { useState, useRef, useCallback } from "react";
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

interface Seat { x: number; y: number }
type AllSeats = Record<string, Seat[]>;

export default function SeatEditor() {
  const router = useRouter();
  const [floorIdx, setFloorIdx] = useState(0);
  const [allSeats, setAllSeats] = useState<AllSeats>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const floor = FLOORS[floorIdx]!;
  const seats: Seat[] = allSeats[floor.id] ?? [];

  const setSeats = (next: Seat[]) =>
    setAllSeats((prev) => ({ ...prev, [floor.id]: next }));

  const getRelativePos = useCallback((e: React.MouseEvent): { x: number; y: number } | null => {
    const img = imgRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x: +x.toFixed(3), y: +y.toFixed(3) };
  }, []);

  const onImageClick = useCallback((e: React.MouseEvent) => {
    // Check if click is near an existing seat (within ~12px)
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const hitIdx = seats.findIndex((s) => {
      const sx = s.x * rect.width;
      const sy = s.y * rect.height;
      return Math.hypot(px - sx, py - sy) < 14;
    });

    if (hitIdx !== -1) {
      setSelected(hitIdx === selected ? null : hitIdx);
      return;
    }

    const pos = getRelativePos(e);
    if (!pos) return;
    setSelected(null);
    setSeats([...seats, pos]);
  }, [seats, selected, getRelativePos]);

  const removeSelected = () => {
    if (selected === null) return;
    const next = seats.filter((_, i) => i !== selected);
    setSeats(next);
    setSelected(null);
  };

  const moveSelected = (dx: number, dy: number) => {
    if (selected === null) return;
    setSeats(seats.map((s, i) =>
      i === selected
        ? { x: +Math.max(0, Math.min(1, s.x + dx)).toFixed(3), y: +Math.max(0, Math.min(1, s.y + dy)).toFixed(3) }
        : s
    ));
  };

  const onKey = useCallback((e: React.KeyboardEvent) => {
    if (selected === null) return;
    const step = e.shiftKey ? 0.01 : 0.003;
    if (e.key === "ArrowLeft")  { e.preventDefault(); moveSelected(-step, 0); }
    if (e.key === "ArrowRight") { e.preventDefault(); moveSelected( step, 0); }
    if (e.key === "ArrowUp")    { e.preventDefault(); moveSelected(0, -step); }
    if (e.key === "ArrowDown")  { e.preventDefault(); moveSelected(0,  step); }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeSelected(); }
    if (e.key === "Escape") setSelected(null);
  }, [selected, seats]);

  const generateCode = () => {
    const lines = Object.entries(allSeats)
      .filter(([, s]) => s.length > 0)
      .map(([id, s]) => {
        const inner = s.map((p) => `{ x: ${p.x}, y: ${p.y} }`).join(", ");
        return `  ${id}: [\n    ${inner}\n  ],`;
      });
    return `const FLOOR_SEAT_OVERRIDES: Record<string, Array<{ x: number; y: number }>> = {\n${lines.join("\n")}\n};`;
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(generateCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{ display: "flex", height: "100vh", background: "#0f0f14", color: "#eee", fontFamily: "system-ui" }}
      onKeyDown={onKey}
      tabIndex={0}
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus
    >
      {/* Sidebar */}
      <div style={{ width: 240, padding: 12, borderRight: "1px solid #2a2a3a", display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>🪑 좌석 에디터</span>
          <button onClick={() => router.push("/world")}
            style={outlineBtnStyle}>← 나가기</button>
        </div>

        <select value={floorIdx} onChange={(e) => { setFloorIdx(Number(e.target.value)); setSelected(null); }}
          style={{ background: "#1a1a2a", color: "#eee", border: "1px solid #333", padding: "4px 6px", borderRadius: 4, fontSize: 12 }}>
          {FLOORS.map((f, i) => <option key={f.id} value={i}>{f.label}</option>)}
        </select>

        <div style={{ fontSize: 11, color: "#aaa", lineHeight: 1.6 }}>
          <b style={{ color: "#7cf" }}>클릭</b> — 좌석 추가<br />
          <b style={{ color: "#7cf" }}>좌석 클릭</b> — 선택<br />
          <b style={{ color: "#7cf" }}>방향키</b> — 미세 조정<br />
          <b style={{ color: "#7cf" }}>Shift+방향키</b> — 크게 이동<br />
          <b style={{ color: "#f88" }}>Delete</b> — 선택 삭제
        </div>

        <hr style={{ borderColor: "#222", margin: "2px 0" }} />

        <div style={{ fontSize: 12, color: "#8bc", fontWeight: 600 }}>
          {floor.label} — 좌석 {seats.length}개
        </div>

        {selected !== null && seats[selected] && (
          <div style={{ background: "#14141e", border: "1px solid #3a3a5a", borderRadius: 6, padding: 8, fontSize: 11 }}>
            <div style={{ color: "#7cf", fontWeight: 600, marginBottom: 4 }}>
              #{selected + 1} 선택됨
            </div>
            <div>x: <b>{seats[selected]!.x}</b></div>
            <div>y: <b>{seats[selected]!.y}</b></div>
            <button onClick={removeSelected}
              style={{ marginTop: 6, ...outlineBtnStyle, borderColor: "#4a2222", color: "#f88", width: "100%" }}>
              🗑 삭제 (Del)
            </button>
          </div>
        )}

        <div style={{ fontSize: 10, color: "#555", maxHeight: 180, overflowY: "auto" }}>
          {seats.map((s, i) => (
            <div key={i} onClick={() => setSelected(i === selected ? null : i)}
              style={{
                padding: "2px 6px", borderRadius: 3, cursor: "pointer", marginBottom: 1,
                background: selected === i ? "#1a2a3a" : "#111",
                border: `1px solid ${selected === i ? "#3a6a9a" : "transparent"}`,
                display: "flex", justifyContent: "space-between",
              }}>
              <span style={{ color: "#7cf" }}>#{i + 1}</span>
              <span>{s.x}, {s.y}</span>
            </div>
          ))}
        </div>

        <hr style={{ borderColor: "#222", margin: "2px 0" }} />

        <div style={{ fontSize: 11, color: "#666", marginBottom: 2 }}>모든 층 현황:</div>
        {FLOORS.map((f) => {
          const count = (allSeats[f.id] ?? []).length;
          return (
            <div key={f.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: count > 0 ? "#6c8" : "#445" }}>
              <span>{f.label}</span>
              <span>{count > 0 ? `✓ ${count}` : "—"}</span>
            </div>
          );
        })}

        <hr style={{ borderColor: "#222", margin: "2px 0" }} />

        <button onClick={copyCode}
          style={{
            background: copied ? "#0a2a0a" : "#0a1a2a",
            border: `1px solid ${copied ? "#2a6a2a" : "#2a4a6a"}`,
            color: copied ? "#6f6" : "#6af",
            borderRadius: 4, padding: "7px 10px", cursor: "pointer", fontWeight: 700, fontSize: 12,
          }}>
          {copied ? "✓ 복사됨!" : "📋 코드 복사"}
        </button>
        <div style={{ fontSize: 9, color: "#444", lineHeight: 1.4 }}>
          FLOOR_SEAT_OVERRIDES 코드를<br />클립보드에 복사합니다.
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden", background: "#080810" }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={`/floors/${floor.dir}/background/topdown.png`}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block", cursor: "crosshair" }}
            alt={floor.label}
            onClick={onImageClick}
            draggable={false}
          />

          {/* Seat markers — rendered relative to image */}
          <SeatOverlay imgRef={imgRef} seats={seats} selected={selected} onSelect={setSelected} />
        </div>
      </div>
    </div>
  );
}

function SeatOverlay({
  imgRef,
  seats,
  selected,
  onSelect,
}: {
  imgRef: React.RefObject<HTMLImageElement | null>;
  seats: Seat[];
  selected: number | null;
  onSelect: (i: number) => void;
}) {
  const [, forceUpdate] = useState(0);

  // Re-render when window resizes so markers track the image
  React.useEffect(() => {
    const handler = () => forceUpdate((n) => n + 1);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const img = imgRef.current;
  if (!img) return null;
  const rect = img.getBoundingClientRect();
  const containerRect = img.parentElement?.getBoundingClientRect();
  if (!containerRect) return null;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {seats.map((s, i) => {
        const px = rect.left - containerRect.left + s.x * rect.width;
        const py = rect.top  - containerRect.top  + s.y * rect.height;
        const isSel = selected === i;
        return (
          <div
            key={i}
            onClick={(e) => { e.stopPropagation(); onSelect(i); }}
            style={{
              position: "absolute",
              left: px,
              top: py,
              transform: "translate(-50%, -50%)",
              width: isSel ? 22 : 18,
              height: isSel ? 22 : 18,
              borderRadius: "50%",
              background: isSel ? "rgba(100,200,255,0.9)" : "rgba(255,80,80,0.85)",
              border: `2px solid ${isSel ? "#fff" : "#ff4444"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 8, fontWeight: 700, color: isSel ? "#003" : "#fff",
              cursor: "pointer",
              pointerEvents: "auto",
              boxShadow: isSel ? "0 0 8px rgba(100,200,255,0.8)" : "0 0 4px rgba(0,0,0,0.5)",
              zIndex: isSel ? 10 : 5,
              userSelect: "none",
            }}
          >
            {i + 1}
          </div>
        );
      })}
    </div>
  );
}

const outlineBtnStyle: React.CSSProperties = {
  background: "#1a1a2a", border: "1px solid #333", color: "#aaa",
  borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 11,
};
