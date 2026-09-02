/**
 * obix-test / mount — headless component harness.
 *
 * No DOM: a `mountForTest` run wraps a real `obix-core` store on a virtual
 * clock and exposes `renderText()` (the `{marker}` text substitution the DOM
 * binder performs) so behaviour and rendered output can be asserted in plain
 * `node:test`.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildScope,
  createStore,
  resolvePath,
  type ComponentDef,
  type ObixProps,
  type ObixState,
  type Store,
} from "obix-core";
import { createVirtualClock, type VirtualClock } from "./virtual-clock.js";

const MARKER = /\{([^{}]+)\}/g;

function stringify(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

function templateSource(def: ComponentDef, override?: string): string {
  if (override != null) return override;
  const t = def.template;
  if (typeof t === "string") return t;
  if (t instanceof URL) {
    return t.protocol === "file:" ? readFileSync(fileURLToPath(t), "utf8") : "";
  }
  return "";
}

export interface MountOptions<S extends object, P extends object> {
  state?: S;
  props?: Partial<P>;
  /** Template string, if the def points at a non-`file:` URL. */
  template?: string;
}

export interface MountedComponent<S extends object, P extends object> {
  readonly store: Store<S, P>;
  readonly state: S;
  readonly clock: VirtualClock;
  dispatch(action: string, payload?: unknown): S;
  /** Advance virtual time, firing due effects. */
  advance(ms: number): void;
  derived(): Record<string, unknown>;
  select(name: string): unknown;
  readonly transitions: number;
  /** The template with `{marker}` text substituted for the current state. */
  renderText(): string;
  stop(): void;
}

export function mountForTest<S extends object, P extends object>(
  def: ComponentDef<S, P>,
  opts: MountOptions<S, P> = {},
): MountedComponent<S, P> {
  const clock = createVirtualClock();
  const template = templateSource(def as ComponentDef, opts.template);
  const store = createStore(def, {
    state: opts.state,
    props: opts.props,
    scheduler: clock.scheduler,
  });

  return {
    store,
    get state() {
      return store.state;
    },
    clock,
    dispatch: (action, payload) => store.dispatch(action, payload),
    advance: (ms) => clock.advance(ms),
    derived: () => store.derived(),
    select: (name) => store.select(name),
    get transitions() {
      return store.revision;
    },
    renderText() {
      const scope = buildScope(store.state, store.props, store.derived());
      return template.replace(MARKER, (_m, path: string) => stringify(resolvePath(scope, path)));
    },
    stop: () => store.destroy(),
  };
}
