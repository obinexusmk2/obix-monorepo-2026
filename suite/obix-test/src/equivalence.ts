/**
 * obix-test / equivalence — the OBIX adapter-equivalence check, reduced to the
 * suite's two projections.
 *
 * A trace is folded three ways:
 *   1. a **direct reference fold** — calls `def.actions[name]` straight, no store
 *   2. `obix-core.toFunc(def).replay` incrementally
 *   3. `obix-core.toClass(def)` by calling generated methods
 *
 * All three states (and all derived values) must match at every step. The
 * direct fold shares no code with the projections, so a bug in the store that
 * both projections ride on is still caught.
 */
import {
  toClass,
  toFunc,
  type ComponentDef,
  type ObixProps,
  type ObixState,
  type Trace,
} from "obix-core";

export interface EquivalenceReport {
  equivalent: boolean;
  steps: number;
  /** state after each step, from the direct reference fold (index 0 = initial) */
  history: unknown[];
  divergences: string[];
}

const eq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function directFold<S extends object, P extends object>(
  def: ComponentDef<S, P>,
  trace: Trace,
  from: S,
  props: P,
): { states: S[]; deriveds: Record<string, unknown>[] } {
  const states: S[] = [from];
  const deriveds: Record<string, unknown>[] = [computeDerived(def, from, props)];
  let cur = from;
  for (const [name, payload] of trace) {
    const fn = def.actions?.[name];
    if (!fn) throw new Error(`equivalence: unknown action "${name}"`);
    cur = fn(cur, payload, props);
    states.push(cur);
    deriveds.push(computeDerived(def, cur, props));
  }
  return { states, deriveds };
}

function computeDerived<S extends object, P extends object>(
  def: ComponentDef<S, P>,
  state: S,
  props: P,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, fn] of Object.entries(def.derived ?? {})) out[k] = fn(state, props);
  return out;
}

export function checkEquivalence<S extends object, P extends object>(
  def: ComponentDef<S, P>,
  options: { trace: Trace; from?: S; props?: Partial<P> } = { trace: [] },
): EquivalenceReport {
  const from = (options.from ?? def.state) as S;
  const props = { ...(def.props ?? {}), ...(options.props ?? {}) } as P;
  const trace = options.trace;
  const divergences: string[] = [];

  const ref = directFold(def, trace, from, props);

  // functional projection — incremental replay
  const F = toFunc(def);
  for (let i = 1; i <= trace.length; i++) {
    const state = F.replay(trace.slice(0, i), from, props);
    if (!eq(state, ref.states[i])) {
      divergences.push(`step ${i}: toFunc ${JSON.stringify(state)} ≠ reference ${JSON.stringify(ref.states[i])}`);
    }
  }

  // class projection — call generated methods
  const instance = new (toClass(def))({ state: from, props });
  for (let i = 0; i < trace.length; i++) {
    const [name, payload] = trace[i]!;
    (instance as unknown as Record<string, (p?: unknown) => unknown>)[name]!(payload);
    if (!eq(instance.state, ref.states[i + 1])) {
      divergences.push(`step ${i + 1}: toClass ${JSON.stringify(instance.state)} ≠ reference ${JSON.stringify(ref.states[i + 1])}`);
    }
    if (!eq(instance.derived(), ref.deriveds[i + 1])) {
      divergences.push(`step ${i + 1}: toClass derived ${JSON.stringify(instance.derived())} ≠ reference ${JSON.stringify(ref.deriveds[i + 1])}`);
    }
  }

  return {
    equivalent: divergences.length === 0,
    steps: trace.length,
    history: ref.states,
    divergences,
  };
}
