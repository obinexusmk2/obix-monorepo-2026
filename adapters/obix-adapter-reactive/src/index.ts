/**
 * @obinexusltd/obix-adapter-reactive
 *
 * The Reactive projection: current state, frozen props, subscribers, changed
 * keys, and an effects lifecycle. Transitions run through the vendored `reduce`
 * (./dop.js). Effects consume state/props but never own business logic — the
 * scheduler just re-checks the declared `while(state, props)` predicate and
 * dispatches an existing action.
 *
 * Zero dependencies (the interval scheduler is vendored below).
 */
import { changedKeys, reduce, renderHtml, validate as validateState } from "./dop.js";
import type { ActionTrace, DOPComponent, ValidationResult } from "./types.js";

export type {
  ActionContext,
  ActionFn,
  ActionTrace,
  DOPComponent,
  EffectDescriptor,
  RenderView,
  ValidationResult,
} from "./types.js";

export interface TransitionMeta<S extends object> {
  action: string;
  payload?: unknown;
  from: S;
  to: S;
  changedKeys: string[];
}

export type Subscriber<S extends object> = (next: S, prev: S, meta: TransitionMeta<S>) => void;

export interface Clock {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export const defaultClock: Clock = {
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (handle) => clearInterval(handle),
};

export interface ReactiveInstance<S extends object, P extends object> {
  readonly state: S;
  readonly props: P;
  readonly transitions: number;
  readonly activeEffects: number;
  dispatch(actionName: string, payload?: unknown): S;
  replay(trace: ActionTrace): S;
  subscribe(fn: Subscriber<S>): () => void;
  render(): string;
  validate(): ValidationResult;
  startEffects(clock?: Clock): void;
  stopEffects(): void;
}

export type ReactiveFactory<S extends object, P extends object> = (opts?: {
  state?: S;
  props?: Partial<P>;
}) => ReactiveInstance<S, P>;

export function toReactive<S extends object, P extends object = Record<string, unknown>>(
  artifact: DOPComponent<S, P>,
): ReactiveFactory<S, P> {
  return function create(opts: { state?: S; props?: Partial<P> } = {}): ReactiveInstance<S, P> {
    let current: S = opts.state ?? artifact.state;
    let transitions = 0;
    const props = Object.freeze({ ...(artifact.props ?? {}), ...(opts.props ?? {}) }) as P;
    const subscribers = new Set<Subscriber<S>>();
    const handles: unknown[] = [];
    let clock: Clock | undefined;

    const dispatch = (actionName: string, payload?: unknown): S => {
      const prev = current;
      const next = reduce(artifact, prev, actionName, payload, props);
      current = next;
      transitions++;
      const meta: TransitionMeta<S> = {
        action: actionName,
        payload,
        from: prev,
        to: next,
        changedKeys: changedKeys(prev, next),
      };
      for (const fn of subscribers) fn(next, prev, meta);
      return next;
    };

    return {
      get state() {
        return current;
      },
      get props() {
        return props;
      },
      get transitions() {
        return transitions;
      },
      get activeEffects() {
        return handles.length;
      },
      dispatch,
      replay(trace) {
        for (const [name, payload] of trace) dispatch(name, payload);
        return current;
      },
      subscribe(fn) {
        subscribers.add(fn);
        return () => subscribers.delete(fn);
      },
      render: () => renderHtml(artifact, current, props),
      validate: () => validateState(artifact, current, props),
      startEffects(nextClock: Clock = defaultClock) {
        if (clock) return;
        clock = nextClock;
        for (const desc of Object.values(artifact.effects ?? {})) {
          const handle = clock.setInterval(() => {
            if (desc.while(current, props)) dispatch(desc.dispatch);
          }, desc.everyMs);
          handles.push(handle);
        }
      },
      stopEffects() {
        for (const handle of handles.splice(0)) clock?.clearInterval(handle);
        clock = undefined;
      },
    };
  };
}
