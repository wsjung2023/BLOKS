import { globalToolRegistry } from "@bloks/agent-runtime";
import { routeAI } from "@bloks/ai-router";

globalToolRegistry.register({
  name: "ai.task.execute",
  description: "Run an AI model call for a character task and return the generated text output.",
  riskLevel: "L1",
  inputSchema: {
    characterId: { type: "string" },
    taskType: { type: "string" },
    prompt: { type: "string" },
    systemPrompt: { type: "string" },
    maxTokens: { type: "number", optional: true },
  },
  execute: async (input) => {
    const result = await routeAI({
      characterId: input["characterId"] as string,
      taskType: input["taskType"] as string,
      prompt: input["prompt"] as string,
      systemPrompt: input["systemPrompt"] as string,
      responseFormat: "text",
      ...(input["maxTokens"] !== undefined ? { maxTokens: input["maxTokens"] as number } : {}),
    });
    return {
      output: result.output,
      modelUsed: result.modelUsed,
      tokensUsed: result.tokensUsed,
      costUsd: result.costUsd,
    };
  },
});
