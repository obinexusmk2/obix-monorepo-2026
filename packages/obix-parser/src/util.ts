import type { Diagnostic, DiagnosticSeverity, SourceSpan } from "@obinexusltd/obix-spec";

export function spanAt(source: string, start: number, end: number): SourceSpan {
  let line = 1;
  let col = 1;
  for (let i = 0; i < start && i < source.length; i++) {
    if (source[i] === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { start, end, line, column: col };
}

export function diag(
  code: string,
  message: string,
  span?: SourceSpan,
  severity: DiagnosticSeverity = "error",
): Diagnostic {
  return { code, message, span, severity };
}

export const BOOLEAN_ATTRS = new Set([
  "disabled",
  "hidden",
  "required",
  "checked",
  "readonly",
  "selected",
  "multiple",
  "open",
  "inert",
]);

/** semantic HTML vocabulary permitted in the Level 0 strict template subset */
export const SEMANTIC_TAGS = new Set([
  "div",
  "span",
  "p",
  "section",
  "article",
  "header",
  "footer",
  "main",
  "nav",
  "aside",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "button",
  "a",
  "label",
  "output",
  "time",
  "small",
  "strong",
  "em",
  "abbr",
  "figure",
  "figcaption",
  "fieldset",
  "legend",
  "form",
]);

export const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link"]);
