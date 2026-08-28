import type {
  ValidationResult,
  Violation,
  TemplateNode,
  TemplateElement,
} from "./types.js";

const IDENT = /^[A-Za-z_$][\w$]*$/;
const PATH = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;
const PASCAL = /^[A-Z][A-Za-z0-9]*$/;
const TAG = /^[a-z][a-z0-9-]*$/;

/**
 * Structural validation boundary (Draft 0.2.1 — Problem 7 / PARSER SEAL).
 *
 *   Parsed AST -> validateObixAST() -> semantic AST
 *
 * "Conformance seal" means semantic structural validation here — not a
 * cryptographic signature. Any parser (first- or third-party) must produce an
 * AST that passes this before the compiler will touch it.
 */
export function validateObixAST(ast: unknown): ValidationResult {
  const v: Violation[] = [];
  const add = (rule: string, message: string, path?: string) => v.push({ rule, message, path });

  if (typeof ast !== "object" || ast === null) {
    return { valid: false, violations: [{ rule: "ast.object", message: "AST must be an object" }] };
  }
  const a = ast as Record<string, unknown>;

  if (typeof a.componentName !== "string" || !PASCAL.test(a.componentName)) {
    add("ast.componentName", "componentName must be a PascalCase string", "componentName");
  }

  const sections = (a.sections ?? {}) as Record<string, unknown>;
  if (!sections.template) add("ast.sections.template", "a <template> section is required", "sections.template");
  if (!sections.script) add("ast.sections.script", "a <script> section is required", "sections.script");

  if (a.template !== undefined) {
    if (!isElement(a.template)) {
      add("template.root", "template root must be a single element node", "template");
    } else {
      walk(a.template as TemplateElement, [], add);
    }
  }

  if (a.script !== undefined) {
    const s = a.script as Record<string, unknown>;
    if (!Array.isArray(s.actionNames)) {
      add("script.actionNames", "script model must expose actionNames[]", "script.actionNames");
    } else {
      for (const n of s.actionNames as unknown[]) {
        if (typeof n !== "string" || !IDENT.test(n)) add("script.actionNames", `invalid action name: ${String(n)}`, "script.actionNames");
      }
    }
  }

  return { valid: v.length === 0, violations: v };
}

function isElement(n: unknown): n is TemplateElement {
  return typeof n === "object" && n !== null && (n as { kind?: unknown }).kind === "element";
}

function walk(
  node: TemplateNode,
  path: number[],
  add: (rule: string, message: string, path?: string) => void,
): void {
  const at = path.join(".");
  if (node.kind === "element") {
    if (typeof node.tag !== "string" || !TAG.test(node.tag)) {
      add("template.element.tag", `invalid tag "${String(node.tag)}"`, at);
    }
    if (!Array.isArray(node.attrs)) {
      add("template.element.attrs", "element attrs must be an array", at);
    } else {
      for (const attr of node.attrs) {
        if (typeof attr.name !== "string" || attr.name.length === 0) {
          add("template.attr.name", "attribute name must be a non-empty string", at);
        }
        if (attr.interpolation !== undefined && !PATH.test(attr.interpolation)) {
          add("template.attr.interpolation", `attribute "${attr.name}" interpolation must be an identifier or dotted path, got "${attr.interpolation}"`, at);
        }
        if (attr.name.startsWith("on:")) {
          const action = attr.value ?? attr.interpolation ?? "";
          if (!IDENT.test(action)) add("template.event", `on:${attr.name.slice(3)} must name an action identifier`, at);
        }
      }
    }
    node.children.forEach((child, i) => walk(child, [...path, i], add));
  } else if (node.kind === "interpolation") {
    if (typeof node.expr !== "string" || !PATH.test(node.expr)) {
      add("template.interpolation", `interpolation expression must be an identifier or dotted path, got "${String(node.expr)}"`, at);
    }
  } else if (node.kind === "text") {
    if (typeof node.value !== "string") add("template.text", "text node value must be a string", at);
  } else {
    add("template.node.kind", `unknown template node kind "${String((node as { kind?: unknown }).kind)}"`, at);
  }
}
