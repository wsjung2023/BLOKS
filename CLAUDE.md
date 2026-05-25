# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start all apps in dev mode (Turborepo TUI)
pnpm dev

# Build all packages and apps
pnpm build

# Type-check all packages (lint)
pnpm lint

# Run all tests
pnpm test

# Run tests for a single package
pnpm --filter api test
pnpm --filter web test
pnpm --filter worker test

# Database
pnpm db:generate      # regenerate Prisma client after schema change
pnpm db:migrate       # run migrations (dev)
pnpm db:push          # push schema directly (no migration file)
pnpm db:seed          # seed initial data
pnpm db:studio        # open Prisma Studio

# Local infrastructure (Postgres + Redis via Docker)
docker compose up -d

# CI verification (lint + test + smoke)
pnpm verify:ci

# Smoke tests
pnpm smoke:board           # against live API
pnpm smoke:board:fixture   # against local fixtures (no DB needed)

# Progress/spec tooling
pnpm progress:spec
pnpm progress:p1
pnpm progress:report
```

## Architecture Overview

This is a **pnpm + Turborepo monorepo** modelling a "company-as-a-game" simulation — AI characters operate inside a virtual isometric office.

### Apps

| App | Port | Description |
|-----|------|-------------|
| `apps/api` | 4000 | Express REST API, all routes under `/api/v1`, JWT auth (dev bypass or JWT) |
| `apps/web` | 3000 | Next.js 15 frontend; isometric world rendered with PixiJS |
| `apps/worker` | — | BullMQ consumer; processes background jobs from Redis queues |

### Packages

| Package | Description |
|---------|-------------|
| `packages/db` | Local in-memory DB client (`getDb()`) + Prisma ORM. Schema is split across `prisma/schema/*.prisma` files (requires `prismaSchemaFolder` preview feature) |
| `packages/shared` | Shared enums, state machines, ID utilities, and `ApiResponse<T>` envelope type used across all apps |
| `packages/ai-router` | `routeAI()` function — resolves OpenAI model per character profile, enforces `$0.50` per-task budget, falls back to `gpt-4o-mini` on error. MVP is single-provider (OpenAI only) |
| `packages/simulation` | `deriveRuntimeSignal()` — workload/fatigue → burnout flag computation |
| `packages/world` | Isometric grid math (`projectIsoToScreen`, `shadeRgbColor`) shared between web and world canvas |

### Data Flow

```
web (Next.js)
  └─ apiClient.ts → fetch /api/v1/* → apps/api (Express)
                                          ├─ @bloks/db (local in-memory DB)
                                          ├─ BullMQ (Redis) → apps/worker
                                          └─ @bloks/ai-router → OpenAI
```

### Auth

- API uses JWT bearer tokens validated in `apps/api/src/middleware/auth.ts`.
- Web stores tokens in `localStorage` under `BLOKS_AUTH_TOKEN`.
- Dev bypass: set `NEXT_PUBLIC_ENABLE_DEV_BYPASS_AUTH=true` and `NEXT_PUBLIC_DEV_BYPASS_TOKEN` to skip login in development.

### Database

- Primary runtime DB is a **local in-memory store** (accessed via `@bloks/db`'s `getDb()`). Data is persisted to `.bloks-data/local-db.json` on every mutation.
- Prisma is used for schema management and migrations only; it points at a Postgres via `DATABASE_URL`.
- Local dev uses `docker-compose.yml` which runs `pgvector/pgvector:pg16` + Redis 7.

### Queue / Worker

Worker listens on all queue names defined in `@bloks/shared`'s `QUEUE_NAMES`. Each job logs `JobStarted` / `JobCompleted` / `JobFailed` events to the `event_logs` table. Concurrency is controlled by `WORKER_CONCURRENCY` (default 5).

### Environment

Copy `.env.example` to `.env`. Required keys:
- `DATABASE_URL` — Prisma migrations (`postgresql://postgres:postgres@localhost:5432/bloks` for local Docker)
- `OPENAI_API_KEY` — AI tasks
- `REDIS_URL` / `REDIS_HOST` + `REDIS_PORT` — BullMQ queues

## Claude Code Configuration (`.claude/`)

Project-level settings live in `.claude/settings.json`.

**Permissions** — common pnpm/git/docker commands are pre-approved. The following are **blocked**:
- `git push --force` — use normal push
- `pnpm db:push` — use `pnpm db:migrate` instead (preserves migration history)
- `scripts/generate-missing-sprites.py` — Codex already completed all character sprites
- `scripts/remove-floor-characters.py` — floor images already processed

**Hooks**:
- `PreToolUse` → `.claude/hooks/pre-bash-guard.sh` — blocks dangerous Bash commands
- `PostToolUse` → `.claude/hooks/typecheck-on-edit.sh` — runs `tsc --noEmit` after TS edits

**Sprites** — all character sprites are in `apps/web/public/sprites-v2/`. Do NOT regenerate them via AI scripts.
