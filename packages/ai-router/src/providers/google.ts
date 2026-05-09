// Google AI provider — wraps @google/generative-ai SDK
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AiProvider, AiRequest, AiExecutionResult } from "../index.js";

const COST_PER_1M: Record<string, { input: number; output: number }> = {
  "gemini-1.5-pro":   { input: 1.25, output: 5.00 },
  "gemini-1.5-flash": { input: 0.075, output: 0.30 },
  "gemini-2.0-flash": { input: 0.10, output: 0.40 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_1M[model] ?? { input: 1.25, output: 5.0 };
  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
}

export class GoogleProvider implements AiProvider {
  readonly name = "google";
  private genAI: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env["GOOGLE_AI_API_KEY"];
    if (!apiKey) throw new Error("GOOGLE_AI_API_KEY env var is required");
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async execute<T = unknown>(request: AiRequest): Promise<AiExecutionResult<T>> {
    const model = request.model ?? "gemini-1.5-flash";

    try {
      const genModel = this.genAI.getGenerativeModel({
        model,
        ...(request.systemPrompt ? { systemInstruction: request.systemPrompt } : {}),
      });

      const result = await genModel.generateContent(request.userPrompt);
      const rawText = result.response.text();
      const usage = result.response.usageMetadata;
      const inputTokens = usage?.promptTokenCount ?? Math.ceil(request.userPrompt.length / 4);
      const outputTokens = usage?.candidatesTokenCount ?? Math.ceil(rawText.length / 4);
      const costUsdEstimate = estimateCost(model, inputTokens, outputTokens);

      let output: T | null = null;
      if (request.responseFormat === "json" && rawText) {
        const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, rawText];
        const jsonStr = jsonMatch[1]?.trim() ?? rawText;
        try {
          output = JSON.parse(jsonStr) as T;
        } catch {
          return { ok: false, model, provider: this.name, costUsdEstimate, confidence: 0, output: null, rawText, errorCode: "JSON_PARSE_ERROR" };
        }
      } else {
        output = rawText as unknown as T;
      }

      return { ok: true, model, provider: this.name, costUsdEstimate, confidence: 0.9, output, rawText };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const isRateLimit = message.includes("429") || message.includes("quota");
      return { ok: false, model, provider: this.name, costUsdEstimate: 0, confidence: 0, output: null, errorCode: isRateLimit ? "RATE_LIMITED" : "PROVIDER_ERROR" };
    }
  }
}
