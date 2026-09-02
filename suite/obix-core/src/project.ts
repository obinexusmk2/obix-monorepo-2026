/**
 * obix-core / project — the data-oriented adapter, kept as two projections of
 * one `ComponentDef` (the "function ⇄ class" duality from the OBIX talks), now
 * without a compiler: both are thin wrappers over `createStore`.
 *
 *   toFunc(def)  → a closure API (reduce / replay / create)
 *   toClass(def) → a generated OOP class (one method per action, one getter per
 *                  derived)
 *
 * `obix-test.checkEquivalence` folds a trace through both plus a direct
 * reference fold and asserts all three agree, step for step.
 */
import type { ComponentDef, ObixProps, ObixState } from "./spec.js";
import { createStore, type CreateStoreOptions } from "./store.js";

export type Trace = ReadonlyArray<readonly [action: string, payload?: unknown]>;

type ProjOptions<S extends object, P extends object> = Pick<
  CreateStoreOptions<S, P>,
  "state" | "props" | "scheduler"
>;

// ── functional projection ──────────────────────────────────────────────────

export interface FuncInstance<S extends object, P extends object> {
  getState(): S;
  dispatch(action: string, payload?: unknown): S;
  derived(): Record<string, unknown>;
}

export interface FuncProjection<S extends object, P extends object> {
  reduce(state: S, action: string, payload?: unknown, props?: Partial<P>): S;
  replay(trace: Trace, from?: S, props?: Partial<P>): S;
  create(opts?: ProjOptions<S, P>): FuncInstance<S, P>;
}

export function toFunc<S extends object, P extends object>(
  def: ComponentDef<S, P>,
): FuncProjection<S, P> {
  return {
    reduce(state, action, payload, props) {
      const store = createStore(def, { state, props, history: 0, autostart: false });
      return store.dispatch(action, payload);
    },
    replay(trace, from, props) {
      const store = createStore(def, { state: from, props, history: 0, autostart: false });
      let last = store.state;
      for (const [action, payload] of trace) last = store.dispatch(action, payload);
      return last;
    },
    create(opts) {
      const store = createStore(def, { ...opts, autostart: false });
      return {
        getState: () => store.state,
        dispatch: (action, payload) => store.dispatch(action, payload),
        derived: () => store.derived(),
      };
    },
  };
}

// ── class projection ───────────────────────────────────────────────────────

export interface ClassInstance<S extends object> {
  readonly state: S;
  readonly revision: number;
  derived(): Record<string, unknown>;
  [action: string]: unknown;
}

export type ClassProjection<S extends object, P extends object> = new (
  opts?: ProjOptions<S, P>,
) => ClassInstance<S>;

export function toClass<S extends object, P extends object>(
  def: ComponentDef<S, P>,
): ClassProjection<S, P> {
  class Projected {
    #store;
    constructor(opts: ProjOptions<S, P> = {}) {
      this.#store = createStore(def, { ...opts, autostart: false });
    }
    get state(): S {
      return this.#store.state;
    }
    get revision(): number {
      return this.#store.revision;
    }
    derived(): Record<string, unknown> {
      return this.#store.derived();
    }
    /** @internal — used by the generated action methods */
    _dispatch(action: string, payload?: unknown): S {
      return this.#store.dispatch(action, payload);
    }
  }

  for (const action of Object.keys(def.actions ?? {})) {
    Object.defineProperty(Projected.prototype, action, {
      value(this: Projected, payload?: unknown) {
        return (this as unknown as { _dispatch(a: string, p?: unknown): S })._dispatch(action, payload);
      },
      enumerable: false,
      writable: true,
      configurable: true,
    });
  }
  for (const name of Object.keys(def.derived ?? {})) {
    if (name in Projected.prototype) continue;
    Object.defineProperty(Projected.prototype, name, {
      get(this: Projected) {
        return this.derived()[name];
      },
      enumerable: false,
      configurable: true,
    });
  }

  return Projected as unknown as ClassProjection<S, P>;
}
