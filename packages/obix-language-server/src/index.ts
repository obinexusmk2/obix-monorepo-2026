/**
 * obix-language-server
 *
 * Editor intelligence for `.obix`. This is a thin layer: the compiler and parser
 * remain the single source of diagnostics. No editor transport (LSP JSON-RPC) is
 * bundled at Level 0 — an editor shell calls these pure functions.
 */
import { checkSource } from "obix-compiler";
import { scanSections, parseTemplate, parseScript } from "obix-parser";
import { analyzeTemplate } from "obix-template";
import type { Diagnostic } from "obix-spec";

export interface Position {
  line: number;
  character: number;
}

export interface CompletionItem {
  label: string;
  kind: "action" | "derived" | "state" | "prop" | "attribute" | "event";
  detail?: string;
}

export interface HoverResult {
  contents: string;
  symbol?: string;
}

export interface DefinitionResult {
  found: boolean;
  section?: "script" | "template";
  offset?: number;
}

/** Parse + semantic + a11y diagnostics for a document. */
export function diagnostics(source: string, uri?: string): Diagnostic[] {
  return checkSource(source.replace(/\r\n/g, "\n"), uri).diagnostics;
}

function symbolTable(source: string): {
  actions: string[];
  derived: string[];
  state: string[];
  props: string[];
} {
  const scan = scanSections(source);
  const script = scan.sections.script ? parseScript(scan.sections.script.raw).model : undefined;
  const keys = (init: string | undefined) =>
    !init
      ? []
      : (init.match(/([A-Za-z_$][\w$]*)\s*:/g) ?? []).map((s) => s.replace(/\s*:$/, ""));
  return {
    actions: [...(script?.actionNames ?? [])],
    derived: [...(script?.derivedNames ?? [])],
    state: keys(script?.stateInit),
    props: keys(script?.propsInit),
  };
}

const ARIA = ["aria-live", "aria-label", "aria-atomic", "aria-hidden", "aria-pressed", "aria-disabled"];

/** Completions. Context-sensitive when the cursor is inside `{ … }` or `on:`. */
export function completions(source: string, position: Position): CompletionItem[] {
  const sym = symbolTable(source);
  const offset = offsetOf(source, position);
  const before = source.slice(0, offset);

  if (/on:[\w-]*$/.test(before)) {
    return sym.actions.map((a) => ({ label: a, kind: "event" as const, detail: "action" }));
  }
  if (/\{[^}]*$/.test(before)) {
    return [
      ...sym.derived.map((d) => ({ label: d, kind: "derived" as const })),
      ...sym.state.map((s) => ({ label: s, kind: "state" as const })),
      ...sym.props.map((p) => ({ label: p, kind: "prop" as const })),
    ];
  }
  if (/\s(aria-[\w-]*)?$/.test(before) && /<[a-z][^>]*$/.test(before)) {
    return ARIA.map((a) => ({ label: a, kind: "attribute" as const }));
  }
  return [];
}

/** Hover: report whether the identifier under the cursor is state/derived/prop/action. */
export function hover(source: string, position: Position): HoverResult | null {
  const offset = offsetOf(source, position);
  const word = wordAt(source, offset);
  if (!word) return null;
  const sym = symbolTable(source);
  if (sym.actions.includes(word)) return { contents: `**${word}** — action \`(state, payload, props) => state\``, symbol: word };
  if (sym.derived.includes(word)) return { contents: `**${word}** — derived \`(state, props) => value\``, symbol: word };
  if (sym.state.includes(word)) return { contents: `**${word}** — state field`, symbol: word };
  if (sym.props.includes(word)) return { contents: `**${word}** — prop`, symbol: word };
  return null;
}

/** Go-to-definition: locate a symbol's declaration in the `<script>` section. */
export function definition(source: string, position: Position): DefinitionResult {
  const offset = offsetOf(source, position);
  const word = wordAt(source, offset);
  if (!word) return { found: false };
  const scan = scanSections(source);
  const script = scan.sections.script;
  if (!script) return { found: false };
  const idx = script.raw.search(new RegExp(`\\b${word}\\s*[({:]`));
  if (idx === -1) return { found: false };
  return { found: true, section: "script", offset: script.span.start + idx };
}

/** Structural symbols for an outline view. */
export function documentSymbols(source: string) {
  const scan = scanSections(source);
  const tpl = scan.sections.template ? parseTemplate(scan.sections.template.raw).ast : undefined;
  const sym = symbolTable(source);
  return {
    ...sym,
    templateRoot: tpl?.tag,
    bindings: tpl ? analyzeTemplate(tpl).bindings.length : 0,
    events: tpl ? analyzeTemplate(tpl).events.length : 0,
  };
}

function offsetOf(source: string, position: Position): number {
  const lines = source.split("\n");
  let offset = 0;
  for (let i = 0; i < position.line && i < lines.length; i++) offset += lines[i]!.length + 1;
  return offset + position.character;
}

function wordAt(source: string, offset: number): string | null {
  let start = offset;
  let end = offset;
  while (start > 0 && /[\w$]/.test(source[start - 1]!)) start--;
  while (end < source.length && /[\w$]/.test(source[end]!)) end++;
  const w = source.slice(start, end);
  return /^[A-Za-z_$][\w$]*$/.test(w) ? w : null;
}
