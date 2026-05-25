// @bloks/ai-router: routeAI with character model lookup and provider routing
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const IS_LOCAL = process.env["BLOKS_PROFILE"] !== "connected";
import { OpenAiProvider } from "./providers/openai.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { GoogleProvider } from "./providers/google.js";
import { listCharacterMemories } from "@bloks/memory";

// section

export interface AiRequest {
  taskType?: string;
  systemPrompt?: string;
  userPrompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: "text" | "json";
  /** When set, enables OpenAI Structured Outputs (json_schema strict mode). */
  jsonSchema?: Record<string, unknown>;
  characterId?: string;
}

export interface AiExecutionResult<T = unknown> {
  ok: boolean;
  model: string;
  provider: string;
  costUsdEstimate: number;
  confidence: number;
  output: T | null;
  rawText?: string;
  errorCode?: string;
}

export interface AiProvider {
  readonly name: string;
  execute<T = unknown>(request: AiRequest): Promise<AiExecutionResult<T>>;
}

// section

export interface RouteAIOptions {
  characterId: string;
  taskType: string;
  prompt: string;
  context?: Record<string, unknown>;
  systemPrompt?: string;
  maxTokens?: number;
  responseFormat?: "text" | "json";
  /** Enables Structured Outputs for this call (passes schema to OpenAI json_schema strict). */
  jsonSchema?: Record<string, unknown>;
}

export interface RouteAIResult {
  output: string;
  modelUsed: string;
  tokensUsed: number;
  costUsd: number;
}

// section

let _sb: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (IS_LOCAL) return null;
  if (_sb) return _sb;
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return null;
  _sb = createClient(url, key, { auth: { persistSession: false } });
  return _sb;
}

// section

interface ModelProfile {
  model_id: string;
  provider_name: string;
  display_name?: string | undefined;
}

async function fetchCharacterModelProfile(characterId: string): Promise<ModelProfile | null> {
  try {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb
      .from("characters")
      .select("model_profiles!default_model_profile_id(primary_model, provider_name, profile_name)")
      .eq("id", characterId)
      .single();

    if (!data) return null;
    const raw = (data as Record<string, unknown>)["model_profiles"];
    if (!raw) return null;
    const p = Array.isArray(raw) ? (raw[0] as Record<string, unknown>) : (raw as Record<string, unknown>);
    return {
      model_id: p["primary_model"] as string,
      provider_name: p["provider_name"] as string,
      display_name: p["profile_name"] as string | undefined,
    };
  } catch {
    return null;
  }
}

// section
// Used as fallback when the caller doesn't provide an explicit systemPrompt.

export const TASK_TEMPLATES: Record<string, string> = {
  planningDocument:   "Write a planning doc with goals, scope, timeline, and risks.",
  prd_draft:          "Write a PRD with user stories, requirements, and done criteria.",
  proposal_draft:     "Write a proposal with problem, solution, expected impact, and budget.",
  project_plan:       "Write a project plan with WBS, milestones, owners, and risk controls.",
  strategy_memo:      "Write a strategy memo with context, options, recommendation, and KPIs.",
  research_summary:   "Summarize key insights, sources, and actionable conclusions.",
  market_research:    "Include market size, competitors, trends, and entry opportunities.",
  data_analysis:      "Provide numeric evidence, insights, and business implications.",
  code_development:   "Provide maintainable code with error handling and testability.",
  web_development:    "Produce web output with UX, performance, and accessibility in mind.",
  marketing_copy:     "Write target-aware marketing copy with clear CTA.",
  online_content:     "Produce shareable SEO-aware online content.",
  erp_operation:      "Describe ERP flows, master data impact, access control, and validation scenarios.",
  sap_abap_spec:      "Provide ABAP spec: purpose, IO schema, main FORM/CLASS design, and test points.",
  sap_abap_review:    "Review ABAP for performance, SQL efficiency, exception handling, and transaction safety.",
  image_production:   "Define image concept, ratio/resolution, style constraints, and export format.",
  video_production:   "Define shot list, timeline, subtitle/voice plan, and output format.",
  media_pipeline:     "Describe media pipeline inputs, transforms, QC checks, and final deliverables.",
  document:           "Write documents with conclusion first, then supporting evidence.",
  memo:               "Write concise memo in 5 lines when possible.",
};

// section
// Callers can pass these via routeAI({ jsonSchema: TASK_SCHEMAS.planningDocument })
// to get schema-validated JSON back instead of free-form text.

export const TASK_SCHEMAS: Record<string, Record<string, unknown>> = {
  planningDocument: {
    type: "object",
    properties: {
      title:     { type: "string" },
      objective: { type: "string" },
      scope:     { type: "string" },
      milestones: { type: "array", items: { type: "string" } },
      risks:     { type: "array", items: { type: "string" } },
    },
    required: ["title", "objective", "scope", "milestones", "risks"],
    additionalProperties: false,
  },
  prd_draft: {
    type: "object",
    properties: {
      title:         { type: "string" },
      userStories:   { type: "array", items: { type: "string" } },
      requirements:  { type: "array", items: { type: "string" } },
      doneCondition: { type: "string" },
    },
    required: ["title", "userStories", "requirements", "doneCondition"],
    additionalProperties: false,
  },
  data_analysis: {
    type: "object",
    properties: {
      summary:    { type: "string" },
      insights:   { type: "array", items: { type: "string" } },
      conclusion: { type: "string" },
    },
    required: ["summary", "insights", "conclusion"],
    additionalProperties: false,
  },
};

// section

const TASK_MODEL_MAP: Record<string, string> = {
  // Planning / strategy
  planningDocument:     "gpt-4o",
  prd_draft:            "gpt-4o",
  proposal_draft:       "gpt-4o",
  project_plan:         "gpt-4o",
  strategy_memo:        "gpt-4o",
  orchestrate:          "gpt-4o",
  // Research / analysis
  research_summary:     "gpt-4o",
  market_research:      "gpt-4o",
  data_analysis:        "gpt-4o",
  analysis:             "gpt-4o",
  erp_operation:        "gpt-4o",
  // Development
  code_development:     "gpt-4o",
  web_development:      "gpt-4o",
  abap_development:     "gpt-4o",
  sap_abap_spec:        "gpt-4o",
  sap_abap_review:      "gpt-4o",
  sap_consulting:       "gpt-4o",
  media_pipeline:       "gpt-4o",
  // Fast generation
  marketing_copy:       "gpt-4o-mini",
  online_content:       "gpt-4o-mini",
  image_production:     "gpt-4o-mini",
  video_production:     "gpt-4o-mini",
  copy:                 "gpt-4o-mini",
  memo:                 "gpt-4o-mini",
  document:             "gpt-4o-mini",
  // Lightweight operational
  approval_analysis:    "gpt-4o-mini",
  character_action:     "gpt-4o-mini",
  founder_message:      "gpt-4o-mini",
  default:              "gpt-4o-mini",
};

function selectModel(taskType: string, profile: ModelProfile | null): string {
  // Per doc 11 P0 fix #8: OpenAI primary; character profile sets model but not provider
  if (profile?.model_id) return profile.model_id;
  return TASK_MODEL_MAP[taskType] ?? TASK_MODEL_MAP["default"]!;
}

// section

let _openai: OpenAiProvider | null = null;
let _anthropic: AnthropicProvider | null = null;
let _google: GoogleProvider | null = null;

function getOpenAi(): OpenAiProvider {
  _openai ??= new OpenAiProvider();
  return _openai;
}

function resolveProvider(providerName: string | undefined): AiProvider {
  switch (providerName) {
    case "anthropic": {
      _anthropic ??= new AnthropicProvider();
      return _anthropic;
    }
    case "google": {
      _google ??= new GoogleProvider();
      return _google;
    }
    default:
      return getOpenAi();
  }
}

// section

const MAX_COST_USD = parseFloat(process.env["AI_MAX_COST_PER_TASK_USD"] ?? "0.5");

function estimatedInputCost(model: string, promptLength: number): number {
  const inputTokens = Math.ceil(promptLength / 4);
  const ratePerM = model.includes("mini") ? 0.15 : 2.50;
  return (inputTokens / 1_000_000) * ratePerM;
}

// section

export async function routeAI(options: RouteAIOptions): Promise<RouteAIResult> {
  const { characterId, taskType, prompt, context, systemPrompt, maxTokens, responseFormat, jsonSchema } = options;

  // Fetch character model profile from Supabase
  const profile = await fetchCharacterModelProfile(characterId);
  const model = selectModel(taskType, profile);
  const provider = resolveProvider(profile?.provider_name);

  // Inject long-term memories into system prompt (top 8 entries).
  let memoryBlock = "";
  try {
    const memories = await listCharacterMemories(characterId, { limit: 8 });
    if (memories.length > 0) {
      const lines = memories
        .slice(0, 8)
        .map(m => `- [${m.memory_type}] ${m.summary.slice(0, 200)}`);
      memoryBlock = `\n\n[Long-term Memory]\n${lines.join("\n")}`;
    }
  } catch {
    // Non-fatal: memory injection failure should not block task execution
  }

  // Build contextual system prompt, falling back to task template.
  const baseSystem = systemPrompt ?? TASK_TEMPLATES[taskType] ?? (context ? `Context: ${JSON.stringify(context)}` : undefined);
  const resolvedSystem = baseSystem ? baseSystem + memoryBlock : (memoryBlock || undefined);

  const fullPromptLength = (resolvedSystem ?? "").length + prompt.length;

  // Pre-flight budget check
  if (estimatedInputCost(model, fullPromptLength) > MAX_COST_USD) {
    throw new Error(`AI_BUDGET_EXCEEDED: estimated cost exceeds ${MAX_COST_USD} USD`);
  }

  const request: AiRequest = {
    userPrompt: prompt,
    taskType,
    model,
    responseFormat: jsonSchema ? "json" : (responseFormat ?? "text"),
    characterId,
    ...(resolvedSystem ? { systemPrompt: resolvedSystem } : {}),
    ...(maxTokens !== undefined ? { maxTokens } : {}),
    ...(jsonSchema !== undefined ? { jsonSchema } : {}),
  };

  let result = await provider.execute<string>(request);

  // Fallback on provider error
  if (!result.ok && result.errorCode !== "BUDGET_EXCEEDED" && result.errorCode !== "RATE_LIMITED") {
    const fallbackModel = "gpt-4o-mini";
    if (fallbackModel !== model) {
      console.warn(`[ai-router] ${model} failed (${result.errorCode}), falling back to ${fallbackModel}`);
      result = await getOpenAi().execute<string>({ ...request, model: fallbackModel });
    }
  }

  if (!result.ok) {
    throw new Error(`AI_MODEL_FAILURE: ${result.errorCode ?? "unknown"}`);
  }

  const outputText = typeof result.output === "string"
    ? result.output
    : JSON.stringify(result.output);

  // Approximate token count from raw text length
  const tokensUsed = Math.ceil((outputText.length + fullPromptLength) / 4);

  return {
    output: outputText,
    modelUsed: result.model,
    tokensUsed,
    costUsd: result.costUsdEstimate,
  };
}

// section

export interface CharacterModelConfig {
  characterId: string;
  primaryModel: string;
  fallbackModel?: string;
  providerPreference?: "openai" | "anthropic";
}

export class AiRouter {
  async execute<T = unknown>(request: AiRequest, characterConfig?: CharacterModelConfig): Promise<AiExecutionResult<T>> {
    const model = request.model ?? characterConfig?.primaryModel ?? TASK_MODEL_MAP["default"]!;
    const provider = resolveProvider(characterConfig?.providerPreference);
    const result = await provider.execute<T>({ ...request, model });

    if (!result.ok && result.errorCode !== "BUDGET_EXCEEDED" && result.errorCode !== "RATE_LIMITED") {
      const fallback = characterConfig?.fallbackModel ?? "gpt-4o-mini";
      if (fallback !== model) {
        return getOpenAi().execute<T>({ ...request, model: fallback });
      }
    }
    return result;
  }
}

export function getAiRouter(): AiRouter {
  return new AiRouter();
}

export { OpenAiProvider };

export { generateImage, listAvailableImageProviders } from "./image.js";
export { generateVideo } from "./video.js";
export type { VideoGenRequest, VideoGenResult } from "./video.js";
export type { ImageGenRequest, ImageGenResult } from "./image.js";

