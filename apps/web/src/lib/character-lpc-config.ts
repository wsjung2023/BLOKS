// Character LPC layer definitions — DeskRPG format (576×256).
// Assets under /assets/lpc2/:
//   body/{male,female}/{skin}.png         — torso + legs body
//   head/{male,female}/{skin}.png         — head + face
//   hair/{style}/{color}.png              — hair overlay
//   torso/shirt/{male,female}/{color}.png — shirt (longsleeve)
//   legs/{formal,pants}/{male,female}/{color}.png
//   shadow/shadow.png
//
// Division → shirt colour:
//   Engineering=blue  Marketing=yellow  Research=green
//   Operations=orange  Strategy=purple  Executive=navy

import type { LpcLayer } from "./lpc-compositor";

type Skin   = "light" | "olive" | "bronze" | "brown" | "amber" | "taupe" | "black";
type Gender = "male" | "female";

function shadow(): LpcLayer { return { url: "shadow/shadow.png", zPos: -1 }; }
function body(g: Gender, s: Skin): LpcLayer { return { url: `body/${g}/${s}.png`, zPos: 0 }; }
function head(g: Gender, s: Skin): LpcLayer { return { url: `head/${g}/${s}.png`, zPos: 5 }; }
function shirt(g: Gender, color: string): LpcLayer { return { url: `torso/shirt/${g}/${color}.png`, zPos: 10 }; }
function pants(g: Gender, color: string): LpcLayer { return { url: `legs/formal/${g}/${color}.png`, zPos: 9 }; }
function hair(style: string, color: string): LpcLayer { return { url: `hair/${style}/${color}.png`, zPos: 20 }; }

function mk(g: Gender, s: Skin, shirtColor: string, pantsColor: string, hairStyle: string, hairColor: string): LpcLayer[] {
  return [shadow(), body(g, s), head(g, s), pants(g, pantsColor), shirt(g, shirtColor), hair(hairStyle, hairColor)];
}

// Division presets (all male "light" skin default — override per character)
const ENG  = (h: string, hc: string, g: Gender = "male", s: Skin = "light") => mk(g, s, "blue",    "charcoal", h, hc);
const MKT  = (h: string, hc: string, g: Gender = "male", s: Skin = "light") => mk(g, s, "yellow",  "navy",     h, hc);
const RES  = (h: string, hc: string, g: Gender = "male", s: Skin = "light") => mk(g, s, "green",   "charcoal", h, hc);
const OPS  = (h: string, hc: string, g: Gender = "male", s: Skin = "light") => mk(g, s, "orange",  "black",    h, hc);
const STR  = (h: string, hc: string, g: Gender = "male", s: Skin = "light") => mk(g, s, "purple",  "charcoal", h, hc);
const EXEC = (h: string, hc: string, g: Gender = "male", s: Skin = "light") => mk(g, s, "navy",    "black",    h, hc);

export const CHARACTER_LPC_CONFIG: Record<string, LpcLayer[]> = {
  // ── Executive ──────────────────────────────────────────────────────────────
  "founder-01": EXEC("bangsshort", "ash",      "male",   "light"),
  "selene":     EXEC("long",       "ash",      "female", "olive"),
  "aurelion":   EXEC("bangsshort", "blonde",   "male",   "light"),
  "echo-twin":  EXEC("long",       "black",    "female", "light"),
  "iris":       EXEC("bob",        "white",    "female", "light"),
  "lumi":       EXEC("long",       "blonde",   "female", "light"),
  "rhea":       EXEC("bob",        "ash",      "female", "olive"),
  "vant":       EXEC("buzzcut",    "black",    "male",   "brown"),

  // ── Engineering ───────────────────────────────────────────────────────────
  "arch":       ENG("bangsshort", "black",     "male",   "light"),
  "debug":      ENG("buzzcut",    "black",     "male",   "bronze"),
  "forge":      ENG("bangsshort", "chestnut",  "male",   "light"),
  "glitch":     ENG("bangslong",  "black",     "male",   "olive"),
  "deploy":     ENG("buzzcut",    "black",     "male",   "light"),
  "sprint":     ENG("bangsshort", "chestnut",  "male",   "light"),
  "phantom":    ENG("bangsshort", "ash",       "male",   "taupe"),
  "nexus":      ENG("bangslong",  "black",     "male",   "light"),
  "node-7":     ENG("buzzcut",    "black",     "male",   "bronze"),
  "stack":      ENG("bangsshort", "chestnut",  "male",   "light"),
  "rune-ai":    ENG("bangslong",  "black",     "male",   "olive"),
  "pix":        ENG("pixie",      "black",     "male",   "light"),
  "pixella":    ENG("long",       "blonde",    "female", "light"),
  "auto-flow":  ENG("bangsshort", "chestnut",  "male",   "light"),
  "atlas-arc":  ENG("bangsshort", "ash",       "male",   "light"),
  "atlas-prime":ENG("bangsshort", "black",     "male",   "bronze"),

  // ── Marketing ─────────────────────────────────────────────────────────────
  "buzz":       MKT("long",       "blonde",    "female", "light"),
  "echo-mkt":   MKT("bob",        "black",     "female", "light"),
  "kite":       MKT("bangsshort", "chestnut",  "male",   "olive"),
  "linker":     MKT("bangslong",  "blonde",    "male",   "light"),
  "marq":       MKT("buzzcut",    "black",     "male",   "brown"),
  "metrica":    MKT("bob",        "chestnut",  "female", "light"),
  "orion":      MKT("bangsshort", "blonde",    "male",   "light"),
  "pixels":     MKT("pixie",      "black",     "female", "olive"),
  "solene":     MKT("long",       "blonde",    "female", "olive"),
  "sora-txt":   MKT("bob",        "chestnut",  "female", "light"),
  "vesper":     MKT("bangslong",  "blonde",    "female", "light"),
  "vivid":      MKT("long",       "black",     "female", "bronze"),
  "clover":     MKT("long",       "blonde",    "female", "light"),

  // ── Research ──────────────────────────────────────────────────────────────
  "axiom":      RES("bangsshort", "chestnut",  "male",   "olive"),
  "byte":       RES("bangslong",  "black",     "male",   "light"),
  "cain":       RES("buzzcut",    "black",     "male",   "brown"),
  "delta-m":    RES("bangsshort", "chestnut",  "male",   "light"),
  "lens":       RES("long",       "blonde",    "female", "light"),
  "mira":       RES("bob",        "black",     "female", "olive"),
  "nova-sig":   RES("bangslong",  "chestnut",  "male",   "light"),
  "oracle":     RES("bangsshort", "ash",       "male",   "taupe"),
  "pivot":      RES("bangsshort", "black",     "male",   "light"),
  "quill":      RES("long",       "chestnut",  "female", "light"),
  "red-flag":   RES("buzzcut",    "black",     "male",   "bronze"),
  "rival-x":    RES("bangslong",  "black",     "male",   "olive"),
  "scout":      RES("bangsshort", "chestnut",  "male",   "light"),
  "sigma":      RES("long",       "blonde",    "female", "olive"),
  "comply":     RES("bangslong",  "black",     "male",   "light"),

  // ── Operations ────────────────────────────────────────────────────────────
  "erp-master": OPS("bangsshort", "black",     "male",   "brown"),
  "archive-9":  OPS("bangslong",  "black",     "male",   "light"),
  "ledger":     OPS("buzzcut",    "black",     "male",   "bronze"),
  "memo":       OPS("bangsshort", "black",     "male",   "light"),
  "omega-ops":  OPS("bangsshort", "chestnut",  "male",   "olive"),
  "ops":        OPS("buzzcut",    "black",     "male",   "brown"),
  "pulse":      OPS("bangslong",  "black",     "male",   "light"),
  "sentinel":   OPS("buzzcut",    "black",     "male",   "taupe"),

  // ── Strategy ──────────────────────────────────────────────────────────────
  "hector":     STR("bangsshort", "ash",       "male",   "light"),
  "jae-min":    STR("bangsshort", "black",     "male",   "olive"),
  "nabi":       STR("long",       "chestnut",  "female", "light"),
  "nova":       STR("bob",        "ash",       "female", "light"),
  "ordo":       STR("bangsshort", "black",     "male",   "bronze"),
  "pm-alto":    STR("bangslong",  "chestnut",  "male",   "light"),
  "spec-on":    STR("bangsshort", "ash",       "male",   "taupe"),
  "vera-flow":  STR("long",       "black",     "female", "olive"),
};

export function getLpcLayers(codeName: string): LpcLayer[] | null {
  const slug = codeName.toLowerCase().replace(/_/g, "-");
  return CHARACTER_LPC_CONFIG[slug] ?? null;
}
