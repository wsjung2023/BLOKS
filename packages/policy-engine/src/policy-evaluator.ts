import type { ToolRiskLevel } from "@bloks/shared";

export type PolicyDecision = "allow" | "deny" | "require_approval";

export interface PolicyContext {
  toolName: string;
  riskLevel: ToolRiskLevel;
  requestedByCharacterId: string;
  taskId?: string | null;
  workspacePath?: string | null;
}

/**
 * Evaluates whether a tool call is allowed, denied, or requires human approval.
 *
 * Default policy (local-first safe mode):
 *  L0 → allow
 *  L1 → allow (workspace-scoped writes)
 *  L2 → require_approval
 *  L3 → deny (unless explicit override policy active)
 */
export function evaluatePolicy(ctx: PolicyContext): PolicyDecision {
  switch (ctx.riskLevel) {
    case "L0":
      return "allow";
    case "L1":
      return "allow";
    case "L2":
      return "require_approval";
    case "L3":
      return "deny";
  }
}

export interface PolicyEvaluationResult {
  decision: PolicyDecision;
  reason: string;
  riskLevel: ToolRiskLevel;
}

export function evaluatePolicyWithReason(ctx: PolicyContext): PolicyEvaluationResult {
  const decision = evaluatePolicy(ctx);
  const reasons: Record<PolicyDecision, string> = {
    allow: `Tool '${ctx.toolName}' (${ctx.riskLevel}) is within auto-allow policy.`,
    require_approval: `Tool '${ctx.toolName}' (${ctx.riskLevel}) requires human approval before execution.`,
    deny: `Tool '${ctx.toolName}' (${ctx.riskLevel}) is denied by default policy. Explicit override required.`,
  };
  return { decision, reason: reasons[decision], riskLevel: ctx.riskLevel };
}
