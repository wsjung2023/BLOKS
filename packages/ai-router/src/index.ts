// @bloks/ai-router — routeAI function with character model lookup and provider routing
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const IS_LOCAL = process.env["BLOKS_PROFILE"] !== "connected";
import { OpenAiProvider } from "./providers/openai.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { GoogleProvider } from "./providers/google.js";
import { listCharacterMemories } from "@bloks/memory";

// ── Core types ────────────────────────────────────────────────────────────────

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

// ── routeAI public interface ──────────────────────────────────────────────────

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

// ── Supabase singleton (lazy) ─────────────────────────────────────────────────

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

// ── Character model profile lookup ───────────────────────────────────────────

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

// ── Task type → system prompt template ───────────────────────────────────────
// Used as fallback when the caller doesn't provide an explicit systemPrompt.

export const TASK_TEMPLATES: Record<string, string> = {
  planningDocument:   "계획 문서를 작성할 때는 목표, 범위, 일정, 리스크를 명확히 구분하여 포함하세요.",
  prd_draft:          "PRD에는 사용자 스토리, 기능/비기능 요구사항, 완료 조건을 포함하세요.",
  proposal_draft:     "제안서는 문제 정의, 해결책, 기대 효과, 예산 순서로 구성하세요.",
  project_plan:       "프로젝트 계획에는 WBS, 마일스톤, 담당자, 리스크를 포함하세요.",
  strategy_memo:      "전략 메모는 현황 분석, 목표, 실행 방안, 성과 지표 순으로 작성하세요.",
  research_summary:   "리서치 요약은 핵심 인사이트, 데이터 출처, 실행 가능한 결론을 제시하세요.",
  market_research:    "시장 분석에는 시장 규모, 경쟁사, 트렌드, 진입 기회를 포함하세요.",
  data_analysis:      "데이터 분석은 수치 근거와 함께 비즈니스 의사결정에 활용 가능한 결론을 도출하세요.",
  code_development:   "코드는 명확한 구조, 에러 처리, 가독성을 갖추고 한국어 주석을 포함하세요.",
  web_development:    "웹 개발 결과물은 UI/UX, 성능, 접근성을 고려하여 작성하세요.",
  marketing_copy:     "마케팅 콘텐츠는 타깃 독자를 명확히 하고 행동 유도(CTA)를 포함하세요.",
  online_content:     "온라인 콘텐츠는 SEO를 고려하고 공유 가능하도록 구성하세요.",
  document:           "문서는 결론을 먼저, 세부 근거를 뒤에 작성하는 두괄식 구조로 작성하세요.",
  memo:               "메모는 요점을 간결하게, 5줄 이내로 작성하세요.",
};

// ── Structured Output schemas (json_schema strict) ────────────────────────────
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

// ── Task type → default model mapping (doc 11: OpenAI primary in MVP) ────────

const TASK_MODEL_MAP: Record<string, string> = {
  // Planning / strategy — high-quality reasoning
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
  // Development tasks — code quality matters
  code_development:     "gpt-4o",
  web_development:      "gpt-4o",
  abap_development:     "gpt-4o",
  // Consulting / advisory
  sap_consulting:       "gpt-4o",
  // Marketing / content — fast generation OK
  marketing_copy:       "gpt-4o-mini",
  online_content:       "gpt-4o-mini",
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

// ── Provider resolution ───────────────────────────────────────────────────────

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

// ── Budget guard ──────────────────────────────────────────────────────────────

const MAX_COST_USD = parseFloat(process.env["AI_MAX_COST_PER_TASK_USD"] ?? "0.5");

function estimatedInputCost(model: string, promptLength: number): number {
  const inputTokens = Math.ceil(promptLength / 4);
  const ratePerM = model.includes("mini") ? 0.15 : 2.50;
  return (inputTokens / 1_000_000) * ratePerM;
}

// ── routeAI — main export ─────────────────────────────────────────────────────

export async function routeAI(options: RouteAIOptions): Promise<RouteAIResult> {
  const { characterId, taskType, prompt, context, systemPrompt, maxTokens, responseFormat, jsonSchema } = options;

  // Fetch character model profile from Supabase
  const profile = await fetchCharacterModelProfile(characterId);
  const model = selectModel(taskType, profile);
  const provider = resolveProvider(profile?.provider_name);

  // Inject long-term memories into system prompt (top 8, ≤400 tokens)
  let memoryBlock = "";
  try {
    const memories = await listCharacterMemories(characterId, { limit: 8 });
    if (memories.length > 0) {
      const lines = memories
        .slice(0, 8)
        .map(m => `- [${m.memory_type}] ${m.summary.slice(0, 200)}`);
      memoryBlock = `\n\n[장기 기억 - 최근 경험]\n${lines.join("\n")}`;
    }
  } catch {
    // Non-fatal: memory injection failure should not block task execution
  }

  // Build contextual system prompt — fall back to task template if no explicit prompt given
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

// ── Legacy class API (backwards compat) ──────────────────────────────────────

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
