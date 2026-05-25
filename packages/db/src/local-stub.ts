/**
 * Local-first Supabase stub — no Supabase account or Docker required.
 *
 * Tables use a minimal in-memory query builder that supports
 * eq / in / neq / order / limit / update / upsert / insert.
 *
 * Data is persisted to .bloks-data/local-db.json on every mutation
 * and reloaded on startup, so data survives restarts.
 *
 * All unknown tables fall through to a no-op proxy that returns
 * { data: [], error: null } so the app never crashes.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SEEDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "seeds");

function loadSeed(filename: string): Row[] {
  try {
    const p = join(SEEDS_DIR, filename);
    if (existsSync(p)) return JSON.parse(readFileSync(p, "utf-8")) as Row[];
  } catch { /* fall back to empty */ }
  return [];
}

// ── Persistence ───────────────────────────────────────────────────────────────

// Resolve to repo root regardless of CWD (packages/db/src → ../../.. = repo root)
const DATA_DIR = process.env["BLOKS_DATA_DIR"]
  ?? join(dirname(fileURLToPath(import.meta.url)), "../../../.bloks-data");
const DB_FILE = join(DATA_DIR, "local-db.json");

function loadPersistedTables(): Record<string, Row[]> {
  try {
    if (existsSync(DB_FILE)) {
      return JSON.parse(readFileSync(DB_FILE, "utf-8")) as Record<string, Row[]>;
    }
  } catch { /* ignore parse errors, start fresh */ }
  return {};
}

function persistTables(): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(DB_FILE, JSON.stringify(localTables, null, 2), "utf-8");
  } catch { /* non-fatal */ }
}

// ── In-memory seed data ───────────────────────────────────────────────────────

type Row = Record<string, unknown>;

// Tables that have real in-memory data; others fall through to no-op.
// Priority: .bloks-data/local-db.json (user data) > seeds/ (default roster)
const _persisted = loadPersistedTables();

const localTables: Record<string, Row[]> = {
  characters: _persisted["characters"] ?? loadSeed("characters.json"),
  character_runtime_states: _persisted["character_runtime_states"] ?? loadSeed("character_runtime_states.json"),
  character_conversations: _persisted["character_conversations"] ?? [],
  character_bubbles: _persisted["character_bubbles"] ?? [],
  projects: _persisted["projects"] ?? [],
  tasks: _persisted["tasks"] ?? [],
  artifacts: _persisted["artifacts"] ?? [],
  event_logs: _persisted["event_logs"] ?? [],
  approvals: _persisted["approvals"] ?? [],
  agent_messages: _persisted["agent_messages"] ?? [],
  prompt_templates: _persisted["prompt_templates"] ?? [],
  outbox_events: _persisted["outbox_events"] ?? [],
  request_metrics: _persisted["request_metrics"] ?? [],
};

// ── In-memory query builder ───────────────────────────────────────────────────

type FilterFn = (row: Row) => boolean;

class LocalQueryBuilder {
  private rows: Row[];
  private filters: FilterFn[] = [];
  private _orderCol: string | null = null;
  private _orderAsc = true;
  private _limit: number | null = null;
  private _countMode = false;
  private _head = false;
  private _rangeFrom: number | null = null;
  private _rangeTo: number | null = null;
  private _pendingUpdate: Row | null = null;
  private _pendingUpsert: Row | Row[] | null = null;
  private _pendingInsert: Row | Row[] | null = null;
  private tableName: string;
  private _selectRequested = false;

  constructor(tableName: string, rows: Row[]) {
    this.tableName = tableName;
    this.rows = rows;
  }

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    this._selectRequested = true;
    if (opts?.count === "exact") this._countMode = true;
    if (opts?.head) this._head = true;
    return this;
  }

  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }

  neq(col: string, val: unknown) {
    this.filters.push((r) => r[col] !== val);
    return this;
  }

  not(col: string, op: string, val: unknown) {
    if (op === "is") this.filters.push((r) => r[col] !== val && r[col] !== null);
    else this.filters.push((r) => r[col] !== val);
    return this;
  }

  is(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }

  gt(col: string, val: unknown) {
    this.filters.push((r) => (r[col] as number) > (val as number));
    return this;
  }

  gte(col: string, val: unknown) {
    this.filters.push((r) => (r[col] as number) >= (val as number));
    return this;
  }

  lt(col: string, val: unknown) {
    this.filters.push((r) => (r[col] as number) < (val as number));
    return this;
  }

  lte(col: string, val: unknown) {
    this.filters.push((r) => (r[col] as number) <= (val as number));
    return this;
  }

  ilike(col: string, pattern: string) {
    const regex = new RegExp(pattern.replace(/%/g, ".*"), "i");
    this.filters.push((r) => regex.test(String(r[col] ?? "")));
    return this;
  }

  delete() {
    this._pendingInsert = null;
    return { then: (onFulfilled: (val: unknown) => void) => {
      const table = localTables[this.tableName];
      if (table) {
        const before = table.length;
        const keep = table.filter((r) => !this.filters.every((f) => f(r)));
        table.splice(0, table.length, ...keep);
        if (keep.length !== before) persistTables();
      }
      onFulfilled({ data: null, error: null });
    }};
  }

  in(col: string, vals: unknown[]) {
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this._orderCol = col;
    this._orderAsc = opts?.ascending !== false;
    return this;
  }

  limit(n: number) {
    this._limit = n;
    return this;
  }

  range(from: number, to: number) {
    this._rangeFrom = from;
    this._rangeTo = to;
    return this;
  }

  update(data: Row) {
    this._pendingUpdate = data;
    return this;
  }

  upsert(data: Row | Row[]) {
    this._pendingUpsert = data;
    return this;
  }

  insert(data: Row | Row[]) {
    this._pendingInsert = data;
    return this;
  }

  // Terminal: make the builder awaitable
  then(onFulfilled: (val: unknown) => void, onRejected?: (err: unknown) => void) {
    try {
      const result = this._execute();
      Promise.resolve(result).then(onFulfilled, onRejected);
    } catch (err) {
      if (onRejected) onRejected(err);
    }
  }

  catch(onRejected: (err: unknown) => void) {
    return Promise.reject().catch(onRejected);
  }

  finally(onFinally: () => void) {
    Promise.resolve().finally(onFinally);
    return this;
  }

  // single / maybeSingle
  single() {
    const result = this._execute() as { data: Row[] | null; error: null };
    const arr = Array.isArray(result.data) ? result.data : [];
    return Promise.resolve({ data: arr[0] ?? null, error: null });
  }

  maybeSingle() {
    return this.single();
  }

  private _filtered(): Row[] {
    return this.rows.filter((r) => this.filters.every((f) => f(r)));
  }

  private _execute(): { data: unknown; count?: number; error: null } {
    const table = localTables[this.tableName] ?? this.rows;
    const nowIso = new Date().toISOString();
    const makeId = () => `${this.tableName}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // INSERT
    if (this._pendingInsert !== null) {
      const toInsert = Array.isArray(this._pendingInsert) ? this._pendingInsert : [this._pendingInsert];
      const inserted = toInsert.map((incoming) => {
        const row = { ...incoming };
        if (row["id"] === undefined || row["id"] === null || row["id"] === "") row["id"] = makeId();
        if (row["created_at"] === undefined) row["created_at"] = nowIso;
        if (row["updated_at"] === undefined) row["updated_at"] = nowIso;
        return row;
      });
      table.push(...inserted);
      persistTables();
      return { data: this._selectRequested ? inserted : null, error: null };
    }

    // UPSERT
    if (this._pendingUpsert !== null) {
      const toUpsert = Array.isArray(this._pendingUpsert) ? this._pendingUpsert : [this._pendingUpsert];
      const affected: Row[] = [];
      for (const incoming of toUpsert) {
        const existing = table.find((r) => this.filters.every((f) => f(r)));
        if (existing) {
          Object.assign(existing, incoming);
          if (existing["updated_at"] === undefined) existing["updated_at"] = nowIso;
          affected.push(existing);
        } else {
          const row = { ...incoming };
          if (row["id"] === undefined || row["id"] === null || row["id"] === "") row["id"] = makeId();
          if (row["created_at"] === undefined) row["created_at"] = nowIso;
          if (row["updated_at"] === undefined) row["updated_at"] = nowIso;
          table.push(row);
          affected.push(row);
        }
      }
      persistTables();
      return { data: this._selectRequested ? affected : null, error: null };
    }

    // UPDATE
    if (this._pendingUpdate !== null) {
      const matching = table.filter((r) => this.filters.every((f) => f(r)));
      for (const row of matching) {
        Object.assign(row, this._pendingUpdate);
        if (row["updated_at"] === undefined) row["updated_at"] = nowIso;
      }
      persistTables();
      return { data: this._selectRequested ? matching : null, error: null };
    }

    // SELECT
    let result = table.filter((r) => this.filters.every((f) => f(r)));
    const totalCount = result.length;
    if (this._orderCol) {
      const col = this._orderCol;
      const asc = this._orderAsc;
      result = result.slice().sort((a, b) => {
        const av = String(a[col] ?? "");
        const bv = String(b[col] ?? "");
        return asc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    if (this._rangeFrom !== null && this._rangeTo !== null) {
      result = result.slice(this._rangeFrom, this._rangeTo + 1);
    } else if (this._limit !== null) {
      result = result.slice(0, this._limit);
    }

    if (this._countMode && this._head) return { data: null, count: totalCount, error: null };
    if (this._countMode) return { data: result, count: totalCount, error: null };
    return { data: result, error: null };
  }
}

// ── No-op proxy chain (fallback for unknown tables) ───────────────────────────

type ChainResult = Promise<{ data: unknown; error: null }>;

function makeChain(finalValue: { data: unknown; error: null } = { data: [], error: null }): unknown {
  const resolved = Promise.resolve(finalValue);
  const handler: ProxyHandler<object> = {
    get(_target, prop: string | symbol) {
      if (prop === "then") return resolved.then.bind(resolved);
      if (prop === "catch") return resolved.catch.bind(resolved);
      if (prop === "finally") return resolved.finally.bind(resolved);
      if (prop === "single" || prop === "maybeSingle") {
        return () => makeChain({ data: null, error: null });
      }
      return () => makeChain(finalValue);
    },
  };
  return new Proxy({}, handler) as ChainResult;
}

function makeNoopTable() {
  return {
    select: (..._args: unknown[]) => makeChain({ data: [], error: null }),
    insert: (..._args: unknown[]) => makeChain({ data: null, error: null }),
    update: (..._args: unknown[]) => makeChain({ data: null, error: null }),
    upsert: (..._args: unknown[]) => makeChain({ data: null, error: null }),
    delete: (..._args: unknown[]) => makeChain({ data: null, error: null }),
  };
}

// ── Public stub ───────────────────────────────────────────────────────────────

/** Satisfies `SupabaseClient` at the call-sites used in this codebase. */
export const localSupabaseStub = {
  from: (tableName: string) => {
    const rows = localTables[tableName];
    if (rows !== undefined) {
      return new LocalQueryBuilder(tableName, rows);
    }
    return makeNoopTable();
  },
  channel: (_name: string) => ({ on: () => ({ subscribe: () => {} }) }),
  removeChannel: () => {},
  storage: {
    from: (_bucket: string) => ({
      upload: async () => ({ data: null, error: null }),
      download: async () => ({ data: null, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: "" } }),
    }),
  },
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    signInWithPassword: async () => ({ data: null, error: null }),
    signOut: async () => ({ error: null }),
  },
  rpc: (_fn: string, _args?: unknown) => makeChain({ data: null, error: null }),
} as unknown;
