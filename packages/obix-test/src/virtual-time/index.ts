/**
 * Deterministic virtual time for behavioural tests. Thin wrapper over
 * obix-effects.createVirtualClock + the reactive projection's effects lifecycle.
 */
import { createVirtualClock } from "@obinexusltd/obix-effects";
import { toReactive } from "@obinexusltd/obix-adapter-reactive";
import type { DOPArtifact, State, Props } from "@obinexusltd/obix-spec";

export { createVirtualClock } from "@obinexusltd/obix-effects";

export interface VirtualRun<S extends object, P extends object> {
  readonly state: S;
  readonly transitions: number;
  dispatch(action: string, payload?: unknown): void;
  advance(ms: number): void;
  stop(): void;
}

/**
 * Start a reactive instance with a virtual clock driving its `every` effects.
 * `advance(ms)` fires due ticks and re-checks the `while` predicate — exactly
 * the Level 0 quiescence model (Problem 9).
 */
export function runWithVirtualTime<S extends object = State, P extends object = Props>(
  artifact: DOPArtifact<S, P>,
  opts: { state?: S; props?: Partial<P> } = {},
): VirtualRun<S, P> {
  const vc = createVirtualClock();
  const inst = toReactive(artifact)(opts);
  inst.startEffects(vc.clock);
  return {
    get state() {
      return inst.state;
    },
    get transitions() {
      return inst.transitions;
    },
    dispatch: (action, payload) => void inst.dispatch(action, payload),
    advance: (ms) => vc.advance(ms),
    stop: () => inst.stopEffects(),
  };
}
