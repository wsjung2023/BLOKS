export interface RuntimeSignal {
  workloadScore: number;
  fatigueScore: number;
  burnoutTriggered: boolean;
}

// ── Character level / experience ─────────────────────────────────────────────

const EXP_BASE = 100;
const EXP_FACTOR = 1.4;

export function expRequiredForLevel(level: number): number {
  return Math.floor(EXP_BASE * Math.pow(EXP_FACTOR, level - 1));
}

export function calcTaskExperience(priority: string, hasAiOutput: boolean): number {
  const base: Record<string, number> = {
    P0: 60, P1: 45, P2: 30, P3: 20, P4: 15,
    Critical: 60, High: 45, Medium: 30, Low: 20,
  };
  return Math.round((base[priority] ?? 25) * (hasAiOutput ? 1.2 : 1.0));
}

// ─────────────────────────────────────────────────────────────────────────────

export function deriveRuntimeSignal(workloadScore: number, fatigueScore: number): RuntimeSignal {
  const boundedWorkload = Math.max(0, Math.min(100, workloadScore));
  const boundedFatigue = Math.max(0, Math.min(100, fatigueScore));

  return {
    workloadScore: boundedWorkload,
    fatigueScore: boundedFatigue,
    burnoutTriggered: boundedWorkload >= 85 || boundedFatigue >= 85,
  };
}
