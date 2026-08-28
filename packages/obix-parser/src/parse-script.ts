import type { Diagnostic, ObixScriptModel } from "@obinexusltd/obix-spec";
import { DIAGNOSTIC_CODES } from "@obinexusltd/obix-spec";
import { diag } from "./util.js";

export interface ParseScriptResult {
  model: ObixScriptModel;
  diagnostics: Diagnostic[];
}

/**
 * Structural extraction of the `<script>` section. This does NOT parse
 * JavaScript expressions — obix-template owns semantic analysis and it never
 * parses JS either. Here we brace-match the top-level `const NAME = {...}`
 * declarations for `state`, `props`, `actions`, `derived`, `effects`, capture
 * their raw initializer text (for verbatim re-emission by the compiler) and the
 * member names of the object literals (for diagnostics).
 */
export function parseScript(raw: string): ParseScriptResult {
  const diagnostics: Diagnostic[] = [];
  const decls = topLevelConsts(raw);

  const bodies = (name: string): Record<string, string> => {
    const src = decls.get(name);
    return src === undefined ? {} : memberBodies(src);
  };

  const actionsB = bodies("actions");
  const derivedB = bodies("derived");
  const effectsB = bodies("effects");

  const model: ObixScriptModel = {
    raw,
    stateInit: decls.get("state"),
    propsInit: decls.get("props"),
    actionNames: Object.keys(actionsB),
    derivedNames: Object.keys(derivedB),
    effectNames: Object.keys(effectsB),
    members: { actions: actionsB, derived: derivedB, effects: effectsB },
  };

  if (!decls.has("state")) diagnostics.push(diag(DIAGNOSTIC_CODES.P002_MISSING_SCRIPT, "<script> must declare `const state = { ... }`"));
  if (!decls.has("actions")) diagnostics.push(diag(DIAGNOSTIC_CODES.P002_MISSING_SCRIPT, "<script> must declare `const actions = { ... }`"));
  if (model.actionNames.length === 0 && decls.has("actions")) {
    diagnostics.push(diag(DIAGNOSTIC_CODES.S001_UNKNOWN_ACTION, "`actions` object literal has no members"));
  }

  return { model, diagnostics };
}

/** Map of top-level `const NAME = <initializer>` -> initializer source text. */
function topLevelConsts(src: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /(?:^|\n|;)\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const name = m[1]!;
    const startInit = re.lastIndex;
    const init = readInitializer(src, startInit);
    out.set(name, init.trim());
  }
  return out;
}

/**
 * Top-level member name -> raw body text for an object-literal source string.
 * Handles `key(args) { body }`, `key: (args) => body`, `key: value`, `key: { … }`.
 */
function memberBodies(objSrc: string): Record<string, string> {
  const inner = objSrc.replace(/^\s*\{/, "").replace(/\}\s*$/, "");
  const out: Record<string, string> = {};
  let i = 0;
  while (i < inner.length) {
    while (i < inner.length && /[\s,]/.test(inner[i]!)) i++;
    if (i >= inner.length) break;
    if (inner[i] === "/" && inner[i + 1] === "/") {
      const nl = inner.indexOf("\n", i);
      i = nl === -1 ? inner.length : nl;
      continue;
    }
    if (inner[i] === "/" && inner[i + 1] === "*") {
      const end = inner.indexOf("*/", i);
      i = end === -1 ? inner.length : end + 2;
      continue;
    }
    if (!/[A-Za-z_$]/.test(inner[i]!)) {
      i++;
      continue;
    }
    let key = "";
    while (i < inner.length && /[\w$]/.test(inner[i]!)) key += inner[i++]!;
    while (i < inner.length && /\s/.test(inner[i]!)) i++;
    const start = i;
    // consume this member's value: balance () [] {} and stop at a top-level comma
    let depth = 0;
    while (i < inner.length) {
      const c = inner[i]!;
      if (c === '"' || c === "'" || c === "`") {
        i = skipString(inner, i);
        continue;
      }
      if (c === "{" || c === "(" || c === "[") depth++;
      else if (c === "}" || c === ")" || c === "]") depth--;
      else if (c === "," && depth === 0) break;
      i++;
    }
    out[key] = inner.slice(start, i).replace(/^:\s*/, "").trim();
  }
  return out;
}

/** Read an initializer from `pos`, balancing (), [], {} and skipping strings. */
function readInitializer(src: string, pos: number): string {
  let i = pos;
  const stack: string[] = [];
  const openers: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  let started = false;
  while (i < src.length) {
    const c = src[i]!;
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(src, i);
      started = true;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i);
      i = nl === -1 ? src.length : nl;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    if (c in openers) {
      stack.push(openers[c]!);
      started = true;
    } else if (c === ")" || c === "]" || c === "}") {
      if (stack.length && stack[stack.length - 1] === c) stack.pop();
      if (stack.length === 0 && started) return src.slice(pos, i + 1);
    } else if (c === ";" && stack.length === 0) {
      return src.slice(pos, i);
    } else if (c === "\n" && stack.length === 0 && started) {
      // arrow / value without trailing semicolon
      return src.slice(pos, i);
    }
    i++;
  }
  return src.slice(pos, i);
}

function skipString(src: string, i: number): number {
  const q = src[i]!;
  i++;
  while (i < src.length) {
    if (src[i] === "\\") {
      i += 2;
      continue;
    }
    if (src[i] === q) return i + 1;
    i++;
  }
  return i;
}

