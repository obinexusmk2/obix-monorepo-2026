/**
 * obix-test / virtual-clock — deterministic time for effect tests.
 * Ported from the frozen `obix-effects` clock; shape matches `obix-core`'s
 * `Scheduler` so it drops straight into `createStore({ scheduler })`.
 */
import type { Scheduler } from "obix-core";

export interface VirtualClock {
  readonly scheduler: Scheduler;
  readonly now: number;
  /** Advance time by `ms`, firing every interval that comes due. */
  advance(ms: number): void;
}

export function createVirtualClock(): VirtualClock {
  let now = 0;
  let seq = 1;
  const timers = new Map<number, { at: number; every: number; fn: () => void }>();

  const scheduler: Scheduler = {
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
    scheduler,
    get now() {
      return now;
    },
    advance(ms) {
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
