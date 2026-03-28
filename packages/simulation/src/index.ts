export interface RuntimeSignal {
  workloadScore: number;
  fatigueScore: number;
  burnoutTriggered: boolean;
}

export function deriveRuntimeSignal(workloadScore: number, fatigueScore: number): RuntimeSignal {
  const boundedWorkload = Math.max(0, Math.min(100, workloadScore));
  const boundedFatigue = Math.max(0, Math.min(100, fatigueScore));

  return {
    workloadScore: boundedWorkload,
    fatigueScore: boundedFatigue,
    burnoutTriggered: boundedWorkload >= 85 || boundedFatigue >= 85,
  };
}
