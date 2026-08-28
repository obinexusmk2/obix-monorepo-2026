/**
 * @obinexusltd/obix-adapter-native
 *
 * The Native projection — the ONLY adapter that touches DOM APIs. It builds the
 * DOM from the artifact's template descriptor, wires obix-runtime bindings, and
 * drives state through the reactive projection (so transitions still route
 * through obix-ir.applyAction).
 *
 * Level 0: text / attribute / boolean / ARIA bindings, single-element `obix:if`,
 * native event binding. No loops, slots or hydration.
 */
import { toReactive, type ReactiveInstance } from "@obinexusltd/obix-adapter-reactive";
import {
  bindText,
  bindAttr,
  bindBool,
  bindAria,
  bindEvent,
  bindPresence,
  createBindingGroup,
} from "@obinexusltd/obix-runtime";
import { SCOPE_ATTR } from "@obinexusltd/obix-spec";
import type {
  DOPArtifact,
  State,
  Props,
  TemplateElement,
  TemplateNode,
} from "@obinexusltd/obix-spec";

export interface MountHandle<S extends object, P extends object> {
  instance: ReactiveInstance<S, P>;
  unmount(): void;
}

export interface MountOptions<S extends object, P extends object> {
  state?: S;
  props?: Partial<P>;
}

export function mount<S extends object = State, P extends object = Props>(
  artifact: DOPArtifact<S, P>,
  container: Element,
  opts: MountOptions<S, P> = {},
): MountHandle<S, P> {
  if (!artifact.template) {
    throw new Error(`[OBIX] mount("${artifact.name}"): artifact has no template descriptor`);
  }

  const instance = toReactive(artifact)(opts);
  const group = createBindingGroup();

  const scope = (): Record<string, unknown> => {
    const s = instance.state as Record<string, unknown>;
    const p = instance.props as Record<string, unknown>;
    const d: Record<string, unknown> = {};
    for (const [k, fn] of Object.entries(artifact.derived)) {
      try {
        d[k] = fn(instance.state, instance.props);
      } catch {
        d[k] = undefined;
      }
    }
    return { ...p, ...s, ...d };
  };

  const resolve = (expr: string): unknown => {
    const parts = expr.trim().split(".");
    let cur: unknown = scope()[parts[0]!];
    for (let i = 1; i < parts.length && cur != null; i++) cur = (cur as Record<string, unknown>)[parts[i]!];
    return cur;
  };

  const nodeByPath = new Map<string, Node>();
  const root = buildElement(artifact.template.root, [], nodeByPath);

  // bindings
  for (const b of artifact.template.bindings) {
    const key = b.path.join(".");
    const node = nodeByPath.get(key);
    if (!node) continue;
    if (b.kind === "text") {
      group.add(bindText(node, () => resolve(b.expr)));
    } else if (b.kind === "attr") {
      group.add(bindAttr(node as Element, b.target, () => resolve(b.expr)));
    } else if (b.kind === "bool") {
      group.add(bindBool(node as Element, b.target, () => resolve(b.expr)));
    } else if (b.kind === "aria") {
      group.add(bindAria(node as Element, b.target, () => resolve(b.expr)));
    } else if (b.kind === "conditional") {
      const el = node as Element;
      const anchor = document.createComment(`obix:if ${b.expr}`);
      el.parentNode?.insertBefore(anchor, el.nextSibling);
      group.add(bindPresence(el, anchor, () => resolve(b.expr)));
    }
  }

  // events
  for (const ev of artifact.template.events) {
    const node = nodeByPath.get(ev.path.join("."));
    if (!node) continue;
    group.addCleanup(bindEvent(node as Element, ev.event, () => instance.dispatch(ev.action)));
  }

  const unsub = instance.subscribe(() => group.update());
  if (artifact.style?.token) root.setAttribute(SCOPE_ATTR, artifact.style.token);
  container.appendChild(root);
  instance.startEffects();

  return {
    instance,
    unmount() {
      instance.stopEffects();
      unsub();
      group.dispose();
      root.remove();
    },
  };
}

function buildElement(
  el: TemplateElement,
  path: number[],
  index: Map<string, Node>,
): HTMLElement {
  const node = document.createElement(el.tag);
  index.set(path.join("."), node);
  for (const a of el.attrs) {
    if (a.directive === "event" || a.directive === "conditional") continue;
    if (a.interpolation != null) continue; // set by bindings
    if (a.value === null) node.setAttribute(a.name, "");
    else node.setAttribute(a.name, a.value);
  }
  el.children.forEach((child, i) => {
    const childPath = [...path, i];
    const dom = buildNode(child, childPath, index);
    if (dom) node.appendChild(dom);
  });
  return node;
}

function buildNode(node: TemplateNode, path: number[], index: Map<string, Node>): Node | null {
  if (node.kind === "text") {
    const t = document.createTextNode(node.value.replace(/\s+/g, " "));
    index.set(path.join("."), t);
    return t;
  }
  if (node.kind === "interpolation") {
    const t = document.createTextNode("");
    index.set(path.join("."), t);
    return t;
  }
  return buildElement(node, path, index);
}
