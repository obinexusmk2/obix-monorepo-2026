import { DIAGNOSTIC_CODES } from "obix-spec";
import type { Diagnostic, ObixSection } from "obix-spec";
import { diag, spanAt } from "./util.js";

export interface ScanResult {
  sections: {
    style?: ObixSection;
    template?: ObixSection;
    script?: ObixSection;
  };
  diagnostics: Diagnostic[];
}

const SECTION_NAMES = ["style", "template", "script"] as const;
type SectionName = (typeof SECTION_NAMES)[number];

/**
 * Split a `.obix` source into its `<style>` / `<template>` / `<script>` sections.
 * Tolerates arbitrary top-level whitespace before, between and after sections.
 * Reports duplicates; does not require any particular section to be present
 * (the compiler enforces template + script via validateObixAST).
 */
export function scanSections(source: string): ScanResult {
  const diagnostics: Diagnostic[] = [];
  const sections: ScanResult["sections"] = {};

  for (const name of SECTION_NAMES) {
    const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "g");
    let match: RegExpExecArray | null;
    let count = 0;
    while ((match = re.exec(source)) !== null) {
      count++;
      const openLen = match[0].length - match[1].length - `</${name}>`.length;
      const innerStart = match.index + openLen;
      const innerEnd = innerStart + match[1].length;
      if (count === 1) {
        sections[name as SectionName] = {
          raw: match[1],
          span: spanAt(source, innerStart, innerEnd),
        };
      } else {
        diagnostics.push(
          diag(
            DIAGNOSTIC_CODES.P003_DUPLICATE_SECTION,
            `duplicate <${name}> section — only one is allowed`,
            spanAt(source, match.index, match.index + match[0].length),
          ),
        );
      }
    }
  }

  // anything non-whitespace outside the three sections is a structural error
  const stripped = source
    .replace(/<style(?:\s[^>]*)?>[\s\S]*?<\/style>/g, "")
    .replace(/<template(?:\s[^>]*)?>[\s\S]*?<\/template>/g, "")
    .replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/g, "")
    .trim();
  if (stripped.length > 0) {
    diagnostics.push(
      diag(
        DIAGNOSTIC_CODES.P005_UNEXPECTED_TOKEN,
        `unexpected top-level content outside <style>/<template>/<script>: ${JSON.stringify(
          stripped.slice(0, 40),
        )}`,
      ),
    );
  }

  return { sections, diagnostics };
}
