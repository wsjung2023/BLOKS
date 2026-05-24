import { describe, expect, it } from "vitest";
import {
  TaskState,
  TASK_TRANSITIONS,
  ProjectState,
  PROJECT_TRANSITIONS,
} from "@bloks/shared";

// ── TASK state machine ────────────────────────────────────────────────────────

describe("TASK_TRANSITIONS", () => {
  it("covers every TaskState key", () => {
    const defined = Object.keys(TASK_TRANSITIONS);
    const all = Object.values(TaskState) as string[];
    expect(defined.sort()).toEqual(all.sort());
  });

  it("all target states are valid TaskState values", () => {
    const valid = new Set<string>(Object.values(TaskState));
    for (const [from, targets] of Object.entries(TASK_TRANSITIONS)) {
      for (const to of targets) {
        expect(valid.has(to), `${from} → ${to} is not a valid TaskState`).toBe(true);
      }
    }
  });

  it("terminal states have no outgoing transitions", () => {
    expect(TASK_TRANSITIONS[TaskState.Done]).toEqual([]);
    expect(TASK_TRANSITIONS[TaskState.Cancelled]).toEqual([]);
  });

  it("Backlog → Todo is allowed", () => {
    expect(TASK_TRANSITIONS[TaskState.Backlog]).toContain(TaskState.Todo);
  });

  it("Todo → InProgress is allowed", () => {
    expect(TASK_TRANSITIONS[TaskState.Todo]).toContain(TaskState.InProgress);
  });

  it("InProgress → InReview is allowed", () => {
    expect(TASK_TRANSITIONS[TaskState.InProgress]).toContain(TaskState.InReview);
  });

  it("InReview → Done is allowed", () => {
    expect(TASK_TRANSITIONS[TaskState.InReview]).toContain(TaskState.Done);
  });

  it("InReview → Todo (rework) is allowed", () => {
    expect(TASK_TRANSITIONS[TaskState.InReview]).toContain(TaskState.Todo);
  });

  it("Backlog → Done directly is NOT allowed", () => {
    expect(TASK_TRANSITIONS[TaskState.Backlog]).not.toContain(TaskState.Done);
  });

  it("Done → any is NOT allowed", () => {
    expect(TASK_TRANSITIONS[TaskState.Done]).toHaveLength(0);
  });

  it("Blocked can return to Todo", () => {
    expect(TASK_TRANSITIONS[TaskState.Blocked]).toContain(TaskState.Todo);
  });
});

// ── PROJECT state machine ─────────────────────────────────────────────────────

describe("PROJECT_TRANSITIONS", () => {
  it("covers every ProjectState key", () => {
    const defined = Object.keys(PROJECT_TRANSITIONS);
    const all = Object.values(ProjectState) as string[];
    expect(defined.sort()).toEqual(all.sort());
  });

  it("all target states are valid ProjectState values", () => {
    const valid = new Set<string>(Object.values(ProjectState));
    for (const [from, targets] of Object.entries(PROJECT_TRANSITIONS)) {
      for (const to of targets) {
        expect(valid.has(to), `${from} → ${to} is not a valid ProjectState`).toBe(true);
      }
    }
  });

  it("terminal states have no outgoing transitions", () => {
    expect(PROJECT_TRANSITIONS[ProjectState.Archived]).toEqual([]);
    expect(PROJECT_TRANSITIONS[ProjectState.Cancelled]).toEqual([]);
  });

  it("Idea → Intake is allowed", () => {
    expect(PROJECT_TRANSITIONS[ProjectState.Idea]).toContain(ProjectState.Intake);
  });

  it("InExecution → Review is allowed", () => {
    expect(PROJECT_TRANSITIONS[ProjectState.InExecution]).toContain(ProjectState.Review);
  });

  it("Released → Released directly is NOT allowed", () => {
    expect(PROJECT_TRANSITIONS[ProjectState.Released]).not.toContain(ProjectState.Released);
  });

  it("Idea → Released directly is NOT allowed", () => {
    expect(PROJECT_TRANSITIONS[ProjectState.Idea]).not.toContain(ProjectState.Released);
  });
});
