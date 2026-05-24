import { createHash } from "node:crypto";
import type { ToolExecutionRecord } from "@bloks/shared";
import { EventType } from "@bloks/shared";

export interface AuditEntry {
  id: string;
  eventType: EventType;
  execution: ToolExecutionRecord;
  recordedAt: string;
  /** SHA-256 of this entry's canonical fields — tamper evidence */
  hash: string;
  /** hash of the immediately preceding entry, "genesis" for the first */
  prevHash: string;
}

export type AuditPersistFn = (entry: AuditEntry) => Promise<void>;

function hashEntry(fields: {
  id: string;
  eventType: string;
  executionId: string;
  recordedAt: string;
  prevHash: string;
}): string {
  const canonical = JSON.stringify({
    id: fields.id,
    eventType: fields.eventType,
    executionId: fields.executionId,
    recordedAt: fields.recordedAt,
    prevHash: fields.prevHash,
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Writes immutable, hash-linked audit entries for every tool execution lifecycle event.
 * Each entry contains a SHA-256 hash of its own canonical fields and a pointer
 * to the previous entry's hash, forming a tamper-evident chain.
 *
 * Consumers inject a persist function (DB writer, file appender, etc.)
 * so this package has no storage dependency itself.
 */
export class AuditWriter {
  private lastHash = "genesis";

  constructor(private readonly persist: AuditPersistFn) {}

  async record(eventType: EventType, execution: ToolExecutionRecord): Promise<void> {
    const id = `audit_${execution.id}_${eventType}`;
    const recordedAt = new Date().toISOString();
    const prevHash = this.lastHash;

    const hash = hashEntry({
      id,
      eventType,
      executionId: execution.id,
      recordedAt,
      prevHash,
    });

    const entry: AuditEntry = {
      id,
      eventType,
      execution,
      recordedAt,
      hash,
      prevHash,
    };

    await this.persist(entry);
    this.lastHash = hash;
  }
}

/** No-op audit writer for local-first mode before DB is configured */
export const noopAuditWriter = new AuditWriter(async () => {});

/**
 * Verifies the integrity of an audit log by re-computing hashes
 * and checking that each entry's prevHash matches the previous entry's hash.
 * Returns true if the chain is intact.
 */
export function verifyAuditChain(entries: AuditEntry[]): {
  valid: boolean;
  firstBrokenIndex?: number;
} {
  let prevHash = "genesis";
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const expected = hashEntry({
      id: entry.id,
      eventType: entry.eventType,
      executionId: entry.execution.id,
      recordedAt: entry.recordedAt,
      prevHash,
    });
    if (expected !== entry.hash || entry.prevHash !== prevHash) {
      return { valid: false, firstBrokenIndex: i };
    }
    prevHash = entry.hash;
  }
  return { valid: true };
}
