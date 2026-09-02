/**
 * obix-core / spec — the single source of truth for the suite's public types
 * plus a few runtime guards. No framework, no `.obix` file: an OBIX component is
 * a plain object (`ComponentDef`) authored in standard TypeScript, paired with a
 * standard `.html` template and `.css` stylesheet.
 */

export const SUITE_VERSION = "0.3.0";

/** JSON-shaped data. State and props must be structurally plain. */
export type Plain =
  | null
  | boolean
  | number
  | string
  | readonly Plain[]
  | { readonly [key: string]: Plain };

/**
 * Default shapes for state / props. The generic entry points constrain with
 * `extends object` (so a plain `interface Foo { … }` is accepted) and fall back
 * to these when no type argument is given.
 */
export type ObixState = Record<string, unknown>;
export type ObixProps = Record<string, unknown>;

/**
 * A pure state transition. It must not mutate `state`; it returns the next
 * state, or the **same reference** to signal a no-op (the store then skips the
 * notification and does not bump the revision).
 */
export type ObixAction<S, P> = (state: S, payload: unknown, props: P) => S;
export type ObixActions<S, P> = Record<string, ObixAction<S, P>>;

/** A pure projection of state (+ props). Recomputed on demand; never mutates. */
export type ObixDerived<S, P> = (state: S, props: P) => unknown;
export type ObixDeriveds<S, P> = Record<string, ObixDerived<S, P>>;

/**
 * A declarative repeating effect. The scheduler re-checks `while` after every
 * tick (and after every dispatch) and clears its own interval when it is false —
 * so an effect quiesces without the component knowing the scheduler exists.
 */
export interface ObixEffect<S, P> {
  /** Interval in milliseconds. */
  every: number;
  /** Keep running while this predicate holds. Absent ⇒ always runs. */
  while?: (state: S, props: P) => boolean;
  /** Action to dispatch on each tick. */
  dispatch: string;
  /** Optional payload passed to that action. */
  payload?: unknown;
}
export type ObixEffects<S, P> = Record<string, ObixEffect<S, P>>;

export type ObixLifecycle = "created" | "updated" | "halted" | "resumed" | "destroyed";

/**
 * The whole definition of an OBIX component. `template` / `styles` are either an
 * inline string or a `URL` to a sibling `.html` / `.css` file (fetched once on
 * mount in the browser; inlined by `obix build`).
 */
export interface ComponentDef<
  S extends object = ObixState,
  P extends object = ObixProps,
> {
  /** Custom-element tag. Must contain a hyphen (HTML requirement). */
  tag: string;
  /** Default props. Per-instance overrides come from attributes / properties. */
  props?: P;
  /** Initial state. */
  state: S;
  actions?: ObixActions<S, P>;
  derived?: ObixDeriveds<S, P>;
  effects?: ObixEffects<S, P>;
  template?: string | URL;
  styles?: string | URL;
  /**
   * Attributes reflected into props. Defaults to every key of `props`,
   * kebab-cased (`limitSeconds` ⇒ `limit-seconds`).
   */
  observedAttributes?: (keyof P & string)[];
}

export interface Diagnostic {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
}

// ── guards ──────────────────────────────────────────────────────────────────

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== "object" || v === null) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/** Throws a `TypeError` with a precise path if `def` is not a usable ComponentDef. */
export function assertComponentDef(def: unknown): asserts def is ComponentDef {
  if (!isPlainObject(def)) throw new TypeError("ComponentDef must be a plain object");
  const d = def as Record<string, unknown>;
  if (typeof d["tag"] !== "string" || !d["tag"].includes("-")) {
    throw new TypeError(`ComponentDef.tag must be a hyphenated string, got ${JSON.stringify(d["tag"])}`);
  }
  if (!isPlainObject(d["state"])) throw new TypeError("ComponentDef.state must be a plain object");
  for (const key of ["actions", "derived", "effects"] as const) {
    if (d[key] !== undefined && !isPlainObject(d[key])) {
      throw new TypeError(`ComponentDef.${key} must be a plain object when present`);
    }
  }
}

/** `camelCase` / `PascalCase` ⇒ `kebab-case`. */
export function kebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}
