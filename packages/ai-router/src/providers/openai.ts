// OpenAI provider — uses Responses API with Structured Outputs (strict json_schema)
import OpenAI from "openai";
import type { AiProvider, AiRequest, AiExecutionResult } from "../index.js";

// ── Cost estimation (per 1M tokens, USD) ─────────────────────────────────────

const COST_PER_1M: Record<string, { input: number; output: number }> = {
  "gpt-4o":             { input: 2.50,  output: 10.00 },
  "gpt-4o-mini":        { input: 0.15,  output: 0.60  },
  "gpt-4-turbo":        { input: 10.00, output: 30.00 },
  "o1":                 { input: 15.00, output: 60.00 },
  "o1-mini":            { input: 3.00,  output: 12.00 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_1M[model] ?? { input: 10.0, output: 30.0 };
  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
}

// ── Schema validation (basic structural check) ────────────────────────────────

function tryParseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

// ── Provider implementation ───────────────────────────────────────────────────

export class OpenAiProvider implements AiProvider {
  readonly name = "openai";

  private client: OpenAI;

  constructor() {
    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) throw new Error("OPENAI_API_KEY env var is required");

    this.client = new OpenAI({
      apiKey,
      organization: process.env["OPENAI_ORG_ID"],
      project: process.env["OPENAI_PROJECT_ID"],
    });
  }

  async execute<T = unknown>(request: AiRequest): Promise<AiExecutionResult<T>> {
    const model = request.model ?? "gpt-4o-mini";

    try {
      return await this.executeWithRetry<T>(request, model);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const isRateLimit = message.includes("rate_limit") || message.includes("429");
      const isContextLength = message.includes("context_length") || message.includes("maximum context");

      return {
        ok: false,
        model,
        provider: this.name,
        costUsdEstimate: 0,
        confidence: 0,
        output: null,
        errorCode: isRateLimit ? "RATE_LIMITED" : isContextLength ? "CONTEXT_TOO_LONG" : "PROVIDER_ERROR",
      };
    }
  }

  private buildParams(request: AiRequest, model: string): OpenAI.Responses.ResponseCreateParamsNonStreaming {
    const params: OpenAI.Responses.ResponseCreateParamsNonStreaming = {
      model,
      input: request.userPrompt,
      max_output_tokens: request.maxTokens ?? 2048,
    };

    // System instructions
    if (request.systemPrompt) {
      params.instructions = request.systemPrompt;
    }

    // Output format
    if (request.jsonSchema) {
      // Structured Outputs — strict JSON schema validation
      params.text = {
        format: {
          type: "json_schema",
          name: "output",
          schema: request.jsonSchema,
          strict: true,
        },
      };
    } else if (request.responseFormat === "json") {
      params.text = { format: { type: "json_object" } };
    }

    return params;
  }

  private async callResponsesApi(
    request: AiRequest,
    model: string,
    overridePrompt?: string,
  ): Promise<{ rawText: string; inputTokens: number; outputTokens: number }> {
    const params = this.buildParams(request, model);
    if (overridePrompt !== undefined) params.input = overridePrompt;

    const response = await this.client.responses.create(params);
    const rawText = response.output_text ?? "";
    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;

    return { rawText, inputTokens, outputTokens };
  }

  private async executeWithRetry<T>(
    request: AiRequest,
    model: string,
  ): Promise<AiExecutionResult<T>> {
    const { rawText, inputTokens, outputTokens } = await this.callResponsesApi(request, model);
    const costUsdEstimate = estimateCost(model, inputTokens, outputTokens);

    // Plain text response
    if (!request.jsonSchema && request.responseFormat !== "json") {
      return {
        ok: true,
        model,
        provider: this.name,
        costUsdEstimate,
        confidence: 0.9,
        output: rawText as unknown as T,
        rawText,
      };
    }

    // JSON response — parse and validate
    const parsed = tryParseJson(rawText);
    if (parsed.ok) {
      return {
        ok: true,
        model,
        provider: this.name,
        costUsdEstimate,
        confidence: 0.9,
        output: parsed.value as T,
        rawText,
      };
    }

    // Schema mismatch / parse failure — one retry with correction prompt
    const correctionPrompt = [
      request.userPrompt,
      "",
      "이전 응답이 유효한 JSON 형식이 아니었습니다. 반드시 유효한 JSON만 반환해 주세요.",
      request.jsonSchema
        ? "스키마를 준수해야 합니다: " + JSON.stringify(request.jsonSchema)
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const retry = await this.callResponsesApi(request, model, correctionPrompt);
    const totalCost = costUsdEstimate + estimateCost(model, retry.inputTokens, retry.outputTokens);
    const retryParsed = tryParseJson(retry.rawText);

    if (retryParsed.ok) {
      return {
        ok: true,
        model,
        provider: this.name,
        costUsdEstimate: totalCost,
        confidence: 0.7, // lower confidence after retry
        output: retryParsed.value as T,
        rawText: retry.rawText,
      };
    }

    return {
      ok: false,
      model,
      provider: this.name,
      costUsdEstimate: totalCost,
      confidence: 0,
      output: null,
      rawText,
      errorCode: "JSON_PARSE_ERROR",
    };
  }
}
