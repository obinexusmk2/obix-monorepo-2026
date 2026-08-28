import type { Diagnostic } from "@obinexusltd/obix-spec";
import { DIAGNOSTIC_CODES } from "@obinexusltd/obix-spec";
import { diag } from "./util.js";

export interface ParseStylesResult {
  /** raw CSS text, ready for obix-styles.scopeCss() */
  css: string;
  diagnostics: Diagnostic[];
}

/**
 * Level 0 does not transform CSS in the parser — it only sanity-checks brace
 * balance and hands the raw text to obix-styles. SCSS is deferred to Level 1.
 */
export function parseStyles(raw: string): ParseStylesResult {
  const diagnostics: Diagnostic[] = [];
  let depth = 0;
  for (const ch of raw) {
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    if (depth < 0) break;
  }
  if (depth !== 0) {
    diagnostics.push(diag(DIAGNOSTIC_CODES.P005_UNEXPECTED_TOKEN, "unbalanced braces in <style>"));
  }
  if (/[$]|@mixin|@include/.test(raw)) {
    diagnostics.push(diag(DIAGNOSTIC_CODES.P007_UNKNOWN_DIRECTIVE, "SCSS syntax is not supported at Level 0", undefined, "warning"));
  }
  return { css: raw, diagnostics };
}
