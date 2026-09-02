/**
 * obix-template
 *
 * Pure semantic template analysis. Given a parsed template element it returns
 * binding + event descriptors and the dependencies each binding reads. It never
 * parses JavaScript and never touches the DOM — it returns plain descriptors.
 */
import type {
  TemplateElement,
  TemplateDescriptor,
  BindingDescriptor,
  EventDescriptor,
} from "obix-spec";

const PATH = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;

/** Root identifier(s) an expression depends on (Level 0: one dotted path). */
export function extractDependencies(expr: string): string[] {
  const e = expr.trim();
  if (!PATH.test(e)) return [];
  return [e.split(".")[0]!];
}

/** Every data binding in the template, with its child-index path from the root. */
export function analyzeBindings(root: TemplateElement): BindingDescriptor[] {
  const out: BindingDescriptor[] = [];
  walk(root, [], (node, path) => {
    if (node.kind === "interpolation") {
      out.push({ kind: "text", target: "", expr: node.expr, deps: extractDependencies(node.expr), path });
      return;
    }
    if (node.kind !== "element") return;
    for (const attr of node.attrs) {
      if (attr.directive === "event") continue;
      if (attr.directive === "conditional") {
        const expr = (attr.value ?? "").trim();
        out.push({ kind: "conditional", target: "", expr, deps: extractDependencies(expr), path });
        continue;
      }
      if (!attr.interpolation) continue;
      const expr = attr.interpolation;
      const deps = extractDependencies(expr);
      if (attr.directive === "aria") out.push({ kind: "aria", target: attr.name, expr, deps, path });
      else if (attr.directive === "bool") out.push({ kind: "bool", target: attr.name, expr, deps, path });
      else out.push({ kind: "attr", target: attr.name, expr, deps, path });
    }
  });
  return out;
}

/** Every `on:event="Action"` in the template. */
export function analyzeEvents(root: TemplateElement): EventDescriptor[] {
  const out: EventDescriptor[] = [];
  walk(root, [], (node, path) => {
    if (node.kind !== "element") return;
    for (const attr of node.attrs) {
      if (attr.directive === "event" && attr.value) {
        out.push({ event: attr.name.slice(3), action: attr.value, path });
      }
    }
  });
  return out;
}

export function analyzeTemplate(root: TemplateElement): TemplateDescriptor {
  return { root, bindings: analyzeBindings(root), events: analyzeEvents(root) };
}

/**
 * Evaluate a Level 0 binding expression (identifier or dotted path) against a
 * flat scope. Callers pre-compute derived values; `scope` is the merge of
 * derived (highest precedence), state, then props.
 */
export function resolveBinding(expr: string, scope: Record<string, unknown>): unknown {
  const parts = expr.trim().split(".");
  let cur: unknown = scope[parts[0]!];
  for (let i = 1; i < parts.length; i++) {
    if (cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[parts[i]!];
  }
  return cur;
}

/** Merge derived/state/props into the flat scope resolveBinding expects. */
export function bindingScope(
  state: Record<string, unknown>,
  props: Record<string, unknown>,
  derived: Record<string, unknown>,
): Record<string, unknown> {
  return { ...props, ...state, ...derived };
}

type Visitor = (node: TemplateElement["children"][number] | TemplateElement, path: number[]) => void;

function walk(node: TemplateElement, path: number[], visit: Visitor): void {
  visit(node, path);
  node.children.forEach((child, i) => {
    const childPath = [...path, i];
    if (child.kind === "element") walk(child, childPath, visit);
    else visit(child, childPath);
  });
}
