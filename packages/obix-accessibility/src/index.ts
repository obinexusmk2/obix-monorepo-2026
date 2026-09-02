/**
 * obix-accessibility
 *
 * Compile-time accessibility analysis. OBIX treats accessibility as part of
 * correctness, so this is a MANDATORY dependency of obix-compiler — installing
 * the compiler installs this, and there is no supported mode that disables it.
 *
 * Level 0 is analysis only. There is deliberately NO runtime `announce()` here;
 * live-region updates happen through ordinary DOM bindings in obix-runtime.
 */
import { DIAGNOSTIC_CODES } from "obix-spec";
import type {
  A11yModel,
  A11yLiveRegion,
  Diagnostic,
  TemplateDescriptor,
  TemplateElement,
  TemplateNode,
} from "obix-spec";

const LIVE = new Set(["polite", "assertive", "off"]);
const KNOWN_ROLES = new Set([
  "button", "link", "timer", "status", "alert", "log", "region", "group",
  "list", "listitem", "navigation", "main", "banner", "contentinfo",
  "heading", "form", "search", "dialog", "note", "presentation", "none",
]);
const KNOWN_ARIA = new Set([
  "aria-live", "aria-atomic", "aria-relevant", "aria-busy",
  "aria-label", "aria-labelledby", "aria-describedby",
  "aria-hidden", "aria-disabled", "aria-pressed", "aria-expanded",
  "aria-checked", "aria-current", "aria-controls", "aria-role",
  "aria-invalid", "aria-required", "aria-valuenow", "aria-valuemin", "aria-valuemax",
]);
const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
const INTERACTIVE = new Set(["button", "a"]);

const err = (code: string, message: string): Diagnostic => ({ code, message, severity: "error" });
const warn = (code: string, message: string): Diagnostic => ({ code, message, severity: "warning" });

/** Full a11y analysis of a template descriptor. Runs before emit. */
export function analyzeA11y(template: TemplateDescriptor): { model: A11yModel; diagnostics: Diagnostic[] } {
  const liveRegions: A11yLiveRegion[] = [];
  const headingLevels: number[] = [];
  const roles: string[] = [];
  const diagnostics: Diagnostic[] = [];
  let focusableCount = 0;

  walk(template.root, [], (node, path) => {
    if (node.kind !== "element") return;
    const attrs = new Map(node.attrs.map((a) => [a.name, a] as const));

    // roles
    const role = attrs.get("role")?.value;
    if (role) {
      roles.push(role);
      if (!KNOWN_ROLES.has(role)) diagnostics.push(warn(DIAGNOSTIC_CODES.A005_UNKNOWN_ROLE, `unknown role "${role}"`));
    }

    // aria-* attribute names
    for (const a of node.attrs) {
      if (a.name.startsWith("aria-") && !KNOWN_ARIA.has(a.name)) {
        diagnostics.push(warn(DIAGNOSTIC_CODES.A006_UNKNOWN_ARIA_ATTR, `unknown ARIA attribute "${a.name}"`));
      }
    }

    // live regions
    const ariaLive = attrs.get("aria-live");
    if (ariaLive) {
      const value = (ariaLive.value ?? "").trim();
      const politeness = LIVE.has(value) ? (value as A11yLiveRegion["politeness"]) : "polite";
      if (!LIVE.has(value) && !ariaLive.interpolation) {
        diagnostics.push(err(DIAGNOSTIC_CODES.A001_LIVE_REGION_INVALID, `aria-live="${value}" is invalid — use polite | assertive | off`));
      }
      const hasBinding = subtreeHasBinding(node);
      liveRegions.push({ path, politeness, hasBinding });
      if (!hasBinding) {
        diagnostics.push(warn(DIAGNOSTIC_CODES.A002_LIVE_REGION_NO_BINDING, `live region has no text binding — it will never announce anything`));
      }
    }

    // headings
    if (HEADINGS.has(node.tag)) headingLevels.push(Number(node.tag.slice(1)));

    // focus policy
    const isInteractive = INTERACTIVE.has(node.tag) || attrs.has("tabindex") || (role && ["button", "link"].includes(role));
    if (isInteractive) {
      focusableCount++;
      const ti = attrs.get("tabindex")?.value;
      if (ti != null && Number(ti) < -1) {
        diagnostics.push(err(DIAGNOSTIC_CODES.A003_FOCUS_POLICY, `tabindex="${ti}" is invalid`));
      }
      if (node.tag === "button" && !hasAccessibleName(node)) {
        diagnostics.push(warn(DIAGNOSTIC_CODES.A003_FOCUS_POLICY, `<button> has no accessible name (text child or aria-label)`));
      }
      if (node.tag === "a" && !attrs.has("href")) {
        diagnostics.push(warn(DIAGNOSTIC_CODES.A003_FOCUS_POLICY, `<a> without href is not focusable; use <button>`));
      }
    }
  });

  // heading hierarchy — no skipped levels
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i]! - headingLevels[i - 1]! > 1) {
      diagnostics.push(err(DIAGNOSTIC_CODES.A004_HEADING_SKIP, `heading level jumps from h${headingLevels[i - 1]} to h${headingLevels[i]}`));
    }
  }

  const model: A11yModel = {
    liveRegions,
    focusableCount,
    headingLevels,
    roles,
    violations: diagnostics,
  };
  return { model, diagnostics };
}

const LIVE_REGION_CODES = new Set<string>([
  DIAGNOSTIC_CODES.A001_LIVE_REGION_INVALID,
  DIAGNOSTIC_CODES.A002_LIVE_REGION_NO_BINDING,
]);

export function validateLiveRegions(template: TemplateDescriptor): Diagnostic[] {
  return analyzeA11y(template).diagnostics.filter((d) => LIVE_REGION_CODES.has(d.code));
}

export function checkFocusPolicy(template: TemplateDescriptor): Diagnostic[] {
  return analyzeA11y(template).diagnostics.filter((d) => d.code === DIAGNOSTIC_CODES.A003_FOCUS_POLICY);
}

export function checkHeadingHierarchy(template: TemplateDescriptor): Diagnostic[] {
  return analyzeA11y(template).diagnostics.filter((d) => d.code === DIAGNOSTIC_CODES.A004_HEADING_SKIP);
}

/** True if any Level 0 a11y diagnostic is an error (blocks emit). */
export function hasBlockingA11yError(diagnostics: Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === "error" && d.code.startsWith("OBIX-A"));
}

function subtreeHasBinding(el: TemplateElement): boolean {
  for (const child of el.children) {
    if (child.kind === "interpolation") return true;
    if (child.kind === "element" && subtreeHasBinding(child)) return true;
  }
  return el.attrs.some((a) => a.interpolation != null);
}

function hasAccessibleName(el: TemplateElement): boolean {
  if (el.attrs.some((a) => a.name === "aria-label" || a.name === "aria-labelledby")) return true;
  return el.children.some((c) => (c.kind === "text" && c.value.trim().length > 0) || c.kind === "interpolation");
}

type Visitor = (node: TemplateNode, path: number[]) => void;
function walk(node: TemplateElement, path: number[], visit: Visitor): void {
  visit(node, path);
  node.children.forEach((child, i) => {
    const childPath = [...path, i];
    if (child.kind === "element") walk(child, childPath, visit);
    else visit(child, childPath);
  });
}
