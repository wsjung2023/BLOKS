"use client";
import React, {
  useEffect, useState, useCallback, useMemo, useRef, useContext,
} from "react";
import { ContextPanelContext } from "../layout/AppShell-nav";
import { apiGet } from "../../lib/apiClient";
import {
  useWorldStream, extractRuntimePatch, type RuntimePatch,
} from "../../lib/useWorldStream";
import {
  FLOORS, FLOOR_DIVISION_MAP, FLOOR_DIR, ELEVATOR_ZONE, getSpritePose,
} from "./world-sprites";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RuntimeState {
  runtime_status?: string;
  activity_status?: string;
  workload_score?: number;
  fatigue_score?: number;
  burnout_triggered?: boolean;
  current_task_count?: number;
}

interface Character {
  id: string;
  name: string;
  code_name: string;
  active_mode: string;
  division_id?: string;
  divisions?: { code: string; name: string };
  ranks?: { name: string };
  roles?: { name: string };
  character_runtime_states?: RuntimeState | RuntimeState[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRuntime(char: Character): RuntimeState {
  const rs = char.character_runtime_states;
  const fallback: RuntimeState = {
    activity_status: "Idle", workload_score: 0, fatigue_score: 0,
    burnout_triggered: false, current_task_count: 0,
  };
  if (!rs) return fallback;
  return Array.isArray(rs) ? (rs[0] ?? fallback) : rs;
}

function getRuntimeStatus(char: Character): string {
  const rt = getRuntime(char);
  return rt.activity_status ?? rt.runtime_status ?? "Idle";
}

function getCharFloorId(char: Character): string {
  const code = (char.divisions?.code ?? char.division_id ?? "").toLowerCase();
  return FLOOR_DIVISION_MAP[code] ?? "lobby";
}

function getSpriteUrl(codeName: string, status: string): string {
  const slug = codeName.toLowerCase().replace(/_/g, "-");
  const rt: RuntimeState = { activity_status: status };
  const pose = getSpritePose(rt);
  if (pose === "meeting") return `/sprites-v2/char-${slug}-work-meeting.png`;
  if (pose === "desk") return `/sprites-v2/char-${slug}-work-desk.png`;
  return `/sprites-v2/char-${slug}-work-stand.png`;
}

// ── Top-down seat positions (normalized 0-1) for 1536×1024 floor images ──────
// Rows of desks: 4 rows × 5 cols = 20 seats max per floor
// Y increases downward; characters near the top render behind those at the bottom

const DEFAULT_SEATS = Array.from({ length: 20 }, (_, i) => {
  const col = i % 5;
  const row = Math.floor(i / 5);
  return {
    x: 0.18 + col * 0.16,
    y: 0.28 + row * 0.15,
  };
});

// Per-floor overrides to better match generated floor images
const FLOOR_SEAT_OVERRIDES: Record<string, Array<{ x: number; y: number }>> = {
  lobby: [
    { x: 0.30, y: 0.40 }, { x: 0.46, y: 0.43 }, { x: 0.62, y: 0.40 }, { x: 0.78, y: 0.43 },
    { x: 0.33, y: 0.55 }, { x: 0.50, y: 0.58 }, { x: 0.67, y: 0.55 },
  ],
  ops: [
    { x: 0.20, y: 0.32 }, { x: 0.36, y: 0.32 }, { x: 0.52, y: 0.32 }, { x: 0.68, y: 0.32 }, { x: 0.84, y: 0.32 },
    { x: 0.20, y: 0.48 }, { x: 0.36, y: 0.48 }, { x: 0.52, y: 0.48 }, { x: 0.68, y: 0.48 }, { x: 0.84, y: 0.48 },
    { x: 0.20, y: 0.62 }, { x: 0.36, y: 0.62 }, { x: 0.52, y: 0.62 }, { x: 0.68, y: 0.62 }, { x: 0.84, y: 0.62 },
  ],
  engineering: [
    { x: 0.20, y: 0.30 }, { x: 0.36, y: 0.30 }, { x: 0.52, y: 0.30 }, { x: 0.68, y: 0.30 }, { x: 0.84, y: 0.30 },
    { x: 0.20, y: 0.46 }, { x: 0.36, y: 0.46 }, { x: 0.52, y: 0.46 }, { x: 0.68, y: 0.46 }, { x: 0.84, y: 0.46 },
    { x: 0.20, y: 0.62 }, { x: 0.36, y: 0.62 }, { x: 0.52, y: 0.62 }, { x: 0.68, y: 0.62 }, { x: 0.84, y: 0.62 },
  ],
  marketing: [
    { x: 0.22, y: 0.33 }, { x: 0.40, y: 0.30 }, { x: 0.58, y: 0.33 }, { x: 0.76, y: 0.30 },
    { x: 0.22, y: 0.50 }, { x: 0.40, y: 0.47 }, { x: 0.58, y: 0.50 }, { x: 0.76, y: 0.47 },
    { x: 0.22, y: 0.65 }, { x: 0.40, y: 0.62 }, { x: 0.58, y: 0.65 }, { x: 0.76, y: 0.62 },
  ],
};

function getSeats(floorId: string) {
  return FLOOR_SEAT_OVERRIDES[floorId] ?? DEFAULT_SEATS;
}

// ── Shared scene data (React → Phaser) ───────────────────────────────────────

interface SceneCharData {
  id: string;
  name: string;
  codeName: string;
  status: string;
  fatigue: number;
  workload: number;
  burnout: boolean;
  seatIndex: number;
}

interface MoveTarget {
  targetX: number;
  targetY: number;
  targetFloor?: string | undefined;  // if set, character is transitioning floors
  isMoving: boolean;
}

interface BubbleData {
  characterId: string;
  bubbleType: "speech" | "thought" | "status";
  text: string;
  emoji?: string | undefined;
  duration: number;
}

interface SceneData {
  floorId: string;
  floorDir: string;
  characters: SceneCharData[];
  moveTargets: Map<string, MoveTarget>;
  pendingBubbles: BubbleData[];
  onCharClick: (charId: string) => void;
}

// ── CharacterDetail panel ─────────────────────────────────────────────────────

function CharacterDetail({ char }: { char: Character }) {
  const rt = getRuntime(char);
  const fatigue = rt.fatigue_score ?? 0;
  const workload = rt.workload_score ?? 0;
  const fc = fatigue > 70 ? "var(--color-toxic-red)" : fatigue > 40 ? "var(--color-toxic-orange)" : "inherit";
  const wc = workload > 70 ? "var(--color-toxic-red)" : workload > 40 ? "var(--color-toxic-orange)" : "inherit";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{char.name}</div>
        <div style={{ color: "var(--color-muted)", fontSize: "0.72rem" }}>
          {char.code_name} / {char.active_mode}
        </div>
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "auto 1fr",
        gap: "0.35rem 0.75rem", fontSize: "0.78rem",
      }}>
        <span style={{ color: "var(--color-muted)" }}>Division</span>
        <span>{char.divisions?.name ?? char.division_id ?? "--"}</span>
        <span style={{ color: "var(--color-muted)" }}>Rank</span>
        <span>{char.ranks?.name ?? "--"}</span>
        <span style={{ color: "var(--color-muted)" }}>Role</span>
        <span>{char.roles?.name ?? "--"}</span>
        <span style={{ color: "var(--color-muted)" }}>Status</span>
        <span>{getRuntimeStatus(char)}</span>
        <span style={{ color: "var(--color-muted)" }}>Tasks</span>
        <span>{rt.current_task_count ?? 0}</span>
        <span style={{ color: "var(--color-muted)" }}>Workload</span>
        <span style={{ color: wc }}>{workload}%</span>
        <span style={{ color: "var(--color-muted)" }}>Fatigue</span>
        <span style={{ color: fc }}>{fatigue}%</span>
        <span style={{ color: "var(--color-muted)" }}>Burnout</span>
        <span style={{ color: rt.burnout_triggered ? "var(--color-toxic-red)" : "inherit" }}>
          {rt.burnout_triggered ? "BURNOUT" : "Normal"}
        </span>
      </div>
    </div>
  );
}

// ── Phaser Scene ──────────────────────────────────────────────────────────────

const CANVAS_W = 1536;
const CANVAS_H = 1024;
const LABEL_OFFSET = -12;   // px gap between sprite top and name label

type PhaserType = typeof import("phaser");

function createOfficeScene(Phaser: PhaserType, dataRef: React.MutableRefObject<SceneData>) {
  return class OfficeScene extends Phaser.Scene {
    private bg!: Phaser.GameObjects.Image;
    private charSprites: Map<string, {
      container: Phaser.GameObjects.Container;
      sprite: Phaser.GameObjects.Image;
      label: Phaser.GameObjects.Text;
      statusDot: Phaser.GameObjects.Arc;
      isMoving: boolean;
      bubbleContainer: Phaser.GameObjects.Container | null;
    }> = new Map();
    private loadedFloorId = "";
    private loadedCharKeys: Set<string> = new Set();

    constructor() {
      super({ key: "OfficeScene" });
    }

    preload() {
      const { floorDir, characters } = dataRef.current;

      // Floor background
      const bgUrl = `/floors/${floorDir}/background/topdown.png`;
      this.load.image(`bg_${floorDir}`, bgUrl);

      // Character sprites
      for (const char of characters) {
        const key = `char_${char.codeName}_${char.status}`;
        if (!this.textures.exists(key)) {
          const url = getSpriteUrl(char.codeName, char.status);
          this.load.image(key, url);
        }
      }
    }

    create() {
      const { floorDir, characters, onCharClick } = dataRef.current;

      // Background
      const bgKey = `bg_${floorDir}`;
      if (this.textures.exists(bgKey)) {
        this.bg = this.add.image(0, 0, bgKey)
          .setOrigin(0, 0)
          .setDisplaySize(CANVAS_W, CANVAS_H)
          .setDepth(0);
      } else {
        // Fallback solid color floor
        this.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x1a2030, 1)
          .setOrigin(0, 0)
          .setDepth(0);
        // Simple grid
        const g = this.add.graphics().setDepth(1);
        g.lineStyle(1, 0x2a3040, 0.4);
        for (let x = 0; x <= CANVAS_W; x += 64) g.moveTo(x, 0).lineTo(x, CANVAS_H);
        for (let y = 0; y <= CANVAS_H; y += 64) g.moveTo(0, y).lineTo(CANVAS_W, y);
        g.strokePath();
      }

      this.loadedFloorId = floorDir;
      this.spawnCharacters(characters, onCharClick);
    }

    private spawnCharacters(
      chars: SceneCharData[],
      onCharClick: (id: string) => void,
    ) {
      const seats = getSeats(dataRef.current.floorId);

      // Remove old sprites
      for (const [, obj] of this.charSprites) obj.container.destroy();
      this.charSprites.clear();

      for (const char of chars) {
        const seat = seats[char.seatIndex];
        if (!seat) continue;

        const px = seat.x * CANVAS_W;
        const py = seat.y * CANVAS_H;
        const spriteKey = `char_${char.codeName}_${char.status}`;
        const texKey = this.textures.exists(spriteKey) ? spriteKey : "__DEFAULT";

        const sprite = this.add.image(0, 0, texKey);
        // Fixed 80px wide, proportional height; guard against 0/tiny missing textures
        const srcW = Math.max(sprite.width, 40);
        const srcH = Math.max(sprite.height, 60);
        const CHAR_W = 140;
        sprite.setDisplaySize(CHAR_W, CHAR_W * (srcH / srcW));
        sprite.setOrigin(0.5, 1.0); // anchor at feet

        const label = this.add.text(0, LABEL_OFFSET - sprite.displayHeight, char.name, {
          fontSize: "11px",
          color: char.burnout ? "#ff4444" : "#ffffff",
          stroke: "#000000",
          strokeThickness: 3,
          resolution: 2,
        }).setOrigin(0.5, 1);

        const dotColor = char.burnout ? 0xff4444
          : char.fatigue > 70 ? 0xff9900
          : char.workload > 70 ? 0xffcc00
          : 0x44dd88;
        const dot = this.add.circle(label.width / 2 + 6, LABEL_OFFSET - sprite.displayHeight - 4, 4, dotColor);

        const container = this.add.container(px, py, [sprite, label, dot]);
        container.setDepth(py); // Y-sort

        // Click handler
        const hitArea = new Phaser.Geom.Rectangle(
          -32, -(sprite.displayHeight + 20),
          64, sprite.displayHeight + 30,
        );
        container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
        container.on("pointerdown", () => dataRef.current.onCharClick(char.id));
        container.on("pointerover", () => {
          sprite.setTint(0xddddff);
          this.game.canvas.style.cursor = "pointer";
        });
        container.on("pointerout", () => {
          sprite.clearTint();
          this.game.canvas.style.cursor = "default";
        });

        this.charSprites.set(char.id, { container, sprite, label, statusDot: dot, isMoving: false, bubbleContainer: null });
        this.loadedCharKeys.add(spriteKey);
      }
    }

    private showBubble(charId: string, bubble: BubbleData) {
      const obj = this.charSprites.get(charId);
      if (!obj) return;

      // Remove existing bubble
      if (obj.bubbleContainer) {
        obj.bubbleContainer.destroy();
        obj.bubbleContainer = null;
      }

      const isThought = bubble.bubbleType === "thought";
      const displayText = (bubble.emoji ? bubble.emoji + " " : "") + bubble.text;

      // Create text first to measure
      const textObj = this.add.text(0, 0, displayText, {
        fontSize: "10px",
        color: isThought ? "#c0c0e0" : "#ffffff",
        fontStyle: isThought ? "italic" : "normal",
        wordWrap: { width: 140 },
        resolution: 2,
      }).setOrigin(0.5, 0.5);

      const padX = 8;
      const padY = 5;
      const bw = textObj.width + padX * 2;
      const bh = textObj.height + padY * 2;

      // Background
      const bg = this.add.graphics();
      if (isThought) {
        // Cloud-like shape for thoughts
        bg.fillStyle(0x2a2a4a, 0.85);
        bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 12);
        // Small circles for thought tail
        bg.fillCircle(-bw / 4, bh / 2 + 4, 3);
        bg.fillCircle(-bw / 4 + 6, bh / 2 + 10, 2);
      } else {
        // Sharp rectangle for speech
        bg.fillStyle(0x1a3a5a, 0.9);
        bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 6);
        // Speech tail (triangle)
        bg.fillTriangle(-4, bh / 2, 4, bh / 2, 0, bh / 2 + 6);
      }

      // Border
      bg.lineStyle(1, isThought ? 0x6060a0 : 0x4488cc, 0.7);
      bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, isThought ? 12 : 6);

      const spriteH = obj.sprite.displayHeight;
      const bubbleY = -(spriteH + 20 + bh / 2);

      const bubbleContainer = this.add.container(0, bubbleY, [bg, textObj]);
      obj.container.add(bubbleContainer);
      obj.bubbleContainer = bubbleContainer;

      // Animate in
      bubbleContainer.setAlpha(0);
      bubbleContainer.setScale(0.5);
      this.tweens.add({
        targets: bubbleContainer,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 200,
        ease: "Back.easeOut",
      });

      // Auto-remove after duration
      this.time.delayedCall(bubble.duration, () => {
        if (!obj.bubbleContainer) return;
        this.tweens.add({
          targets: obj.bubbleContainer,
          alpha: 0,
          scaleX: 0.8,
          scaleY: 0.8,
          duration: 300,
          ease: "Power2",
          onComplete: () => {
            obj.bubbleContainer?.destroy();
            obj.bubbleContainer = null;
          },
        });
      });
    }

    private tweenCharTo(
      charId: string,
      targetX: number,
      targetY: number,
      onComplete?: () => void,
    ) {
      const obj = this.charSprites.get(charId);
      if (!obj) return;

      // Already at target
      const dx = Math.abs(obj.container.x - targetX);
      const dy = Math.abs(obj.container.y - targetY);
      if (dx < 2 && dy < 2) {
        onComplete?.();
        return;
      }

      // Switch to stand pose during movement
      obj.isMoving = true;
      const slug = (dataRef.current.characters.find((c) => c.id === charId)?.codeName ?? "").toLowerCase().replace(/_/g, "-");
      const standKey = `char_${slug}_Idle`;
      if (this.textures.exists(standKey)) {
        obj.sprite.setTexture(standKey);
      }

      // Duration proportional to distance (min 400ms, max 1500ms)
      const dist = Math.sqrt(dx * dx + dy * dy);
      const duration = Math.min(1500, Math.max(400, dist * 1.5));

      this.tweens.add({
        targets: obj.container,
        x: targetX,
        y: targetY,
        duration,
        ease: "Power2",
        onUpdate: () => {
          // Y-sort depth during movement
          obj.container.setDepth(obj.container.y);
        },
        onComplete: () => {
          obj.isMoving = false;
          onComplete?.();
        },
      });
    }

    private fadeOutChar(charId: string, onComplete?: () => void) {
      const obj = this.charSprites.get(charId);
      if (!obj) return;

      this.tweens.add({
        targets: obj.container,
        alpha: 0,
        duration: 400,
        ease: "Power1",
        onComplete: () => {
          onComplete?.();
        },
      });
    }

    private fadeInChar(charId: string, x: number, y: number) {
      const obj = this.charSprites.get(charId);
      if (!obj) return;

      obj.container.setPosition(x, y);
      obj.container.setAlpha(0);
      this.tweens.add({
        targets: obj.container,
        alpha: 1,
        duration: 400,
        ease: "Power1",
      });
    }

    update() {
      const { floorDir, characters, moveTargets } = dataRef.current;

      // Reload scene if floor changed or characters added/removed (API load)
      if (floorDir !== this.loadedFloorId || characters.length !== this.charSprites.size) {
        this.scene.restart();
        return;
      }

      const seats = getSeats(dataRef.current.floorId);

      for (const char of characters) {
        const obj = this.charSprites.get(char.id);
        if (!obj) continue;

        const seat = seats[char.seatIndex];
        if (!seat) continue;

        // Handle pending move targets
        const moveTarget = moveTargets.get(char.id);
        if (moveTarget && !obj.isMoving) {
          if (moveTarget.targetFloor && moveTarget.targetFloor !== dataRef.current.floorDir) {
            // Cross-floor: tween to elevator → fade out → remove from this floor's view
            const elevX = ELEVATOR_ZONE.x * CANVAS_W;
            const elevY = ELEVATOR_ZONE.y * CANVAS_H;
            this.tweenCharTo(char.id, elevX, elevY, () => {
              this.fadeOutChar(char.id);
            });
          } else {
            // Same floor: tween directly to new seat
            this.tweenCharTo(char.id, moveTarget.targetX, moveTarget.targetY);
          }
          moveTargets.delete(char.id);
        }

        // If not moving, smoothly correct position drift (seat reassignment)
        if (!obj.isMoving) {
          const targetPx = seat.x * CANVAS_W;
          const targetPy = seat.y * CANVAS_H;
          const dx = Math.abs(obj.container.x - targetPx);
          const dy = Math.abs(obj.container.y - targetPy);
          if (dx > 5 || dy > 5) {
            this.tweenCharTo(char.id, targetPx, targetPy);
          }
        }

        // Update depth for Y-sorting (only when not mid-tween)
        if (!obj.isMoving) {
          obj.container.setDepth(obj.container.y);
        }

        // Update texture if status changed (and not moving)
        const expectedTex = `char_${char.codeName}_${char.status}`;
        if (!obj.isMoving && obj.sprite.texture.key !== expectedTex) {
          if (this.textures.exists(expectedTex)) {
            obj.sprite.setTexture(expectedTex);
          } else {
            // Load and apply dynamically
            this.load.image(expectedTex, getSpriteUrl(char.codeName, char.status));
            this.load.once(`filecomplete-image-${expectedTex}`, () => {
              if (this.charSprites.has(char.id) && !this.charSprites.get(char.id)!.isMoving) {
                this.charSprites.get(char.id)!.sprite.setTexture(expectedTex);
              }
            });
            this.load.start();
          }
        }

        // Update status dot color
        const dotColor = char.burnout ? 0xff4444
          : char.fatigue > 70 ? 0xff9900
          : char.workload > 70 ? 0xffcc00
          : 0x44dd88;
        obj.statusDot.setFillStyle(dotColor);

        // Update label color for burnout
        if (char.burnout) obj.label.setColor("#ff4444");
        else obj.label.setColor("#ffffff");
      }

      // Process pending bubbles
      const { pendingBubbles } = dataRef.current;
      while (pendingBubbles.length > 0) {
        const bubble = pendingBubbles.shift()!;
        this.showBubble(bubble.characterId, bubble);
      }
    }
  };
}

// ── Main React component ──────────────────────────────────────────────────────

export default function IsometricWorldCanvas() {
  const { openPanel } = useContext(ContextPanelContext);
  const openPanelRef = useRef(openPanel);
  useEffect(() => { openPanelRef.current = openPanel; }, [openPanel]);

  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFloorId, setSelectedFloorId] = useState("engineering");
  const [runtimePatches, setRuntimePatches] = useState<Record<string, RuntimePatch>>({});
  const [streamConnected, setStreamConnected] = useState(false);
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<import("phaser").Game | null>(null);
  const sceneDataRef = useRef<SceneData>({
    floorId: "engineering",
    floorDir: "3f-engineering",
    characters: [],
    moveTargets: new Map(),
    pendingBubbles: [],
    onCharClick: () => {},
  });

  // Stable ref for move targets (persists across renders)
  const moveTargetsRef = useRef<Map<string, MoveTarget>>(new Map());
  // Stable ref for pending bubbles
  const pendingBubblesRef = useRef<BubbleData[]>([]);

  useEffect(() => {
    apiGet<{ data?: { items?: Character[] } }>("/characters?pageSize=100")
      .then((body) => { setCharacters(body.data?.items ?? []); setLoading(false); })
      .catch(() => { setCharacters([]); setLoading(false); });
  }, []);

  useWorldStream(useCallback((event) => {
    if (event.type === "connected") { setStreamConnected(true); return; }
    const extracted = extractRuntimePatch(event);
    if (extracted) {
      setRuntimePatches((prev) => ({
        ...prev,
        [extracted.characterId]: { ...(prev[extracted.characterId] ?? {}), ...extracted.patch },
      }));
    }
    // Handle character movement events from tick engine
    if (event.type === "character_moved") {
      const { characterId, toSeatIndex, toFloor } = event.payload as {
        characterId?: string;
        toSeatIndex?: number;
        toFloor?: string;
      };
      if (characterId && typeof toSeatIndex === "number") {
        const seats = getSeats(sceneDataRef.current.floorId);
        const seat = seats[toSeatIndex];
        if (seat) {
          moveTargetsRef.current.set(characterId, {
            targetX: seat.x * CANVAS_W,
            targetY: seat.y * CANVAS_H,
            targetFloor: toFloor,
            isMoving: false,
          });
        }
      }
    }
    // Handle character bubble events
    if (event.type === "character_bubble") {
      const { characterId, bubbleType, text, emoji, duration } = event.payload as {
        characterId?: string;
        bubbleType?: string;
        text?: string;
        emoji?: string;
        duration?: number;
      };
      if (characterId && text) {
        pendingBubblesRef.current.push({
          characterId,
          bubbleType: (bubbleType as BubbleData["bubbleType"]) ?? "speech",
          text,
          emoji,
          duration: duration ?? 8000,
        });
      }
    }
  }, []));

  const selectedFloor = useMemo(
    () => FLOORS.find((f) => f.id === selectedFloorId) ?? FLOORS[0]!,
    [selectedFloorId],
  );

  const patchedCharacters = useMemo(() => {
    if (Object.keys(runtimePatches).length === 0) return characters;
    return characters.map((char) => {
      const patch = runtimePatches[char.id];
      if (!patch) return char;
      const existing = Array.isArray(char.character_runtime_states)
        ? (char.character_runtime_states[0] ?? {})
        : (char.character_runtime_states ?? {});
      return { ...char, character_runtime_states: [{ ...existing, ...patch }] };
    });
  }, [characters, runtimePatches]);

  const floorCharacters = useMemo(() => {
    if (selectedFloor.divisionCodes.length === 0) return patchedCharacters.slice(0, 8);
    const codes = new Set(selectedFloor.divisionCodes.map((c) => c.toLowerCase()));
    return patchedCharacters.filter((char) =>
      codes.has((char.divisions?.code ?? char.division_id ?? "").toLowerCase())
    );
  }, [patchedCharacters, selectedFloor]);

  const floorCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const char of patchedCharacters) {
      const id = getCharFloorId(char);
      map[id] = (map[id] ?? 0) + 1;
    }
    return map;
  }, [patchedCharacters]);

  const floorBurnout = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const char of patchedCharacters) {
      if (getRuntime(char).burnout_triggered) map[getCharFloorId(char)] = true;
    }
    return map;
  }, [patchedCharacters]);

  // Build scene char data
  const sceneChars = useMemo<SceneCharData[]>(() =>
    floorCharacters.map((char, i) => {
      const rt = getRuntime(char);
      return {
        id: char.id,
        name: char.name,
        codeName: char.code_name,
        status: getRuntimeStatus(char),
        fatigue: rt.fatigue_score ?? 0,
        workload: rt.workload_score ?? 0,
        burnout: rt.burnout_triggered ?? false,
        seatIndex: i,
      };
    }),
  [floorCharacters]);

  // Update shared ref on every render
  const floorDir = FLOOR_DIR[selectedFloorId] ?? "3f-engineering";
  sceneDataRef.current = {
    floorId: selectedFloorId,
    floorDir,
    characters: sceneChars,
    moveTargets: moveTargetsRef.current,
    pendingBubbles: pendingBubblesRef.current,
    onCharClick: (charId: string) => {
      const char = patchedCharacters.find((c) => c.id === charId);
      if (char) {
        setSelectedChar(char);
        openPanelRef.current(char.name, <CharacterDetail char={char} />);
      }
    },
  };

  // Init Phaser once container is mounted
  useEffect(() => {
    if (!containerRef.current) return;
    if (typeof window === "undefined") return;

    let game: import("phaser").Game;

    import("phaser").then((Phaser) => {
      if (!containerRef.current) return;

      const OfficeScene = createOfficeScene(Phaser, sceneDataRef);

      game = new Phaser.Game({
        type: Phaser.AUTO,
        width: CANVAS_W,
        height: CANVAS_H,
        backgroundColor: "#1a1a2e",
        parent: containerRef.current,
        scene: [OfficeScene],
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        audio: { noAudio: true },
        banner: false,
      });

      gameRef.current = game;
    });

    return () => {
      game?.destroy(true);
      gameRef.current = null;
    };
  // Only create game once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", flexDirection: "column",
      background: "#0d0d18",
    }}>

      {/* Floor selector bar */}
      <div style={{
        display: "flex", gap: "0.25rem",
        padding: "0.5rem 0.75rem",
        background: "rgba(0,0,0,0.7)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        overflowX: "auto", flexShrink: 0, alignItems: "center",
      }}>
        <span style={{
          fontSize: "0.7rem", color: "rgba(255,255,255,0.3)",
          marginRight: "0.25rem", whiteSpace: "nowrap",
        }}>FLOOR</span>

        <span style={{
          display: "inline-flex", alignItems: "center", gap: "0.25rem",
          marginRight: "0.5rem", fontSize: "0.65rem",
          color: streamConnected ? "rgba(100,220,100,0.7)" : "rgba(255,150,50,0.7)",
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: streamConnected ? "#4caf50" : "#ff9800",
            boxShadow: streamConnected ? "0 0 4px #4caf50" : "none",
          }} />
          {streamConnected ? "LIVE" : "OFF"}
        </span>

        {FLOORS.map((floor) => {
          const count = floorCounts[floor.id] ?? 0;
          const isSelected = floor.id === selectedFloorId;
          const hasBurnout = floorBurnout[floor.id];
          return (
            <button
              key={floor.id}
              onClick={() => setSelectedFloorId(floor.id)}
              style={{
                padding: "0.28rem 0.65rem", borderRadius: "0.35rem",
                border: isSelected
                  ? "1px solid rgba(100,180,255,0.6)"
                  : "1px solid rgba(255,255,255,0.1)",
                background: isSelected
                  ? "rgba(100,180,255,0.15)"
                  : "rgba(255,255,255,0.04)",
                color: isSelected ? "#64b4ff"
                  : hasBurnout ? "#ff6644"
                  : "rgba(255,255,255,0.5)",
                fontSize: "0.72rem",
                fontWeight: isSelected ? 600 : 400,
                cursor: "pointer", whiteSpace: "nowrap",
                transition: "all 0.12s",
              }}
            >
              {floor.label}
              {count > 0 && (
                <span style={{
                  marginLeft: "0.3rem",
                  fontSize: "0.62rem",
                  color: hasBurnout ? "#ff6644" : "rgba(255,255,255,0.35)",
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Phaser canvas container */}
      <div
        ref={containerRef}
        style={{ flex: 1, position: "relative", overflow: "hidden" }}
      />

      {/* Loading overlay */}
      {loading && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(13,13,24,0.85)",
          color: "rgba(255,255,255,0.4)",
          fontSize: "0.85rem", pointerEvents: "none",
          zIndex: 10,
        }}>
          Loading characters...
        </div>
      )}
    </div>
  );
}
