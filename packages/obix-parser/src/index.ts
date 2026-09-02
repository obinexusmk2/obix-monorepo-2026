/**
 * obix-parser
 *
 * Section scanner + strict OBIX template/script parser. Produces an AST whose
 * structural correctness is re-checked by obix-spec.validateObixAST() before
 * any semantic analysis runs.
 */
import {
  validateObixAST,
  type Diagnostic,
  type ObixAST,
  type ValidationResult,
} from "obix-spec";
import { scanSections } from "./scan-sections.js";
import { parseTemplate } from "./parse-template.js";
import { parseScript } from "./parse-script.js";

export { scanSections } from "./scan-sections.js";
export type { ScanResult } from "./scan-sections.js";
export { parseTemplate } from "./parse-template.js";
export type { ParseTemplateResult } from "./parse-template.js";
export { parseScript } from "./parse-script.js";
export type { ParseScriptResult } from "./parse-script.js";
export { parseStyles } from "./parse-styles.js";

export interface ParseResult {
  ast?: ObixAST;
  diagnostics: Diagnostic[];
  /** result of obix-spec.validateObixAST() over the produced AST */
  structural: ValidationResult;
}

/**
 * Full parse of a `.obix` source. `componentName` normally comes from the
 * PascalCase filename.
 */
export function parseObix(source: string, componentName: string): ParseResult {
  const diagnostics: Diagnostic[] = [];
  const scan = scanSections(source);
  diagnostics.push(...scan.diagnostics);

  const tpl = scan.sections.template ? parseTemplate(scan.sections.template.raw) : undefined;
  if (tpl) diagnostics.push(...tpl.diagnostics);

  const scr = scan.sections.script ? parseScript(scan.sections.script.raw) : undefined;
  if (scr) diagnostics.push(...scr.diagnostics);

  const ast: ObixAST = {
    componentName,
    sections: scan.sections,
    template: tpl?.ast,
    script: scr?.model,
  };

  const structural = validateObixAST(ast);

  return { ast, diagnostics, structural };
}
