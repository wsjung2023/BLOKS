import type { MutableRefObject } from "react";
import { astar } from "../../lib/astar";
import type { PixelPos } from "../../lib/astar";

// ── Public types ───────────────────────────────────────────────────────────────

export interface CharInfo {
  id: string;
  name: string;
  codeName: string;
  fatigue: number;
  workload: number;
  burnout: boolean;
  seatX: number;
  seatY: number;
  isFounder: boolean;
  taskState?: string | undefined;
  role?: string | undefined;
}

export interface WorldSceneAPI {
  setCharClickHandler(fn: (id: string) => void): void;
  changeFloor(floorDir: string): void;
  upsertCharacters(chars: CharInfo[]): void;
  showBubble(
    charId: string,
    type: "speech" | "thought",
    text: string,
    duration: number,
    emoji?: string,
    emotion?: string,
    isFounderMessage?: boolean,
  ): void;
  walkToPositions(moves: Array<{ charId: string; x: number; y: number }>): void;
  walkCharacterToCharacter(leaderId: string, memberId: string, text: string): void;
  setCameraZoom(zoom: number): void;
  triggerFlash(r: number, g: number, b: number): void;
  triggerShake(): void;
  triggerParticleBurst(charId: string): void;
  setCharacterGlow(charId: string, active: boolean): void;
  focusCameraOnChar(charId: string): void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CANVAS_W = 1536;
const CANVAS_H = 1024;
const CHAR_MAX_H = 110;
const LABEL_OFFSET = -12;
const TILE_PX = 32;
const MAP_COLS = 48;
const MAP_ROWS = 32;
const CHAR_SPEED     = 160;  // px per second walking speed
const SEP_RADIUS     = 58;   // px — separation influence radius
const SEP_STRENGTH   = 140;  // px/s — push force at full overlap
const ARRIVE_THRESH  = 5;    // px — "close enough" to waypoint

// Tile types that block movement
const BLOCKED_TILES = new Set(["void", "wall", "wall-glass"]);

// Object types that block movement (characters walk around these)
// walkable: chair, meeting-chair, lamp, door, elevator, poster-board
const SOLID_OBJECTS = new Set([
  "desk", "executive-desk", "meeting-table", "table", "coffee-table",
  "cabinet", "server-rack", "sofa", "plant",
  "partition", "counter",
]);

// DeskRPG LPC spritesheet: 576×256, 9 cols × 4 rows, each frame 64×64
// Row 0=up, row 1=left, row 2=down, row 3=right, 9 frames each
const LPC_FRAME_W = 64;
const LPC_FRAME_H = 64;
const LPC_COLS = 9;
const LPC_UP_START    = 0 * LPC_COLS; // 0
const LPC_LEFT_START  = 1 * LPC_COLS; // 9
const LPC_DOWN_START  = 2 * LPC_COLS; // 18
const LPC_RIGHT_START = 3 * LPC_COLS; // 27
const LPC_WALK_FRAMES = 9;

const MULTI_POSE_SLUGS = new Set(["founder-01"]);
const ANIM_POSES = [
  "work-stand", "sitting", "walk-left", "walk-right",
  "stand-front", "stand-back", "thinking", "talking",
] as const;

// ── Factory ───────────────────────────────────────────────────────────────────

type PhaserType = typeof import("phaser");

type BubbleEmotion = "neutral" | "angry" | "sleepy" | "excited" | "question" | "idea" | "stressed";

const EMOTION_STYLE: Record<BubbleEmotion, {
  prefix: string; bg: number; border: number; textColor: string;
}> = {
  neutral:  { prefix: "",    bg: 0x1a3a5a, border: 0x4488cc, textColor: "#ffffff" },
  angry:    { prefix: "💢 ", bg: 0x3a1010, border: 0xcc3333, textColor: "#ffaaaa" },
  sleepy:   { prefix: "😴 ", bg: 0x1e1e2a, border: 0x6666aa, textColor: "#aaaacc" },
  excited:  { prefix: "✨ ", bg: 0x2a2a00, border: 0xccaa00, textColor: "#ffffaa" },
  question: { prefix: "❓ ", bg: 0x001a3a, border: 0x0088cc, textColor: "#aaddff" },
  idea:     { prefix: "💡 ", bg: 0x2a2000, border: 0xddaa00, textColor: "#fff0aa" },
  stressed: { prefix: "😰 ", bg: 0x2a1500, border: 0xcc6600, textColor: "#ffccaa" },
};

export function createWorldScene(
  Phaser: PhaserType,
  sceneReadyRef: MutableRefObject<WorldSceneAPI | null>,
) {
  type PhGameObj = Phaser.GameObjects.GameObject;
  type PhContainer = Phaser.GameObjects.Container;
  type PhImage = Phaser.GameObjects.Image;
  type PhSprite = Phaser.GameObjects.Sprite;
  type PhText = Phaser.GameObjects.Text;
  type PhArc = Phaser.GameObjects.Arc;

  type CharSpriteObj = {
    id: string;
    codeName: string;
    container: PhContainer;
    sprite: PhSprite | PhImage;
    label: PhText;
    dot: PhArc;
    crown: PhText | null;
    badge: PhText | null;
    bubbleContainer: PhContainer | null;
    bubbleOverrideActive: boolean;
    isMoving: boolean;
    isLpc: boolean;
    homeX: number;
    homeY: number;
    // update-loop movement
    pathQueue: PixelPos[];
    onArrival: (() => void) | null;
    lastDir: "up" | "down" | "left" | "right";
  };

  type PendingBubble = {
    charId: string;
    type: "speech" | "thought";
    text: string;
    duration: number;
    emoji: string | undefined;
    emotion: BubbleEmotion | undefined;
    isFounderMessage: boolean | undefined;
  };

  class WorldSceneImpl extends Phaser.Scene implements WorldSceneAPI {
    private bg!: PhImage;
    private dayNightOverlay!: Phaser.GameObjects.Rectangle;
    private chars = new Map<string, CharSpriteObj>();
    private currentFloorDir = "";
    private onCharClick: (id: string) => void = () => {};
    private pendingBubbles: PendingBubble[] = [];
    // walkability grid: true = can walk, false = blocked
    private walkabilityGrid: boolean[][] = [];
    private glowGraphics = new Map<string, Phaser.GameObjects.Graphics>();

    constructor() {
      super({ key: "WorldScene" });
    }

    preload() { /* lazy loading only */ }

    create() {
      this.bg = this.add.image(0, 0, "__DEFAULT")
        .setOrigin(0, 0).setDisplaySize(CANVAS_W, CANVAS_H).setDepth(0);

      this.dayNightOverlay = this.add.rectangle(0, 0, CANVAS_W, CANVAS_H, 0x000000, 0)
        .setOrigin(0, 0).setDepth(CANVAS_H + 100);

      this.updateDayNight();
      this.time.addEvent({
        delay: 60_000, loop: true,
        callback: this.updateDayNight, callbackScope: this,
      });

      sceneReadyRef.current = this as unknown as WorldSceneAPI;
    }

    update(_time: number, delta: number) {
      while (this.pendingBubbles.length > 0) {
        this.execShowBubble(this.pendingBubbles.shift()!);
      }
      this.stepCharacters(delta);
    }

    private stepCharacters(delta: number) {
      const dt = delta / 1000; // convert ms → seconds

      for (const [, cs] of this.chars) {
        if (!cs.isMoving || cs.pathQueue.length === 0) continue;

        const next = cs.pathQueue[0]!;
        const dx = next.x - cs.container.x;
        const dy = next.y - cs.container.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Reached this waypoint — advance
        if (dist < ARRIVE_THRESH) {
          cs.pathQueue.shift();
          if (cs.pathQueue.length === 0) {
            cs.isMoving = false;
            this.playIdleAnim(cs);
            const cb = cs.onArrival;
            cs.onArrival = null;
            cb?.();
          }
          continue;
        }

        // Base velocity toward next waypoint
        let vx = (dx / dist) * CHAR_SPEED * dt;
        let vy = (dy / dist) * CHAR_SPEED * dt;

        // Separation force — push away from nearby characters
        for (const [, other] of this.chars) {
          if (other === cs) continue;
          const ox = cs.container.x - other.container.x;
          const oy = cs.container.y - other.container.y;
          const od = Math.sqrt(ox * ox + oy * oy);
          if (od > 0 && od < SEP_RADIUS) {
            const force = ((SEP_RADIUS - od) / SEP_RADIUS) * SEP_STRENGTH * dt;
            vx += (ox / od) * force;
            vy += (oy / od) * force;
          }
        }

        cs.container.x += vx;
        cs.container.y += vy;
        cs.container.setDepth(cs.container.y);

        // Update walk animation direction
        const adx = Math.abs(vx), ady = Math.abs(vy);
        const dir: "up" | "down" | "left" | "right" =
          adx >= ady ? (vx < 0 ? "left" : "right") : (vy < 0 ? "up" : "down");

        if (dir !== cs.lastDir) {
          cs.lastDir = dir;
          const slug = cs.codeName.toLowerCase().replace(/_/g, "-");
          if (cs.isLpc && cs.sprite instanceof Phaser.GameObjects.Sprite) {
            cs.sprite.play(`walk_${dir}_${slug}`, true);
          } else if (!cs.bubbleOverrideActive) {
            const walkKey = `char_${slug}_${dir === "left" ? "walk-left" : "walk-right"}`;
            if (this.textures.exists(walkKey)) (cs.sprite as PhImage).setTexture(walkKey);
          }
        }
      }

      // Idle separation — push arrived chars apart if still overlapping
      for (const [, cs] of this.chars) {
        if (cs.isMoving) continue;
        let vx = 0, vy = 0;
        for (const [, other] of this.chars) {
          if (other === cs) continue;
          const ox = cs.container.x - other.container.x;
          const oy = cs.container.y - other.container.y;
          const od = Math.sqrt(ox * ox + oy * oy);
          if (od > 0 && od < SEP_RADIUS) {
            const force = ((SEP_RADIUS - od) / SEP_RADIUS) * SEP_STRENGTH * 0.4 * dt;
            vx += (ox / od) * force;
            vy += (oy / od) * force;
          }
        }
        if (vx !== 0 || vy !== 0) {
          cs.container.x += vx;
          cs.container.y += vy;
          cs.container.setDepth(cs.container.y);
        }
      }
    }

    private playIdleAnim(cs: CharSpriteObj) {
      const slug = cs.codeName.toLowerCase().replace(/_/g, "-");
      if (cs.isLpc && cs.sprite instanceof Phaser.GameObjects.Sprite) {
        cs.sprite.play(`idle_${cs.lastDir}_${slug}`, true);
      } else if (!cs.bubbleOverrideActive) {
        const sitKey = `char_${slug}_sitting`;
        const standKey = `char_${slug}_stand-front`;
        if (this.textures.exists(sitKey)) (cs.sprite as PhImage).setTexture(sitKey);
        else if (this.textures.exists(standKey)) (cs.sprite as PhImage).setTexture(standKey);
      }
    }

    // ── PUBLIC API ─────────────────────────────────────────────────────────────

    setCharClickHandler(fn: (id: string) => void) {
      this.onCharClick = fn;
    }

    changeFloor(floorDir: string) {
      if (floorDir === this.currentFloorDir) return;
      this.currentFloorDir = floorDir;

      const bgKey = `bg_${floorDir}`;
      if (this.textures.exists(bgKey)) {
        this.bg.setTexture(bgKey).setDisplaySize(CANVAS_W, CANVAS_H);
      } else {
        const url = `/floors/${floorDir}/background/topdown.png`;
        this.load.once(`filecomplete-image-${bgKey}`, () => {
          this.bg.setTexture(bgKey).setDisplaySize(CANVAS_W, CANVAS_H);
        });
        this.load.image(bgKey, url);
        this.load.start();
      }

      this.loadWalkability(floorDir);
    }

    upsertCharacters(chars: CharInfo[]) {
      const incoming = new Set(chars.map((c) => c.id));

      // Remove stale sprites
      for (const [id, cs] of this.chars) {
        if (!incoming.has(id)) {
          cs.container.destroy();
          this.chars.delete(id);
        }
      }

      // Add new or refresh existing
      for (const char of chars) {
        if (this.chars.has(char.id)) {
          this.refreshChar(char);
        } else {
          this.spawnChar(char);
        }
      }
    }

    showBubble(
      charId: string,
      type: "speech" | "thought",
      text: string,
      duration: number,
      emoji?: string,
      emotion?: string,
      isFounderMessage?: boolean,
    ) {
      this.pendingBubbles.push({
        charId, type, text, duration, emoji,
        emotion: (emotion as BubbleEmotion | undefined) ?? "neutral",
        isFounderMessage,
      });
    }

    walkToPositions(moves: Array<{ charId: string; x: number; y: number }>) {
      for (const { charId, x, y } of moves) {
        this.tweenCharTo(charId, x, y);
      }
    }

    walkCharacterToCharacter(leaderId: string, memberId: string, text: string) {
      const lcs = this.chars.get(leaderId);
      const mcs = this.chars.get(memberId);
      if (!lcs || !mcs) return;

      const midX = (lcs.container.x + mcs.container.x) / 2;
      const midY = (lcs.container.y + mcs.container.y) / 2 - 10;

      this.tweenCharTo(leaderId, midX, midY, () => {
        this.time.delayedCall(7_000, () => {
          this.tweenCharTo(leaderId, lcs.homeX, lcs.homeY);
        });
      });

      this.showBubble(leaderId, "speech", text, 6_000, "📋", "neutral");
    }

    setCameraZoom(zoom: number) {
      this.cameras.main.setZoom(zoom);
    }

    triggerFlash(r: number, g: number, b: number) {
      this.cameras.main.flash(400, r, g, b);
    }

    triggerShake() {
      this.cameras.main.shake(300, 0.005);
    }

    triggerParticleBurst(charId: string) {
      const cs = this.chars.get(charId);
      if (!cs) return;

      const cx = cs.container.x;
      const cy = cs.container.y - cs.sprite.displayHeight / 2;
      const colors = [0xFFD700, 0xFFFFFF, 0xFF8C00, 0x88FFAA, 0xFF88FF];
      const count = 28;

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        const speed = 60 + Math.random() * 140;
        const size = 3 + Math.random() * 6;
        const color = colors[Math.floor(Math.random() * colors.length)]!;

        const p = this.add.arc(cx, cy, size, 0, 360, false, color, 1)
          .setDepth(cs.container.y + 200);

        this.tweens.add({
          targets: p,
          x: cx + Math.cos(angle) * speed,
          y: cy + Math.sin(angle) * speed - 50,
          alpha: 0,
          scaleX: 0.1,
          scaleY: 0.1,
          duration: 600 + Math.random() * 600,
          ease: "Power2",
          onComplete: () => p.destroy(),
        });
      }
    }

    setCharacterGlow(charId: string, active: boolean) {
      const cs = this.chars.get(charId);
      if (!cs) return;

      const existing = this.glowGraphics.get(charId);
      if (existing) {
        this.tweens.killTweensOf(existing);
        existing.destroy();
        this.glowGraphics.delete(charId);
      }
      if (!active) return;

      const spriteH = cs.sprite.displayHeight;
      const glow = this.add.graphics();
      glow.lineStyle(4, 0xFFD700, 0.75);
      glow.strokeEllipse(0, -spriteH / 2, 58, spriteH + 10);
      glow.lineStyle(2, 0xFFFF88, 0.35);
      glow.strokeEllipse(0, -spriteH / 2, 70, spriteH + 22);
      cs.container.addAt(glow, 0);
      this.glowGraphics.set(charId, glow);

      this.tweens.add({
        targets: glow,
        alpha: 0.2,
        duration: 750,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    }

    focusCameraOnChar(charId: string) {
      const cs = this.chars.get(charId);
      if (!cs) return;
      this.cameras.main.pan(cs.container.x, cs.container.y - 60, 800, "Power2");
    }

    // ── PRIVATE ────────────────────────────────────────────────────────────────

    private loadWalkability(floorDir: string) {
      // Default: all walkable
      const makeDefault = () =>
        Array.from({ length: MAP_ROWS }, () => Array<boolean>(MAP_COLS).fill(true));

      fetch(`/floors/${floorDir}/layout.json`)
        .then((r) => r.json())
        .then((data: {
          tilemap?: string[][];
          objects?: Array<{ type: string; x: number; y: number }>;
        }) => {
          const grid = makeDefault();

          // 1. Block non-walkable tiles
          if (data.tilemap) {
            for (let row = 0; row < Math.min(data.tilemap.length, MAP_ROWS); row++) {
              const tileRow = data.tilemap[row]!;
              for (let col = 0; col < Math.min(tileRow.length, MAP_COLS); col++) {
                if (BLOCKED_TILES.has(tileRow[col]!)) {
                  grid[row]![col] = false;
                }
              }
            }
          }

          // 2. Block solid object footprints
          if (data.objects) {
            for (const obj of data.objects) {
              if (!SOLID_OBJECTS.has(obj.type)) continue;
              // obj.x / obj.y are normalized (0–1), convert to pixel then tile
              const px = obj.x * CANVAS_W;
              const py = obj.y * CANVAS_H;
              const col = Math.floor(px / TILE_PX);
              const row = Math.floor(py / TILE_PX);
              // Block a 2×2 tile footprint for large objects, 1×1 for smaller ones
              const large = ["desk", "sofa", "server-rack", "bookshelf", "whiteboard"];
              const span = large.includes(obj.type) ? 2 : 1;
              for (let dr = 0; dr < span; dr++) {
                for (let dc = 0; dc < span; dc++) {
                  const r = row + dr, c = col + dc;
                  if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) {
                    grid[r]![c] = false;
                  }
                }
              }
            }
          }

          this.walkabilityGrid = grid;
        })
        .catch(() => {
          // No layout.json — treat entire floor as walkable
          this.walkabilityGrid = [];
        });
    }

    private updateDayNight() {
      const h = new Date().getHours();
      let color = 0x000000, alpha = 0;
      if (h >= 6 && h < 9)        { color = 0x6478c8; alpha = 0.15; }
      else if (h >= 18 && h < 21) { color = 0xff9632; alpha = 0.12; }
      else if (h >= 21 || h < 6)  { color = 0x000028; alpha = 0.35; }
      this.dayNightOverlay?.setFillStyle(color, alpha);
    }

    private spawnChar(char: CharInfo) {
      const slug = char.codeName.toLowerCase().replace(/_/g, "-");
      const lpcKey = `lpc_${slug}`;
      const isLpc = this.textures.exists(lpcKey);

      let sprite: PhSprite | PhImage;
      if (isLpc) {
        sprite = this.add.sprite(0, 0, lpcKey, LPC_DOWN_START).setOrigin(0.5, 1.0);
        this.ensureLpcAnims(slug, lpcKey);
        (sprite as PhSprite).play(`idle_down_${slug}`, true);
      } else {
        const texKey = this.getOrLoadStaticTexture(slug, char.id);
        sprite = this.add.image(0, 0, texKey).setOrigin(0.5, 1.0);
      }

      sprite.setScale(CHAR_MAX_H / Math.max(sprite.height, 1));

      const label = this.add.text(
        0, LABEL_OFFSET - sprite.displayHeight, char.name,
        {
          fontSize: "22px",
          color: char.isFounder ? "#FFD700" : "#ffffff",
          stroke: char.isFounder ? "#7a5c00" : "#000000",
          strokeThickness: 4,
          resolution: 2,
        },
      ).setOrigin(0.5, 1);

      const dotColor = char.burnout ? 0xff4444
        : char.fatigue > 70 ? 0xff9900
        : char.workload > 70 ? 0xffcc00
        : 0x44dd88;
      const dot = this.add.circle(
        label.width / 2 + 8, LABEL_OFFSET - sprite.displayHeight - 6, 6, dotColor,
      );

      let crown: PhText | null = null;
      if (char.isFounder) {
        crown = this.add.text(
          0, LABEL_OFFSET - sprite.displayHeight - 28, "👑",
          { fontSize: "24px", resolution: 2 },
        ).setOrigin(0.5, 1);
      }

      const taskBadgeEmoji: Record<string, string> = { InProgress: "⚙️", InReview: "🔍", Blocked: "🔒" };
      const badgeEmoji = char.taskState ? taskBadgeEmoji[char.taskState] : undefined;
      const badge = badgeEmoji
        ? this.add.text(-label.width / 2 - 20, LABEL_OFFSET - sprite.displayHeight - 6, badgeEmoji, { fontSize: "16px", resolution: 2 }).setOrigin(0.5, 1)
        : null;

      const roleLabel = char.role
        ? this.add.text(0, LABEL_OFFSET - sprite.displayHeight + 20, char.role, {
            fontSize: "16px", color: "#aaaacc",
            stroke: "#000000", strokeThickness: 3, resolution: 2,
          }).setOrigin(0.5, 1)
        : null;

      const items: PhGameObj[] = [sprite, label, dot];
      if (crown) items.push(crown);
      if (badge) items.push(badge);
      if (roleLabel) items.push(roleLabel);

      const container = this.add.container(char.seatX, char.seatY, items);
      container.setDepth(char.seatY);

      const hitArea = new Phaser.Geom.Rectangle(
        -32, -(sprite.displayHeight + 20), 64, sprite.displayHeight + 30,
      );
      container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
      container.on("pointerdown", () => this.onCharClick(char.id));
      container.on("pointerover", () => {
        sprite.setTint(0xddddff);
        this.game.canvas.style.cursor = "pointer";
      });
      container.on("pointerout", () => {
        sprite.clearTint();
        this.game.canvas.style.cursor = "default";
      });

      this.chars.set(char.id, {
        id: char.id, codeName: char.codeName,
        container, sprite, label, dot, crown, badge,
        bubbleContainer: null, bubbleOverrideActive: false,
        isMoving: false, isLpc,
        homeX: char.seatX, homeY: char.seatY,
        pathQueue: [], onArrival: null, lastDir: "down",
      });

      // Idle bob for static sprites
      if (!isLpc) {
        this.tweens.add({
          targets: sprite, y: -2,
          duration: 2000 + Math.random() * 1000,
          ease: "Sine.easeInOut", yoyo: true, repeat: -1,
          delay: Math.random() * 2000,
        });
        this.tryLoadLpc(slug, char.id);
      }
    }

    private refreshChar(char: CharInfo) {
      const cs = this.chars.get(char.id);
      if (!cs) return;
      cs.homeX = char.seatX;
      cs.homeY = char.seatY;

      cs.dot.setFillStyle(
        char.burnout ? 0xff4444
          : char.fatigue > 70 ? 0xff9900
          : char.workload > 70 ? 0xffcc00
          : 0x44dd88,
      );
      cs.label.setColor(
        char.burnout ? "#ff4444" : char.isFounder ? "#FFD700" : "#ffffff",
      );

      // Task state badge
      const taskBadgeEmoji: Record<string, string> = { InProgress: "⚙️", InReview: "🔍", Blocked: "🔒" };
      const badgeEmoji = char.taskState ? taskBadgeEmoji[char.taskState] : undefined;
      if (cs.badge) {
        cs.badge.setText(badgeEmoji ?? "");
        cs.badge.setVisible(!!badgeEmoji);
      } else if (badgeEmoji) {
        const spriteH = cs.sprite.displayHeight;
        const b = this.add.text(-cs.label.width / 2 - 20, LABEL_OFFSET - spriteH - 6, badgeEmoji, { fontSize: "16px", resolution: 2 }).setOrigin(0.5, 1);
        cs.container.add(b);
        cs.badge = b;
      }

      // Drift correction
      if (!cs.isMoving) {
        const dx = Math.abs(cs.container.x - char.seatX);
        const dy = Math.abs(cs.container.y - char.seatY);
        if (dx > 5 || dy > 5) {
          this.tweenCharTo(char.id, char.seatX, char.seatY);
        }
      }
    }

    private getOrLoadStaticTexture(slug: string, charId: string): string {
      const isMulti = MULTI_POSE_SLUGS.has(slug);
      const mainKey = isMulti ? `char_${slug}_stand-front` : `char_${slug}`;

      if (this.textures.exists(mainKey)) return mainKey;

      if (isMulti) {
        // Load all animation poses
        const folder = slug.replace("-", "") + "_moving";
        for (const pose of ANIM_POSES) {
          const key = `char_${slug}_${pose}`;
          if (this.textures.exists(key)) continue;
          const url = pose === "work-stand"
            ? `/sprites-v2/char-${slug}-work-stand.png`
            : `/sprites-v2/${folder}/${pose}.png`;
          if (pose === "stand-front") {
            this.load.once(`filecomplete-image-${key}`, () => {
              const cs = this.chars.get(charId);
              if (cs && !cs.isLpc) {
                (cs.sprite as PhImage).setTexture(key);
                cs.sprite.setScale(CHAR_MAX_H / Math.max(cs.sprite.height, 1));
              }
            });
          }
          this.load.image(key, url);
        }
        this.load.start();
      } else {
        const key = mainKey;
        const url = `/sprites-v2/char-${slug}-work-stand.png`;
        this.load.once(`filecomplete-image-${key}`, () => {
          const cs = this.chars.get(charId);
          if (cs && !cs.isLpc) {
            (cs.sprite as PhImage).setTexture(key);
            cs.sprite.setScale(CHAR_MAX_H / Math.max(cs.sprite.height, 1));
          }
        });
        this.load.image(key, url);
        this.load.start();
      }

      return this.ensurePlaceholder(charId);
    }

    private ensurePlaceholder(codeName: string): string {
      const key = `ph_${codeName}`;
      if (this.textures.exists(key)) return key;

      const hash = codeName.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0);
      const hue = Math.abs(hash) % 360;
      const hf = hue / 60;
      const xv = 1 - Math.abs((hf % 2) - 1);
      const [ri = 1, gi = 0, bi = 0] = hf < 1 ? [1, xv, 0]
        : hf < 2 ? [xv, 1, 0]
        : hf < 3 ? [0, 1, xv]
        : hf < 4 ? [0, xv, 1]
        : hf < 5 ? [xv, 0, 1]
        : [1, 0, xv];
      const color = (Math.round(ri * 180) << 16) | (Math.round(gi * 180) << 8) | Math.round(bi * 180);

      const pg = this.make.graphics({ x: 0, y: 0 });
      pg.fillStyle(color, 1);
      pg.fillCircle(24, 13, 11);
      pg.fillRoundedRect(10, 24, 28, 34, 3);
      pg.generateTexture(key, 48, 60);
      pg.destroy();
      return key;
    }

    private tryLoadLpc(slug: string, charId: string) {
      const lpcKey = `lpc_${slug}`;
      if (this.textures.exists(lpcKey)) return;

      const url = `/assets/characters/${slug}.png`;
      this.load.once(`filecomplete-spritesheet-${lpcKey}`, () => {
        const cs = this.chars.get(charId);
        if (!cs) return;
        this.ensureLpcAnims(slug, lpcKey);

        const newSprite = this.add.sprite(0, 0, lpcKey, LPC_DOWN_START).setOrigin(0.5, 1.0);
        newSprite.setScale(CHAR_MAX_H / Math.max(LPC_FRAME_H, 1));
        newSprite.play(`idle_down_${slug}`, true);

        cs.container.remove(cs.sprite, true);
        cs.container.addAt(newSprite, 0);
        cs.sprite = newSprite;
        cs.isLpc = true;
      });

      this.load.spritesheet(lpcKey, url, { frameWidth: LPC_FRAME_W, frameHeight: LPC_FRAME_H });
      this.load.start();
    }

    private ensureLpcAnims(slug: string, lpcKey: string) {
      const mk = (key: string, start: number, count: number, fr: number) => {
        if (!this.anims.exists(key)) {
          this.anims.create({
            key,
            frames: this.anims.generateFrameNumbers(lpcKey, { start, end: start + count - 1 }),
            frameRate: fr,
            repeat: -1,
          });
        }
      };
      mk(`walk_up_${slug}`,    LPC_UP_START,    LPC_WALK_FRAMES, 8);
      mk(`walk_left_${slug}`,  LPC_LEFT_START,  LPC_WALK_FRAMES, 8);
      mk(`walk_down_${slug}`,  LPC_DOWN_START,  LPC_WALK_FRAMES, 8);
      mk(`walk_right_${slug}`, LPC_RIGHT_START, LPC_WALK_FRAMES, 8);
      mk(`idle_down_${slug}`,  LPC_DOWN_START,  1, 1);
      mk(`idle_up_${slug}`,    LPC_UP_START,    1, 1);
      mk(`idle_left_${slug}`,  LPC_LEFT_START,  1, 1);
      mk(`idle_right_${slug}`, LPC_RIGHT_START, 1, 1);
    }

    private tweenCharTo(
      charId: string,
      targetX: number,
      targetY: number,
      onComplete?: () => void,
    ) {
      const cs = this.chars.get(charId);
      if (!cs) { onComplete?.(); return; }

      const dx = Math.abs(cs.container.x - targetX);
      const dy = Math.abs(cs.container.y - targetY);
      if (dx < ARRIVE_THRESH && dy < ARRIVE_THRESH) { onComplete?.(); return; }

      // Build A* path
      let path: PixelPos[];
      if (this.walkabilityGrid.length > 0) {
        const fromCol = Math.floor(cs.container.x / TILE_PX);
        const fromRow = Math.floor(cs.container.y / TILE_PX);
        const toCol   = Math.floor(targetX / TILE_PX);
        const toRow   = Math.floor(targetY / TILE_PX);
        path = astar(
          { col: fromCol, row: fromRow },
          { col: toCol,   row: toRow   },
          this.walkabilityGrid,
          TILE_PX,
        );
        if (path.length === 0) path = [{ x: targetX, y: targetY }];
      } else {
        path = [{ x: targetX, y: targetY }];
      }

      // Hand off to update-loop movement
      cs.pathQueue = path;
      cs.onArrival = onComplete ?? null;
      cs.isMoving = true;

      // Play initial walk animation
      const slug = cs.codeName.toLowerCase().replace(/_/g, "-");
      if (cs.isLpc && cs.sprite instanceof Phaser.GameObjects.Sprite) {
        cs.sprite.play(`walk_down_${slug}`, true);
      }
    }

    private execShowBubble(b: PendingBubble) {
      const cs = this.chars.get(b.charId);
      if (!cs) return;

      cs.bubbleContainer?.destroy();
      cs.bubbleContainer = null;

      const isThought = b.type === "thought";

      if (b.isFounderMessage) {
        this.buildFounderBubble(cs, b);
        return;
      }

      const es = EMOTION_STYLE[b.emotion ?? "neutral"] ?? EMOTION_STYLE.neutral;
      const displayText = (es.prefix || (b.emoji ? b.emoji + " " : "")) + b.text;

      const textObj = this.add.text(0, 0, displayText, {
        fontSize: "20px",
        color: isThought ? "#c0c0e0" : es.textColor,
        fontStyle: isThought ? "italic" : "normal",
        wordWrap: { width: 280 },
        resolution: 2,
      }).setOrigin(0.5, 0.5);

      const padX = 16, padY = 10;
      const bw = textObj.width + padX * 2;
      const bh = textObj.height + padY * 2;

      const bg = this.add.graphics();
      if (isThought) {
        bg.fillStyle(0x2a2a4a, 0.85).fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 16);
        bg.fillCircle(-bw / 4, bh / 2 + 6, 5).fillCircle(-bw / 4 + 10, bh / 2 + 16, 3);
        bg.lineStyle(2, 0x6060a0, 0.7).strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 16);
      } else {
        bg.fillStyle(es.bg, 0.9).fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 10);
        bg.fillTriangle(-6, bh / 2, 6, bh / 2, 0, bh / 2 + 10);
        bg.lineStyle(2, es.border, 0.7).strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 10);
      }

      const bubbleY = -(cs.sprite.displayHeight + 20 + bh / 2);
      const bc = this.add.container(0, bubbleY, [bg, textObj]);
      cs.container.add(bc);
      cs.bubbleContainer = bc;

      bc.setAlpha(0).setScale(0.5);
      this.tweens.add({ targets: bc, alpha: 1, scaleX: 1, scaleY: 1, duration: 200, ease: "Back.easeOut" });
      this.time.delayedCall(b.duration, () => {
        if (!cs.bubbleContainer) return;
        this.tweens.add({
          targets: cs.bubbleContainer, alpha: 0, scaleX: 0.8, scaleY: 0.8, duration: 300, ease: "Power2",
          onComplete: () => {
            cs.bubbleContainer?.destroy();
            cs.bubbleContainer = null;
            cs.bubbleOverrideActive = false;
          },
        });
      });

      // Pose override for multi-pose static chars
      const slug = cs.codeName.toLowerCase().replace(/_/g, "-");
      if (!cs.isLpc) {
        const poseKey = `char_${slug}_${isThought ? "thinking" : "talking"}`;
        if (this.textures.exists(poseKey)) {
          cs.bubbleOverrideActive = true;
          (cs.sprite as PhImage).setTexture(poseKey);
        }
      }
    }

    private buildFounderBubble(cs: CharSpriteObj, b: PendingBubble) {
      const textObj = this.add.text(0, 0, "👑 " + b.text, {
        fontSize: "20px", color: "#FFD700", fontStyle: "bold",
        wordWrap: { width: 300 }, resolution: 2,
      }).setOrigin(0.5, 0.5);

      const padX = 18, padY = 12;
      const bw = textObj.width + padX * 2, bh = textObj.height + padY * 2;

      const bg = this.add.graphics();
      bg.fillStyle(0x2a1800, 0.92).fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 12);
      bg.lineStyle(3, 0xFFD700, 0.85).strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 12);
      bg.fillTriangle(-6, bh / 2, 6, bh / 2, 0, bh / 2 + 12);

      const bc = this.add.container(0, -(cs.sprite.displayHeight + 20 + bh / 2), [bg, textObj]);
      cs.container.add(bc);
      cs.bubbleContainer = bc;
      bc.setAlpha(0).setScale(0.5);
      this.tweens.add({ targets: bc, alpha: 1, scaleX: 1, scaleY: 1, duration: 200, ease: "Back.easeOut" });
      this.time.delayedCall(b.duration, () => {
        if (!cs.bubbleContainer) return;
        this.tweens.add({
          targets: cs.bubbleContainer, alpha: 0, duration: 300, ease: "Power2",
          onComplete: () => { cs.bubbleContainer?.destroy(); cs.bubbleContainer = null; },
        });
      });
    }
  }

  return WorldSceneImpl;
}
