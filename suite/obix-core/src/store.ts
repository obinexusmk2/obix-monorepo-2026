/**
 * obix-core / store — the data-oriented state container.
 *
 * State is plain data. Actions are pure `(state, payload, props) => state`.
 * Derived values are pure projections, recomputed on demand. Effects are
 * declarative intervals whose `while` predicate is re-checked after every tick
 * and every dispatch; a false predicate clears the interval (ported from the
 * frozen `obix-effects` scheduler — Draft 0.2.1 Problem 9).
 */
import type {
  ComponentDef,
  ObixLifecycle,
  ObixProps,
  ObixState,
} from "./spec.js";

export interface StoreChange<S> {
  action: string;
  payload: unknown;
  state: S;
  prev: S;
  revision: number;
}

export type Subscriber<S> = (state: S, prev: S, change: StoreChange<S>) => void;

/** Injectable timer surface so tests can drive effects with virtual time. */
export interface Scheduler {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

const realScheduler: Scheduler = {
  setInterval: (fn, ms) => (globalThis as typeof globalThis).setInterval(fn, ms),
  clearInterval: (h) => (globalThis as typeof globalThis).clearInterval(h as never),
};

export interface CreateStoreOptions<S, P> {
  /** Override the def's initial state. */
  state?: S;
  /** Override / extend the def's default props. */
  props?: Partial<P>;
  /** Timer surface. Defaults to real `setInterval` / `clearInterval`. */
  scheduler?: Scheduler;
  /** Max revisions retained for `undo()`. Default 50; `0` disables history. */
  history?: number;
  /** Arm declared effects immediately. Default `true`. */
  autostart?: boolean;
}

export interface Store<S extends object, P extends object> {
  readonly state: S;
  readonly props: P;
  readonly revision: number;
  readonly lifecycle: ObixLifecycle;
  /** Run an action. Unknown action name throws. Returns the resulting state. */
  dispatch(action: string, payload?: unknown): S;
  /** All derived values for the current state, computed fresh. */
  derived(): Record<string, unknown>;
  /** One derived value by name (or `undefined`). */
  select(name: string): unknown;
  /** Subscribe to post-change notifications. Returns an unsubscribe fn. */
  subscribe(fn: Subscriber<S>): () => void;
  /** Retained state history, oldest first (current state not included). */
  revisions(): readonly S[];
  /** Step back one revision. No-op (returns current) when history is empty. */
  undo(): S;
  /** Pause effects. `lifecycle → "halted"`. */
  halt(): void;
  /** Re-arm effects after `halt()`. `lifecycle → "resumed"`. */
  resume(): void;
  /** Clear effects and drop all subscribers. `lifecycle → "destroyed"`. */
  destroy(): void;
}

const freeze = <T>(v: T): T =>
  v && typeof v === "object" ? Object.freeze(v) : v;

export function createStore<S extends object, P extends object>(
  def: ComponentDef<S, P>,
  opts: CreateStoreOptions<S, P> = {},
): Store<S, P> {
  const scheduler = opts.scheduler ?? realScheduler;
  const historyCap = opts.history ?? 50;

  const props = freeze({ ...(def.props ?? {}), ...(opts.props ?? {}) }) as P;
  let state = freeze({ ...(opts.state ?? def.state) }) as S;
  let revision = 0;
  let lifecycle: ObixLifecycle = "created";

  const history: S[] = [];
  const subscribers = new Set<Subscriber<S>>();
  const armed = new Map<string, unknown>();

  // ── effects ───────────────────────────────────────────────────────────────
  const effects = def.effects ?? {};

  const clearEffect = (name: string): void => {
    if (armed.has(name)) {
      scheduler.clearInterval(armed.get(name));
      armed.delete(name);
    }
  };
  const clearAllEffects = (): void => {
    for (const name of [...armed.keys()]) clearEffect(name);
  };

  const armEffects = (): void => {
    if (lifecycle === "halted" || lifecycle === "destroyed") return;
    for (const [name, effect] of Object.entries(effects)) {
      if (armed.has(name)) continue;
      if (effect.while && !effect.while(state, props)) continue;
      const handle = scheduler.setInterval(() => {
        if (effect.while && !effect.while(state, props)) {
          clearEffect(name);
          return;
        }
        dispatch(effect.dispatch, effect.payload);
      }, effect.every);
      armed.set(name, handle);
    }
  };

  // ── core ──────────────────────────────────────────────────────────────────
  function derived(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [name, fn] of Object.entries(def.derived ?? {})) {
      out[name] = fn(state, props);
    }
    return out;
  }

  function dispatch(action: string, payload?: unknown): S {
    const fn = def.actions?.[action];
    if (!fn) throw new Error(`obix-core: unknown action "${action}"`);
    const prev = state;
    const next = fn(prev, payload, props);
    if (next === prev) return state; // referential no-op

    if (historyCap > 0) {
      history.push(prev);
      if (history.length > historyCap) history.shift();
    }
    state = freeze(next) as S;
    revision += 1;
    if (lifecycle === "created" || lifecycle === "resumed") lifecycle = "updated";

    const change: StoreChange<S> = { action, payload, state, prev, revision };
    for (const sub of [...subscribers]) sub(state, prev, change);

    // a transition may flip a `while` predicate either way
    armEffects();
    for (const [name, effect] of Object.entries(effects)) {
      if (armed.has(name) && effect.while && !effect.while(state, props)) clearEffect(name);
    }
    return state;
  }

  if (opts.autostart !== false) armEffects();

  return {
    get state() {
      return state;
    },
    get props() {
      return props;
    },
    get revision() {
      return revision;
    },
    get lifecycle() {
      return lifecycle;
    },
    dispatch,
    derived,
    select(name) {
      return def.derived?.[name]?.(state, props);
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    revisions() {
      return history.slice();
    },
    undo() {
      const prev = history.pop();
      if (prev === undefined) return state;
      const from = state;
      state = freeze(prev) as S;
      revision += 1;
      for (const sub of [...subscribers]) {
        sub(state, from, { action: "@undo", payload: undefined, state, prev: from, revision });
      }
      armEffects();
      return state;
    },
    halt() {
      clearAllEffects();
      lifecycle = "halted";
    },
    resume() {
      if (lifecycle === "destroyed") return;
      lifecycle = "resumed";
      armEffects();
    },
    destroy() {
      clearAllEffects();
      subscribers.clear();
      lifecycle = "destroyed";
    },
  };
}
