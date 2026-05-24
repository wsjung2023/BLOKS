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
import { join } from "node:path";

// ── Persistence ───────────────────────────────────────────────────────────────

const DATA_DIR = join(process.cwd(), ".bloks-data");
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

const SEED_CHARACTERS: Row[] = [
  { id: "local-char-01", name: "아크", code_name: "ARCH", persona_summary: "시스템 아키텍처를 담당하는 시니어 엔지니어", department: "engineering", active_flag: true, ai_enabled: false, location_zone: "desk" },
  { id: "local-char-02", name: "글리치", code_name: "GLITCH", persona_summary: "프론트엔드 개발 전문가, 버그 찾기를 즐김", department: "engineering", active_flag: true, ai_enabled: false, location_zone: "desk" },
  { id: "local-char-03", name: "스프린트", code_name: "SPRINT", persona_summary: "프로덕트 매니저, 일정과 목표를 관리", department: "operations", active_flag: true, ai_enabled: false, location_zone: "meeting-room" },
  { id: "local-char-04", name: "나비", code_name: "NABI", persona_summary: "UX/UI 디자이너, 사용자 경험을 최우선으로", department: "marketing", active_flag: true, ai_enabled: false, location_zone: "lounge" },
  { id: "local-char-05", name: "악시옴", code_name: "AXIOM", persona_summary: "데이터 분석 전문가, 인사이트 도출을 담당", department: "research", active_flag: true, ai_enabled: false, location_zone: "desk" },
];

const SEED_RUNTIME_STATES: Row[] = [
  { character_id: "local-char-01", workload_score: 45, fatigue_score: 20, burnout_triggered: false, activity_status: "Working", location_zone: "desk", floor_id: "3f-engineering" },
  { character_id: "local-char-02", workload_score: 60, fatigue_score: 30, burnout_triggered: false, activity_status: "Working", location_zone: "desk", floor_id: "3f-engineering" },
  { character_id: "local-char-03", workload_score: 50, fatigue_score: 25, burnout_triggered: false, activity_status: "InMeeting", location_zone: "meeting-room", floor_id: "2f-ops" },
  { character_id: "local-char-04", workload_score: 20, fatigue_score: 10, burnout_triggered: false, activity_status: "Idle", location_zone: "lounge", floor_id: "5f-marketing" },
  { character_id: "local-char-05", workload_score: 35, fatigue_score: 15, burnout_triggered: false, activity_status: "Working", location_zone: "desk", floor_id: "4f-research" },
];

// Tables that have real in-memory data; others fall through to no-op.
// Persisted data from .bloks-data/local-db.json takes priority over seeds.
const _persisted = loadPersistedTables();

const localTables: Record<string, Row[]> = {
  characters: _persisted["characters"] ?? [...SEED_CHARACTERS],
  character_runtime_states: _persisted["character_runtime_states"] ?? [...SEED_RUNTIME_STATES],
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

  constructor(tableName: string, rows: Row[]) {
    this.tableName = tableName;
    this.rows = rows;
  }

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
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

    // INSERT
    if (this._pendingInsert !== null) {
      const toInsert = Array.isArray(this._pendingInsert) ? this._pendingInsert : [this._pendingInsert];
      table.push(...toInsert);
      persistTables();
      return { data: null, error: null };
    }

    // UPSERT
    if (this._pendingUpsert !== null) {
      const toUpsert = Array.isArray(this._pendingUpsert) ? this._pendingUpsert : [this._pendingUpsert];
      for (const incoming of toUpsert) {
        const existing = table.find((r) => this.filters.every((f) => f(r)));
        if (existing) {
          Object.assign(existing, incoming);
        } else {
          table.push({ ...incoming });
        }
      }
      persistTables();
      return { data: null, error: null };
    }

    // UPDATE
    if (this._pendingUpdate !== null) {
      const matching = table.filter((r) => this.filters.every((f) => f(r)));
      for (const row of matching) {
        Object.assign(row, this._pendingUpdate);
      }
      persistTables();
      return { data: null, error: null };
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
