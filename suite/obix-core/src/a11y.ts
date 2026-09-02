/**
 * obix-core / a11y — dev-time accessibility audit.
 *
 * OBIX treats accessibility as part of correctness (FUD mitigation). The rules
 * are ported from the frozen `obix-accessibility` analyzer, but run over a
 * template **string** (`auditHtml`, used by `obix check`) or a live shadow root
 * (`auditRoot`, used by `ObixElement` in dev) — never over a bespoke AST.
 */
import type { Diagnostic } from "./spec.js";

const LIVE_VALUES = new Set(["polite", "assertive", "off"]);
const KNOWN_ROLES = new Set([
  "button", "link", "timer", "status", "alert", "log", "region", "group",
  "list", "listitem", "navigation", "main", "banner", "contentinfo",
  "heading", "form", "search", "dialog", "note", "presentation", "none",
  "tab", "tablist", "tabpanel", "menu", "menuitem", "checkbox", "radio",
  "switch", "progressbar", "tooltip", "separator", "img",
]);
const KNOWN_ARIA = new Set([
  "aria-live", "aria-atomic", "aria-relevant", "aria-busy",
  "aria-label", "aria-labelledby", "aria-describedby",
  "aria-hidden", "aria-disabled", "aria-pressed", "aria-expanded",
  "aria-checked", "aria-current", "aria-controls", "aria-selected",
  "aria-invalid", "aria-required", "aria-valuenow", "aria-valuemin",
  "aria-valuemax", "aria-valuetext", "aria-orientation", "aria-haspopup",
  "aria-modal", "aria-multiselectable", "aria-readonly", "aria-level",
  "aria-roledescription", "aria-keyshortcuts", "aria-placeholder",
]);
const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

const err = (code: string, message: string): Diagnostic => ({ code, message, severity: "error" });
const warn = (code: string, message: string): Diagnostic => ({ code, message, severity: "warning" });

export const A11Y_CODES = {
  LIVE_REGION_INVALID: "OBIX-A001",
  UNKNOWN_ROLE: "OBIX-A005",
  UNKNOWN_ARIA_ATTR: "OBIX-A006",
  FOCUS_POLICY: "OBIX-A003",
  HEADING_SKIP: "OBIX-A004",
  NO_ACCESSIBLE_NAME: "OBIX-A007",
} as const;

/** Minimal per-element view both entry points reduce to. */
interface ElView {
  tag: string;
  attr(name: string): string | null;
  hasAttr(name: string): boolean;
  attrNames(): string[];
  /** Trimmed visible text directly inside the element (best effort). */
  text(): string;
}

function isInterpolated(value: string | null): boolean {
  return value != null && /\{[^{}]+\}/.test(value);
}

function checkElement(el: ElView, headingRun: number[], out: Diagnostic[]): void {
  const role = el.attr("role");
  if (role && !isInterpolated(role) && !KNOWN_ROLES.has(role)) {
    out.push(warn(A11Y_CODES.UNKNOWN_ROLE, `unknown role "${role}" on <${el.tag}>`));
  }

  for (const name of el.attrNames()) {
    if (name.startsWith("aria-") && !KNOWN_ARIA.has(name)) {
      out.push(warn(A11Y_CODES.UNKNOWN_ARIA_ATTR, `unknown ARIA attribute "${name}" on <${el.tag}>`));
    }
  }

  const live = el.attr("aria-live");
  if (live != null && !isInterpolated(live) && !LIVE_VALUES.has(live)) {
    out.push(err(A11Y_CODES.LIVE_REGION_INVALID, `aria-live="${live}" is invalid — use polite | assertive | off`));
  }

  if (el.tag === "a" && !el.hasAttr("href")) {
    out.push(warn(A11Y_CODES.FOCUS_POLICY, `<a> without href is not focusable — use <button>`));
  }

  const tabindex = el.attr("tabindex");
  if (tabindex != null && !isInterpolated(tabindex)) {
    const n = Number(tabindex);
    if (Number.isFinite(n) && n > 0) {
      out.push(warn(A11Y_CODES.FOCUS_POLICY, `tabindex="${tabindex}" > 0 disrupts tab order`));
    } else if (n < -1) {
      out.push(err(A11Y_CODES.FOCUS_POLICY, `tabindex="${tabindex}" is invalid`));
    }
  }

  const named =
    el.hasAttr("aria-label") ||
    el.hasAttr("aria-labelledby") ||
    el.hasAttr("title") ||
    el.text().length > 0;
  if ((el.tag === "button" || (el.tag === "a" && el.hasAttr("href"))) && !named) {
    out.push(warn(A11Y_CODES.NO_ACCESSIBLE_NAME, `<${el.tag}> has no accessible name (text, aria-label, or title)`));
  }

  if (HEADINGS.has(el.tag)) {
    const level = Number(el.tag.slice(1));
    const last = headingRun[headingRun.length - 1];
    if (last !== undefined && level - last > 1) {
      out.push(err(A11Y_CODES.HEADING_SKIP, `heading jumps from h${last} to h${level}`));
    }
    headingRun.push(level);
  }
}

// ── string entry point (obix check) ─────────────────────────────────────────

const TAG = /<([a-zA-Z][\w-]*)((?:\s+[^<>]*?)?)\s*\/?>/g;
const ATTR = /([a-zA-Z_:][-\w:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;

/** Audit a template string. Used by `obix check`; no DOM required. */
export function auditHtml(html: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  const headingRun: number[] = [];
  const stripped = html.replace(/<!--[\s\S]*?-->/g, "");

  let m: RegExpExecArray | null;
  TAG.lastIndex = 0;
  while ((m = TAG.exec(stripped)) !== null) {
    const tag = m[1]!.toLowerCase();
    if (tag === "script" || tag === "style") continue;
    const attrSrc = m[2] ?? "";
    const map = new Map<string, string>();
    let a: RegExpExecArray | null;
    ATTR.lastIndex = 0;
    while ((a = ATTR.exec(attrSrc)) !== null) {
      if (!a[1]) continue;
      map.set(a[1].toLowerCase(), a[2] ?? a[3] ?? a[4] ?? "");
    }
    // best-effort inner text: from tag end to the matching close tag
    const after = stripped.slice(TAG.lastIndex);
    const close = after.search(new RegExp(`</${tag}\\b`, "i"));
    const inner = close >= 0 ? after.slice(0, close) : "";
    const text = inner.replace(/<[^>]*>/g, "").replace(/\{[^{}]+\}/g, "x").trim();

    const view: ElView = {
      tag,
      attr: (n) => (map.has(n) ? map.get(n)! : null),
      hasAttr: (n) => map.has(n),
      attrNames: () => [...map.keys()],
      text: () => text,
    };
    checkElement(view, headingRun, out);
  }
  return out;
}

// ── DOM entry point (ObixElement dev audit) ─────────────────────────────────

interface DomElement {
  tagName: string;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  getAttributeNames(): string[];
  textContent: string | null;
  children: ArrayLike<DomElement>;
}
interface DomRoot {
  querySelectorAll(sel: string): ArrayLike<DomElement>;
}

/** Audit a live root (shadow root or element). Used by `ObixElement` in dev. */
export function auditRoot(root: DomRoot): Diagnostic[] {
  const out: Diagnostic[] = [];
  const headingRun: number[] = [];
  const els = root.querySelectorAll("*");
  for (let i = 0; i < els.length; i++) {
    const el = els[i]!;
    const directText = Array.from(el.children).reduce(
      (t, c) => t.replace(c.textContent ?? "", ""),
      el.textContent ?? "",
    );
    const view: ElView = {
      tag: el.tagName.toLowerCase(),
      attr: (n) => el.getAttribute(n),
      hasAttr: (n) => el.hasAttribute(n),
      attrNames: () => el.getAttributeNames(),
      text: () => directText.replace(/\s+/g, " ").trim(),
    };
    checkElement(view, headingRun, out);
  }
  return out;
}

/** True if any diagnostic is an error. */
export function hasBlockingA11yError(diagnostics: Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === "error");
}
