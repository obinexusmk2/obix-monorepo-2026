/**
 * @obinexusltd/obix-adapter-ssr
 *
 * The SSR projection and the COMPLIANCE REFERENCE for @obinexusltd/obix.
 *
 * DOM-free by construction: this module references no `window`, `document`,
 * `HTMLElement`, `Element`, `Node` or `addEventListener`. Rendering is a pure
 * string fold over the vendored `reduce` (./dop.js).
 *
 * `compliance()` builds the checker that every other projection is measured
 * against: for a given action trace, `data`, `func`, `oop`, `reactive` and
 * `ssr` must all render the identical HTML and reach the identical state.
 *
 * Zero dependencies. Projections are injected, never imported.
 */
import { replay as fold, renderHtml, view } from "./dop.js";
import type { ActionTrace, DOPComponent, RenderView } from "./types.js";

export type {
  ActionContext,
  ActionFn,
  ActionTrace,
  DOPComponent,
  EffectDescriptor,
  RenderView,
  ValidationResult,
} from "./types.js";

export interface RenderOptions<S extends object, P extends object> {
  state?: S;
  props?: Partial<P>;
}

/** Render a component to an HTML string. No DOM involved. */
export function renderToString<S extends object, P extends object = Record<string, unknown>>(
  artifact: DOPComponent<S, P>,
  opts: RenderOptions<S, P> = {},
): string {
  const state = (opts.state ?? artifact.state) as S;
  const props = Object.freeze({ ...(artifact.props ?? {}), ...(opts.props ?? {}) }) as P;
  return renderHtml(artifact, state, props);
}

/** Fold a trace, then render — the server's "final frame". */
export function renderTrace<S extends object, P extends object = Record<string, unknown>>(
  artifact: DOPComponent<S, P>,
  trace: ActionTrace,
  opts: RenderOptions<S, P> = {},
): string {
  const props = Object.freeze({ ...(artifact.props ?? {}), ...(opts.props ?? {}) }) as P;
  const state = fold(artifact, trace, opts.state ?? artifact.state, props);
  return renderHtml(artifact, state, props);
}

export interface ServerDocument<S extends object> {
  name: string;
  html: string;
  state: S;
}

/**
 * A dynamo-style server payload: the rendered HTML plus the exact state it was
 * rendered from, ready to ship to the client for hydration.
 */
export function renderDocument<S extends object, P extends object = Record<string, unknown>>(
  artifact: DOPComponent<S, P>,
  opts: RenderOptions<S, P> & { trace?: ActionTrace } = {},
): ServerDocument<S> {
  const props = Object.freeze({ ...(artifact.props ?? {}), ...(opts.props ?? {}) }) as P;
  const state = opts.trace
    ? fold(artifact, opts.trace, opts.state ?? artifact.state, props)
    : ((opts.state ?? artifact.state) as S);
  return { name: artifact.name, html: renderHtml(artifact, state, props), state };
}

/** Expose the render view (state + props + derived) without rendering. */
export function toView<S extends object, P extends object = Record<string, unknown>>(
  artifact: DOPComponent<S, P>,
  opts: RenderOptions<S, P> = {},
): RenderView<S, P> {
  const props = Object.freeze({ ...(artifact.props ?? {}), ...(opts.props ?? {}) }) as P;
  return view(artifact, (opts.state ?? artifact.state) as S, props);
}

/* ----------------------------- compliance ----------------------------- */

export class ComplianceError extends Error {
  readonly component: string;
  readonly report: ComplianceReport;
  constructor(component: string, report: ComplianceReport) {
    const failed = report.rows.filter((r) => !r.htmlOk || !r.stateOk).map((r) => r.projection);
    super(`[obix] ${component}: projections disagree — ${failed.join(", ")} diverge from ssr`);
    this.name = "ComplianceError";
    this.component = component;
    this.report = report;
  }
}

export interface ComplianceRow {
  projection: string;
  html: string;
  state: unknown;
  htmlOk: boolean;
  stateOk: boolean;
}

export interface ComplianceReport {
  component: string;
  reference: { html: string; state: unknown };
  rows: ComplianceRow[];
  ok: boolean;
}

/** The five projection modules, injected so this package keeps zero imports. */
export interface Projections {
  Data: {
    apply(c: any, s: any, a: string, p?: unknown, props?: any): any;
    replay(c: any, t: ActionTrace, from?: any, props?: any): any;
    render(c: any, s: any, props?: any): string;
  };
  Func: { toFunctional(c: any): { create(o?: any): { dispatch(a: string, p?: unknown): any; getState(): any; render(): string } } };
  OOP: { toOOP(c: any): new (o?: any) => { dispatch(a: string, p?: unknown): any; state: any; render(): string } };
  Reactive: { toReactive(c: any): (o?: any) => { replay(t: ActionTrace): any; state: any; render(): string } };
  SSR: { renderToString(c: any, o?: any): string };
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const ak = Object.keys(a as object);
  const bk = Object.keys(b as object);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/**
 * Build the compliance checker. `@obinexusltd/obix` wires this with the real
 * five projections and re-exports it as `checkCompliance`.
 */
export function compliance(p: Projections) {
  return function checkCompliance<S extends object, P extends object = Record<string, unknown>>(
    artifact: DOPComponent<S, P>,
    trace: ActionTrace = [],
    opts: RenderOptions<S, P> = {},
  ): ComplianceReport {
    const props = { ...(artifact.props ?? {}), ...(opts.props ?? {}) };
    const from = opts.state ?? artifact.state;

    // reference: SSR over the folded state
    const refState = p.Data.replay(artifact, trace, from, props);
    const refHtml = p.SSR.renderToString(artifact, { state: refState, props });

    const rows: ComplianceRow[] = [];

    // data
    {
      let s = from;
      for (const [name, payload] of trace) s = p.Data.apply(artifact, s, name, payload, props);
      rows.push(row("data", p.Data.render(artifact, s, props), s, refHtml, refState));
    }
    // func
    {
      const inst = p.Func.toFunctional(artifact).create({ state: from, props });
      for (const [name, payload] of trace) inst.dispatch(name, payload);
      rows.push(row("func", inst.render(), inst.getState(), refHtml, refState));
    }
    // oop
    {
      const Ctor = p.OOP.toOOP(artifact);
      const inst = new Ctor({ state: from, props });
      for (const [name, payload] of trace) inst.dispatch(name, payload);
      rows.push(row("oop", inst.render(), inst.state, refHtml, refState));
    }
    // reactive
    {
      const inst = p.Reactive.toReactive(artifact)({ state: from, props });
      inst.replay(trace);
      rows.push(row("reactive", inst.render(), inst.state, refHtml, refState));
    }
    // ssr (self)
    rows.push(row("ssr", refHtml, refState, refHtml, refState));

    const report: ComplianceReport = {
      component: artifact.name,
      reference: { html: refHtml, state: refState },
      rows,
      ok: rows.every((r) => r.htmlOk && r.stateOk),
    };
    if (!report.ok) throw new ComplianceError(artifact.name, report);
    return report;
  };

  function row(
    projection: string,
    html: string,
    state: unknown,
    refHtml: string,
    refState: unknown,
  ): ComplianceRow {
    return { projection, html, state, htmlOk: html === refHtml, stateOk: deepEqual(state, refState) };
  }
}

