import type { ToolRiskLevel } from "@bloks/shared";

export interface ToolDefinition {
  name: string;
  description: string;
  riskLevel: ToolRiskLevel;
  inputSchema: Record<string, unknown>;  // JSON Schema
  execute: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

/**
 * Registry of all tools available to the agent runtime.
 * Unknown tools are denied by default (deny-unknown-tools safety rule).
 */
export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }
}

export const globalToolRegistry = new ToolRegistry();
