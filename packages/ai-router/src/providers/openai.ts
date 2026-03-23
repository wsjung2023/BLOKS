// OpenAI provider — wraps OpenAI SDK with BLOKS AiExecutionResult contract
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
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        ...(request.systemPrompt
          ? [{ role: "system" as const, content: request.systemPrompt }]
          : []),
        { role: "user" as const, content: request.userPrompt },
      ];

      const response = await this.client.chat.completions.create({
        model,
        messages,
        max_tokens: request.maxTokens ?? 2048,
        temperature: request.temperature ?? 0.7,
        ...(request.responseFormat === "json"
          ? { response_format: { type: "json_object" } }
          : {}),
      });

      const choice = response.choices[0];
      const rawText = choice?.message.content ?? "";
      const inputTokens = response.usage?.prompt_tokens ?? 0;
      const outputTokens = response.usage?.completion_tokens ?? 0;
      const costUsdEstimate = estimateCost(model, inputTokens, outputTokens);

      let output: T | null = null;
      if (request.responseFormat === "json" && rawText) {
        try {
          output = JSON.parse(rawText) as T;
        } catch {
          return {
            ok: false,
            model,
            provider: this.name,
            costUsdEstimate,
            confidence: 0,
            output: null,
            rawText,
            errorCode: "JSON_PARSE_ERROR",
          };
        }
      } else {
        output = rawText as unknown as T;
      }

      return {
        ok: true,
        model,
        provider: this.name,
        costUsdEstimate,
        confidence: 0.9,
        output,
        rawText,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const isRateLimit = message.includes("rate_limit") || message.includes("429");
      const isContextLength = message.includes("context_length");

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
}
