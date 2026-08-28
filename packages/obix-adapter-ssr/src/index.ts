/**
 * @obinexusltd/obix-adapter-ssr
 *
 * The SSR projection. DOM-free by construction: this module references no
 * `window`, `document`, `HTMLElement`, `Element`, `Node` or `addEventListener`,
 * and its dependency graph contains no package that does. Purity is a property
 * of the graph, not of a package.json "browser" field
 * (Draft 0.2.1 — Problem 14).
 */
import {
  SCOPE_ATTR,
  UnsupportedFeatureError,
  type DOPArtifact,
  type State,
  type Props,
  type TemplateElement,
  type TemplateNode,
} from "@obinexusltd/obix-spec";

export interface RenderOptions<S extends object, P extends object> {
  state?: S;
  props?: Partial<P>;
}

/** Render a component to an HTML string. No DOM involved. */
export function renderToString<S extends object = State, P extends object = Props>(
  artifact: DOPArtifact<S, P>,
  opts: RenderOptions<S, P> = {},
): string {
  const state = (opts.state ?? artifact.initialState) as S;
  const props = Object.freeze({ ...artifact.props, ...(opts.props ?? {}) }) as P;

  let html: string;
  if (artifact.render) {
    html = artifact.render(state, props);
  } else if (artifact.template) {
    const derived = computeDerived(artifact, state, props);
    html = renderElement(
      artifact.template.root,
      scope(state as Record<string, unknown>, props as Record<string, unknown>, derived),
    );
  } else {
    throw new Error(`[OBIX] renderToString("${artifact.name}"): artifact has neither render() nor a template descriptor`);
  }

  const token = artifact.style?.token;
  if (token && !html.includes(SCOPE_ATTR)) {
    html = `<div ${SCOPE_ATTR}="${token}">${html}</div>`;
  }
  return html;
}

/** Streaming SSR is deferred to Level 1. It does not silently no-op. */
export function renderToStream(): never {
  throw new UnsupportedFeatureError("adapter-ssr.renderToStream", 1);
}

/* --------------------------- internal, DOM-free --------------------------- */

const VOID = new Set(["br", "hr", "img", "input", "meta", "link"]);

function scope(
  state: Record<string, unknown>,
  props: Record<string, unknown>,
  derived: Record<string, unknown>,
): Record<string, unknown> {
  return { ...props, ...state, ...derived };
}

function computeDerived<S extends object, P extends object>(
  artifact: DOPArtifact<S, P>,
  state: S,
  props: P,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, fn] of Object.entries(artifact.derived)) {
    try {
      out[name] = fn(state, props);
    } catch {
      out[name] = undefined;
    }
  }
  return out;
}

function resolve(expr: string, s: Record<string, unknown>): unknown {
  const parts = expr.trim().split(".");
  let cur: unknown = s[parts[0]!];
  for (let i = 1; i < parts.length && cur != null; i++) cur = (cur as Record<string, unknown>)[parts[i]!];
  return cur;
}

function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderElement(el: TemplateElement, s: Record<string, unknown>): string {
  // obix:if
  const cond = el.attrs.find((a) => a.directive === "conditional");
  if (cond && !resolve(cond.value ?? "", s)) return "";

  const attrs: string[] = [];
  for (const a of el.attrs) {
    if (a.directive === "event" || a.directive === "conditional") continue;
    if (a.interpolation != null) {
      const value = resolve(a.interpolation, s);
      if (a.directive === "bool") {
        if (value) attrs.push(a.name);
      } else if (a.directive === "aria") {
        attrs.push(`${a.name}="${value === true ? "true" : value === false ? "false" : escapeHtml(value)}"`);
      } else if (value != null && value !== false) {
        attrs.push(`${a.name}="${value === true ? "" : escapeHtml(value)}"`);
      }
    } else if (a.value === null) {
      attrs.push(a.name);
    } else {
      attrs.push(`${a.name}="${escapeHtml(a.value)}"`);
    }
  }

  const open = `<${el.tag}${attrs.length ? " " + attrs.join(" ") : ""}>`;
  if (VOID.has(el.tag)) return open;

  const inner = el.children.map((c) => renderNode(c, s)).join("");
  return `${open}${inner}</${el.tag}>`;
}

function renderNode(node: TemplateNode, s: Record<string, unknown>): string {
  if (node.kind === "text") return escapeHtml(node.value).replace(/\s+/g, " ");
  if (node.kind === "interpolation") return escapeHtml(resolve(node.expr, s));
  return renderElement(node, s);
}
