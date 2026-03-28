export const SNAPSHOT_MIN_INTERVAL_MS = 2_000;
export const SNAPSHOT_MAX_INTERVAL_MS = 5_000;

export function normalizeSnapshotInterval(ms = 3_000): number {
  return Math.max(SNAPSHOT_MIN_INTERVAL_MS, Math.min(SNAPSHOT_MAX_INTERVAL_MS, ms));
}

export function createSnapshotPoller(
  callback: () => void | Promise<void>,
  intervalMs = 3_000
): { start: () => void; stop: () => void } {
  const tickMs = normalizeSnapshotInterval(intervalMs);
  let timer: ReturnType<typeof setInterval> | null = null;

  return {
    start: () => {
      if (timer) return;
      void callback();
      timer = setInterval(() => {
        void callback();
      }, tickMs);
    },
    stop: () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    },
  };
}
