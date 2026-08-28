/** Minimal clock abstraction so effects are environment-agnostic and testable. */
export interface Clock {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

const g = globalThis as unknown as {
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (h: unknown) => void;
};

export const defaultClock: Clock = {
  setInterval: (fn, ms) => g.setInterval(fn, ms),
  clearInterval: (h) => g.clearInterval(h),
};

export interface VirtualClock {
  readonly clock: Clock;
  advance(ms: number): void;
  readonly now: number;
}

/** Deterministic clock for tests — no real timers. */
export function createVirtualClock(): VirtualClock {
  let now = 0;
  let seq = 1;
  const timers = new Map<number, { at: number; every: number; fn: () => void }>();

  const clock: Clock = {
    setInterval(fn, ms) {
      const id = seq++;
      timers.set(id, { at: now + ms, every: Math.max(1, ms), fn });
      return id;
    },
    clearInterval(handle) {
      timers.delete(handle as number);
    },
  };

  return {
    clock,
    get now() {
      return now;
    },
    advance(ms: number) {
      const target = now + ms;
      let guard = 0;
      while (guard++ < 1_000_000) {
        let dueId = -1;
        let dueAt = Infinity;
        for (const [id, t] of timers) {
          if (t.at <= target && t.at < dueAt) {
            dueAt = t.at;
            dueId = id;
          }
        }
        if (dueId === -1) break;
        const t = timers.get(dueId)!;
        now = t.at;
        t.fn();
        if (timers.has(dueId)) t.at += t.every;
      }
      now = target;
    },
  };
}
