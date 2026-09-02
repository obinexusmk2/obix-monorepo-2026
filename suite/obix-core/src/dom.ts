/**
 * obix-core / dom — the runtime template binder.
 *
 * No compiler and no virtual DOM. A component's `.html` is plain markup with
 * three kinds of marker, scanned **once** on mount and refreshed on every store
 * change:
 *
 *   {dotted.path}                 text interpolation
 *   data-on-<event>="ActionName"  dispatch on a DOM event
 *   data-bind-<attr>="path"       set / toggle an attribute from state
 *   data-if="path"                toggle `hidden` from state
 *
 * Paths resolve against a scope built from `derived` over `state` over `props`,
 * with `state` / `props` / `derived` also available as namespaces.
 */

const BOOLEAN_ATTRS = new Set([
  "disabled", "checked", "hidden", "readonly", "required", "selected",
  "open", "multiple", "autofocus", "inert", "novalidate",
]);

const MARKER = /\{([^{}]+)\}/g;

export interface BindScope {
  state: object;
  props: object;
  derived: object;
  [key: string]: unknown;
}

/** Merge `derived` over `state` over `props`, keeping the three namespaces too. */
export function buildScope(state: object, props: object, derived: object): BindScope {
  return { ...props, ...state, ...derived, state, props, derived };
}

/** Resolve `"a.b.c"` against `scope`; `undefined` for any missing hop. */
export function resolvePath(scope: unknown, path: string): unknown {
  return path
    .trim()
    .split(".")
    .reduce<unknown>((acc, key) => (acc == null ? undefined : (acc as Record<string, unknown>)[key]), scope);
}

function stringify(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

/** Parse an HTML string into a `DocumentFragment` (browser only). */
export function parseTemplate(html: string): DocumentFragment {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  return tpl.content;
}

/** Attach `css` to a shadow root, preferring a constructable stylesheet. */
export function adoptStyles(root: ShadowRoot, css: string): void {
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    return;
  } catch {
    /* fall through */
  }
  const style = document.createElement("style");
  style.textContent = css;
  root.appendChild(style);
}

// ── the binder ──────────────────────────────────────────────────────────────

/** Minimal structural surface the binder needs — satisfied by real DOM nodes. */
interface NodeLike {
  nodeType: number;
  nodeValue: string | null;
  childNodes: ArrayLike<NodeLike>;
}
interface RootLike {
  childNodes: ArrayLike<NodeLike>;
  querySelectorAll(selectors: string): ArrayLike<ElementLike>;
}
interface ElementLike {
  getAttributeNames?(): string[];
  attributes?: ArrayLike<{ name: string }>;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  toggleAttribute(name: string, force?: boolean): boolean;
  addEventListener(type: string, listener: (ev: unknown) => void): void;
  removeEventListener(type: string, listener: (ev: unknown) => void): void;
  hidden?: boolean;
}

interface TextBinding {
  node: NodeLike;
  template: string;
}
interface AttrBinding {
  el: ElementLike;
  attr: string;
  path: string;
}
interface IfBinding {
  el: ElementLike;
  path: string;
}
interface EventBinding {
  el: ElementLike;
  type: string;
  listener: (ev: unknown) => void;
}

export interface BinderHandle {
  /** Re-evaluate every text / attribute / `data-if` binding. */
  update(scope: BindScope): void;
  /** Detach every event listener registered by this binder. */
  destroy(): void;
}

function attrNames(el: ElementLike): string[] {
  if (typeof el.getAttributeNames === "function") return el.getAttributeNames();
  return el.attributes ? Array.from(el.attributes, (a) => a.name) : [];
}

function collectText(node: NodeLike, out: TextBinding[]): void {
  const kids = node.childNodes;
  for (let i = 0; i < kids.length; i++) {
    const child = kids[i]!;
    if (child.nodeType === 3) {
      const raw = child.nodeValue ?? "";
      if (raw.includes("{") && MARKER.test(raw)) {
        MARKER.lastIndex = 0;
        out.push({ node: child, template: raw });
      }
    } else if (child.nodeType === 1) {
      collectText(child, out);
    }
  }
}

export function bindRoot(
  root: RootLike,
  onDispatch: (action: string, payload?: unknown) => void,
): BinderHandle {
  const texts: TextBinding[] = [];
  collectText(root as unknown as NodeLike, texts);

  const attrs: AttrBinding[] = [];
  const ifs: IfBinding[] = [];
  const events: EventBinding[] = [];

  const elements = root.querySelectorAll("*");
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]!;
    for (const name of attrNames(el)) {
      const value = el.getAttribute(name) ?? "";
      if (name === "data-if") {
        ifs.push({ el, path: value });
      } else if (name.startsWith("data-on-")) {
        const type = name.slice("data-on-".length);
        const listener = (ev: unknown): void => {
          (ev as { preventDefault?: () => void } | undefined)?.preventDefault?.();
          onDispatch(value);
        };
        el.addEventListener(type, listener);
        events.push({ el, type, listener });
      } else if (name.startsWith("data-bind-")) {
        attrs.push({ el, attr: name.slice("data-bind-".length), path: value });
      }
    }
  }

  return {
    update(scope) {
      for (const t of texts) {
        t.node.nodeValue = t.template.replace(MARKER, (_m, path: string) =>
          stringify(resolvePath(scope, path)),
        );
      }
      for (const b of attrs) {
        const v = resolvePath(scope, b.path);
        if (BOOLEAN_ATTRS.has(b.attr)) {
          b.el.toggleAttribute(b.attr, Boolean(v));
        } else if (v == null || v === false) {
          b.el.removeAttribute(b.attr);
        } else {
          b.el.setAttribute(b.attr, stringify(v));
        }
      }
      for (const b of ifs) {
        b.el.hidden = !resolvePath(scope, b.path);
      }
    },
    destroy() {
      for (const e of events) e.el.removeEventListener(e.type, e.listener);
      events.length = 0;
    },
  };
}
