import { EventType } from "@bloks/shared";
import type { ToolExecutionRecord } from "@bloks/shared";
import { classifyRisk } from "@bloks/policy-engine";
import { evaluatePolicyWithReason } from "@bloks/policy-engine";
import type { AuditWriter } from "@bloks/audit";
import { noopAuditWriter, maskSecretsInObject } from "@bloks/audit";
import { globalExecutionBus } from "./execution-bus.js";
import { globalToolRegistry } from "./tool-registry.js";

export interface ToolCallRequest {
  toolName: string;
  input: Record<string, unknown>;
  requestedByCharacterId: string;
  taskId?: string | null;
  traceId: string;
}

export interface ToolCallResult {
  executionId: string;
  status: "executed" | "denied" | "approval_required";
  output?: Record<string, unknown>;
  errorMessage?: string;
}

export class RuntimeEngine {
  constructor(private readonly auditWriter: AuditWriter = noopAuditWriter) {}

  /**
   * Mandatory execution pipeline (03-runtime-and-tools.md):
   * 1. Validate input schema
   * 2. Evaluate policy and risk level
   * 3. Request approval if required
   * 4. Execute in scoped environment
   * 5. Persist output and side effects
   * 6. Emit audit event chain
   */
  async execute(req: ToolCallRequest): Promise<ToolCallResult> {
    const executionId = `tex_${req.traceId}_${Date.now()}`;
    const now = () => new Date().toISOString();

    // 1. Validate — deny unknown tools immediately
    if (!globalToolRegistry.has(req.toolName)) {
      const execution = this.makeRecord(executionId, req, "denied", now());
      execution.error_message = `Unknown tool: '${req.toolName}'. Denied by default.`;
      this.emit(EventType.ToolDenied, execution);
      await this.auditWriter.record(EventType.ToolDenied, execution);
      await this.auditWriter.record(EventType.ToolAuditPersisted, execution);
      this.emit(EventType.ToolAuditPersisted, execution);
      return { executionId, status: "denied", errorMessage: execution.error_message };
    }

    const tool = globalToolRegistry.get(req.toolName)!;

    // 2. Classify risk
    const riskLevel = classifyRisk(req.toolName, req.input);
    const execution = this.makeRecord(executionId, req, "requested", now());
    execution.risk_level = riskLevel;
    this.emit(EventType.ToolRequested, execution);
    await this.auditWriter.record(EventType.ToolRequested, execution);

    // 3. Evaluate policy
    const { decision, reason } = evaluatePolicyWithReason({
      toolName: req.toolName,
      riskLevel,
      requestedByCharacterId: req.requestedByCharacterId,
      taskId: req.taskId ?? null,
    });
    execution.status = "policy_evaluated";
    execution.policy_decision = decision;
    this.emit(EventType.ToolPolicyEvaluated, execution);
    await this.auditWriter.record(EventType.ToolPolicyEvaluated, execution);

    if (decision === "deny") {
      execution.status = "denied";
      execution.error_message = reason;
      execution.resolved_at = now();
      this.emit(EventType.ToolDenied, execution);
      await this.auditWriter.record(EventType.ToolDenied, execution);
      await this.auditWriter.record(EventType.ToolAuditPersisted, execution);
      this.emit(EventType.ToolAuditPersisted, execution);
      return { executionId, status: "denied", errorMessage: reason };
    }

    if (decision === "require_approval") {
      execution.status = "approval_requested";
      this.emit(EventType.ToolApprovalRequested, execution);
      await this.auditWriter.record(EventType.ToolApprovalRequested, execution);
      // Approval is async — caller must resume via approveExecution()
      return { executionId, status: "approval_required" };
    }

    // 4. Execute (L0/L1 auto-allowed)
    return this.runTool(execution, tool, now);
  }

  /** Called after a human approves an L2 tool call */
  async approveExecution(
    execution: ToolExecutionRecord,
    approverId: string,
  ): Promise<ToolCallResult> {
    const now = () => new Date().toISOString();
    const tool = globalToolRegistry.get(execution.tool_name);
    if (!tool) {
      return { executionId: execution.id, status: "denied", errorMessage: "Tool no longer registered" };
    }
    execution.approver_id = approverId;
    execution.status = "approved";
    this.emit(EventType.ToolApproved, execution);
    await this.auditWriter.record(EventType.ToolApproved, execution);
    return this.runTool(execution, tool, now);
  }

  private async runTool(
    execution: ToolExecutionRecord,
    tool: { execute: (input: Record<string, unknown>) => Promise<Record<string, unknown>> },
    now: () => string,
  ): Promise<ToolCallResult> {
    try {
      const output = await tool.execute(execution.input);
      execution.status = "executed";
      execution.output = maskSecretsInObject(output) as Record<string, unknown>;
      execution.resolved_at = now();
      this.emit(EventType.ToolExecuted, execution);
      await this.auditWriter.record(EventType.ToolExecuted, execution);
      await this.auditWriter.record(EventType.ToolAuditPersisted, execution);
      this.emit(EventType.ToolAuditPersisted, execution);
      return { executionId: execution.id, status: "executed", output: execution.output };
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : String(err);
      execution.status = "failed";
      execution.error_message = maskSecretsInObject(rawMessage) as string;
      execution.resolved_at = now();
      this.emit(EventType.ToolFailed, execution);
      await this.auditWriter.record(EventType.ToolFailed, execution);
      await this.auditWriter.record(EventType.ToolAuditPersisted, execution);
      this.emit(EventType.ToolAuditPersisted, execution);
      return { executionId: execution.id, status: "denied", errorMessage: execution.error_message };
    }
  }

  private makeRecord(
    id: string,
    req: ToolCallRequest,
    status: ToolExecutionRecord["status"],
    requestedAt: string,
  ): ToolExecutionRecord {
    return {
      id,
      trace_id: req.traceId,
      tool_name: req.toolName,
      risk_level: "L3",
      status,
      input: maskSecretsInObject(req.input) as Record<string, unknown>,
      requested_by_character_id: req.requestedByCharacterId,
      task_id: req.taskId ?? null,
      requested_at: requestedAt,
    };
  }

  private emit(eventType: EventType, execution: ToolExecutionRecord): void {
    globalExecutionBus.emit(eventType, execution);
  }
}

export const globalRuntimeEngine = new RuntimeEngine();
