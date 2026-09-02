/**
 * obix-styles
 *
 * Scoped CSS transformation. The scope token comes from the ONE canonical
 * function in obix-spec (Problem 10 — no token drift). This package does not
 * generate the token; it applies it.
 */
import { createScopeToken, SCOPE_ATTR, type Diagnostic } from "obix-spec";

export { createScopeToken, SCOPE_ATTR } from "obix-spec";

export interface ScopeResult {
  css: string;
  token: string;
  selectors: string[];
  diagnostics: Diagnostic[];
}

/**
 * Rewrite every rule's selector list so it only matches inside the component's
 * scope. The rightmost compound selector gets `[data-obix-scope="<token>"]`
 * (deterministic, combinator-safe). `@media` / `@supports` blocks are recursed
 * into. SCSS is out of scope for Level 0.
 */
export function scopeCss(css: string, token: string): ScopeResult {
  const attr = `[${SCOPE_ATTR}="${token}"]`;
  const selectors: string[] = [];
  const diagnostics: Diagnostic[] = [];
  const out = transformBlock(css, attr, selectors);
  return { css: out, token, selectors, diagnostics };
}

/** Convenience: token + scope in one call. */
export function scopeComponentCss(componentName: string, css: string, sourcePath?: string): ScopeResult {
  return scopeCss(css, createScopeToken(componentName, sourcePath));
}

function transformBlock(css: string, attr: string, selectors: string[]): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const brace = css.indexOf("{", i);
    if (brace === -1) {
      out += css.slice(i);
      break;
    }
    const prelude = css.slice(i, brace).trim();
    const bodyStart = brace + 1;
    const bodyEnd = matchBrace(css, brace);
    const body = css.slice(bodyStart, bodyEnd);

    if (prelude.startsWith("@")) {
      if (/^@(media|supports|container)/i.test(prelude)) {
        out += `${prelude} {${transformBlock(body, attr, selectors)}}`;
      } else {
        out += `${prelude} {${body}}`; // @keyframes, @font-face — leave alone
      }
    } else {
      const scoped = prelude
        .split(",")
        .map((s) => scopeSelector(s.trim(), attr, selectors))
        .join(", ");
      out += `${scoped} {${body}}`;
    }
    i = bodyEnd + 1;
  }
  return out;
}

function matchBrace(css: string, open: number): number {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return css.length - 1;
}

function scopeSelector(sel: string, attr: string, selectors: string[]): string {
  if (!sel) return sel;
  selectors.push(sel);
  const tokens = sel.split(/(\s*[>+~]\s*|\s+)/).filter((t) => t.length > 0);
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i]!;
    if (/^\s*[>+~]\s*$/.test(t) || /^\s+$/.test(t)) continue;
    tokens[i] = injectAttr(t, attr);
    break;
  }
  return tokens.join("");
}

function injectAttr(compound: string, attr: string): string {
  const pseudo = compound.search(/::?[A-Za-z(]/);
  if (pseudo === -1) return compound + attr;
  return compound.slice(0, pseudo) + attr + compound.slice(pseudo);
}
