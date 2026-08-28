import { DIAGNOSTIC_CODES } from "@obinexusltd/obix-spec";
import type {
  Diagnostic,
  TemplateAttr,
  TemplateElement,
  TemplateNode,
} from "@obinexusltd/obix-spec";
import { diag, spanAt, BOOLEAN_ATTRS, SEMANTIC_TAGS, VOID_TAGS } from "./util.js";

export interface ParseTemplateResult {
  ast?: TemplateElement;
  diagnostics: Diagnostic[];
}

const IDENT = /^[A-Za-z_$][\w$]*$/;
const PATH = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;
const NAME_START = /[A-Za-z_:@]/;
const ATTR_NAME = /[\w:.@-]/;

/**
 * Strict OBIX template parser: a semantic-HTML vocabulary plus the OBIX
 * grammar. NOT an HTML5 error-recovery parser. Everything it produces is
 * re-validated by obix-spec.validateObixAST() (Problem 7 — the parser seal).
 */
export function parseTemplate(raw: string): ParseTemplateResult {
  const diagnostics: Diagnostic[] = [];
  let i = 0;

  const stack: TemplateElement[] = [];
  const roots: TemplateNode[] = [];

  const push = (node: TemplateNode) => {
    const parent = stack[stack.length - 1];
    if (parent) (parent.children as TemplateNode[]).push(node);
    else roots.push(node);
  };

  while (i < raw.length) {
    const lt = raw.indexOf("<", i);
    if (lt === -1) {
      pushText(raw.slice(i), i);
      break;
    }
    if (lt > i) pushText(raw.slice(i, lt), i);
    i = lt;

    if (raw.startsWith("<!--", i)) {
      const end = raw.indexOf("-->", i);
      i = end === -1 ? raw.length : end + 3;
      continue;
    }

    if (raw[i + 1] === "/") {
      const gt = raw.indexOf(">", i);
      if (gt === -1) {
        diagnostics.push(diag(DIAGNOSTIC_CODES.P004_UNCLOSED_TAG, "unterminated closing tag", spanAt(raw, i, raw.length)));
        break;
      }
      const name = raw.slice(i + 2, gt).trim();
      const top = stack[stack.length - 1];
      if (!top) {
        diagnostics.push(diag(DIAGNOSTIC_CODES.P005_UNEXPECTED_TOKEN, `stray closing tag </${name}>`, spanAt(raw, i, gt + 1)));
      } else if (top.tag !== name) {
        diagnostics.push(diag(DIAGNOSTIC_CODES.P005_UNEXPECTED_TOKEN, `mismatched closing tag: expected </${top.tag}>, got </${name}>`, spanAt(raw, i, gt + 1)));
      } else {
        stack.pop();
      }
      i = gt + 1;
      continue;
    }

    // opening tag
    const tagStart = i;
    i++; // skip '<'
    let name = "";
    while (i < raw.length && (name === "" ? NAME_START.test(raw[i]!) : ATTR_NAME.test(raw[i]!))) {
      name += raw[i++];
    }
    if (name === "") {
      diagnostics.push(diag(DIAGNOSTIC_CODES.P005_UNEXPECTED_TOKEN, "expected tag name after '<'", spanAt(raw, tagStart, i)));
      continue;
    }
    const { attrs, selfClose, end } = parseAttrs(raw, i, diagnostics);
    i = end;

    if (!SEMANTIC_TAGS.has(name) && !VOID_TAGS.has(name)) {
      diagnostics.push(diag(DIAGNOSTIC_CODES.P005_UNEXPECTED_TOKEN, `tag <${name}> is not in the Level 0 semantic vocabulary`, spanAt(raw, tagStart, i), "warning"));
    }

    const el: TemplateElement = {
      kind: "element",
      tag: name,
      attrs,
      children: [],
      span: spanAt(raw, tagStart, i),
    };
    push(el);
    if (!selfClose && !VOID_TAGS.has(name)) stack.push(el);
  }

  for (const unclosed of stack) {
    diagnostics.push(diag(DIAGNOSTIC_CODES.P004_UNCLOSED_TAG, `unclosed <${unclosed.tag}>`, unclosed.span));
  }

  const elementRoots = roots.filter((n): n is TemplateElement => n.kind === "element");
  if (elementRoots.length !== 1) {
    diagnostics.push(
      diag(
        DIAGNOSTIC_CODES.P001_MISSING_TEMPLATE,
        `<template> must contain exactly one root element (found ${elementRoots.length})`,
      ),
    );
  }

  return { ast: elementRoots[0], diagnostics };

  function pushText(text: string, offset: number): void {
    const parts = splitInterpolations(text, offset, diagnostics);
    for (const p of parts) push(p);
  }
}

function parseAttrs(
  raw: string,
  start: number,
  diagnostics: Diagnostic[],
): { attrs: TemplateAttr[]; selfClose: boolean; end: number } {
  const attrs: TemplateAttr[] = [];
  let i = start;
  let selfClose = false;
  while (i < raw.length) {
    while (i < raw.length && /\s/.test(raw[i]!)) i++;
    if (raw[i] === ">") {
      i++;
      break;
    }
    if (raw.startsWith("/>", i)) {
      selfClose = true;
      i += 2;
      break;
    }
    let name = "";
    while (i < raw.length && ATTR_NAME.test(raw[i]!)) name += raw[i++];
    if (name === "") {
      i++;
      continue;
    }
    while (i < raw.length && /\s/.test(raw[i]!)) i++;
    let value: string | null = null;
    if (raw[i] === "=") {
      i++;
      while (i < raw.length && /\s/.test(raw[i]!)) i++;
      const quote = raw[i];
      if (quote === '"' || quote === "'") {
        i++;
        const close = raw.indexOf(quote, i);
        value = raw.slice(i, close === -1 ? raw.length : close);
        i = close === -1 ? raw.length : close + 1;
      } else {
        let v = "";
        while (i < raw.length && !/[\s>]/.test(raw[i]!)) v += raw[i++];
        value = v;
      }
    }
    attrs.push(classifyAttr(name, value, diagnostics));
  }
  return { attrs, selfClose, end: i };
}

function classifyAttr(name: string, value: string | null, diagnostics: Diagnostic[]): TemplateAttr {
  const whole = value != null && /^\{[^{}]*\}$/.test(value.trim());
  const expr = whole ? value!.trim().slice(1, -1).trim() : undefined;

  if (whole && (!expr || !PATH.test(expr))) {
    diagnostics.push(diag(DIAGNOSTIC_CODES.P006_BAD_INTERPOLATION, `attribute "${name}" interpolation must be an identifier or dotted path`));
  } else if (value != null && !whole && value.includes("{")) {
    diagnostics.push(diag(DIAGNOSTIC_CODES.P006_BAD_INTERPOLATION, `attribute "${name}": Level 0 supports whole-value interpolation only ("attr={expr}")`));
  }

  if (name.startsWith("on:")) {
    if (!value || !IDENT.test(value)) {
      diagnostics.push(diag(DIAGNOSTIC_CODES.P005_UNEXPECTED_TOKEN, `on:${name.slice(3)} must name an action identifier`));
    }
    return { name, value, directive: "event" };
  }
  if (name === "obix:if") {
    if (!value || !PATH.test(value)) {
      diagnostics.push(diag(DIAGNOSTIC_CODES.P007_UNKNOWN_DIRECTIVE, `obix:if must reference a derived/state identifier`));
    }
    return { name, value, directive: "conditional" };
  }
  if (name.includes(":") && !name.startsWith("aria-") && !name.startsWith("data-")) {
    diagnostics.push(diag(DIAGNOSTIC_CODES.P007_UNKNOWN_DIRECTIVE, `unknown directive "${name}" (Level 0 knows on:, obix:if)`));
  }
  if (name.startsWith("aria-")) {
    return { name, value, interpolation: expr, directive: "aria" };
  }
  if (BOOLEAN_ATTRS.has(name)) {
    return { name, value, interpolation: expr, directive: "bool" };
  }
  return { name, value, interpolation: expr };
}

function splitInterpolations(text: string, offset: number, diagnostics: Diagnostic[]): TemplateNode[] {
  const out: TemplateNode[] = [];
  const re = /\{([^{}]*)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      const chunk = text.slice(last, m.index);
      if (chunk.trim().length > 0) out.push({ kind: "text", value: chunk, span: spanAt(text, last, m.index) });
    }
    const raw = m[1]!.trim();
    if (!raw || !PATH.test(raw)) {
      diagnostics.push(diag(DIAGNOSTIC_CODES.P006_BAD_INTERPOLATION, `interpolation must be an identifier or dotted path, got "${m[1]}"`, spanAt(text, offset + m.index, offset + m.index + m[0].length)));
    } else {
      out.push({ kind: "interpolation", expr: raw });
    }
    last = re.lastIndex;
  }
  if (last < text.length) {
    const chunk = text.slice(last);
    if (chunk.trim().length > 0) out.push({ kind: "text", value: chunk });
  }
  return out;
}
