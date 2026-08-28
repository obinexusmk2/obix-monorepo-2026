/**
 * @obinexusltd/obix-effects
 *
 * Scheduler primitives for OBIX effects. State-machine agnostic: the scheduler
 * re-evaluates a declared `while(state, props)` predicate after transitions and
 * stops when it becomes false. It has NO knowledge of component semantics and
 * there is no `quiesces` language feature (Draft 0.2.1 — Problem 9).
 *
 * Level 0: `every` is operational. `after` / `on` throw UnsupportedFeatureError.
 */
import { UnsupportedFeatureError, type EffectDescriptor } from "@obinexusltd/obix-spec";
import { defaultClock, type Clock } from "./clock.js";

export { defaultClock, createVirtualClock } from "./clock.js";
export type { Clock, VirtualClock } from "./clock.js";
export { UnsupportedFeatureError } from "@obinexusltd/obix-spec";

/** An effect descriptor plus the runtime predicate/handler the scheduler needs. */
export interface RuntimeEffect extends EffectDescriptor {
  while?: (state: unknown, props: unknown) => boolean;
}

export interface Scheduler {
  every(name: string, ms: number, whileFn: () => boolean, onTick: () => void): void;
  after(name: string, ms: number, run: () => void): never;
  on(name: string, event: string, run: () => void): never;
  start(): void;
  stop(name: string): void;
  stopAll(): void;
  readonly activeCount: number;
  readonly registeredCount: number;
}

/**
 * Create a scheduler bound to a clock (real by default, virtual in tests).
 * `every` registers a repeating effect; on each firing the predicate is
 * checked first — false clears the interval, true runs `onTick`.
 */
export function createScheduler(clock: Clock = defaultClock): Scheduler {
  const registry = new Map<string, { ms: number; whileFn: () => boolean; onTick: () => void }>();
  const handles = new Map<string, unknown>();

  const stop = (name: string) => {
    if (handles.has(name)) {
      clock.clearInterval(handles.get(name));
      handles.delete(name);
    }
  };

  return {
    every(name, ms, whileFn, onTick) {
      if (registry.has(name)) throw new Error(`[OBIX] effect "${name}" is already registered`);
      registry.set(name, { ms, whileFn, onTick });
    },
    after(name) {
      throw new UnsupportedFeatureError(`effects.after("${name}")`, 1);
    },
    on(name) {
      throw new UnsupportedFeatureError(`effects.on("${name}")`, 1);
    },
    start() {
      // Schedule every registered effect. The interval callback checks the
      // predicate first and clears itself when it goes false — so an effect
      // that is armed before its start condition becomes true still runs.
      for (const [name, e] of registry) {
        if (handles.has(name)) continue;
        const h = clock.setInterval(() => {
          if (!e.whileFn()) {
            stop(name);
            return;
          }
          e.onTick();
        }, e.ms);
        handles.set(name, h);
      }
    },
    stop,
    stopAll() {
      for (const name of [...handles.keys()]) stop(name);
    },
    get activeCount() {
      return handles.size;
    },
    get registeredCount() {
      return registry.size;
    },
  };
}

const IDENT = /^!?\s*[A-Za-z_$][\w$]*$/;

/**
 * Evaluate a Level 0 `while` predicate expressed as source text. Supports a
 * single identifier or its negation (`running`, `!running`). Anything richer
 * should be supplied as a real function on the RuntimeEffect instead.
 */
export function evaluateWhile(
  expr: string | undefined,
  state: Record<string, unknown>,
  props: Record<string, unknown>,
): boolean {
  if (!expr) return false;
  const arrow = expr.match(/=>\s*(.+?)\s*$/);
  const body = (arrow ? arrow[1]! : expr).trim().replace(/[();]/g, "");
  if (!IDENT.test(body)) {
    throw new UnsupportedFeatureError(`effects.while predicate "${expr}" (Level 0: single identifier or its negation)`, 1);
  }
  const negate = body.startsWith("!");
  const key = body.replace(/^!/, "").trim();
  const scope = { ...props, ...state } as Record<string, unknown>;
  const value = Boolean(scope[key]);
  return negate ? !value : value;
}
