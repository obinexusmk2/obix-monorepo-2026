/**
 * obix-core / element — `ObixElement`, the standard Custom Element base.
 *
 * `defineElement(def)` registers `def.tag` as a real Web Component. The element
 * owns an open shadow root, adopts the component's CSS, clones its HTML template
 * once, and wires the `{marker}` / `data-on-*` / `data-bind-*` / `data-if`
 * bindings (see `./dom`) to a data-oriented `store` (see `./store`).
 *
 * Lifecycle is surfaced as bubbling `CustomEvent`s: `obix:created`,
 * `obix:updated`, `obix:halted`, `obix:destroyed`.
 */
import type { ComponentDef, ObixProps, ObixState } from "./spec.js";
import { kebab } from "./spec.js";
import { createStore, type Store } from "./store.js";
import { adoptStyles, bindRoot, buildScope, parseTemplate, type BinderHandle } from "./dom.js";
import { auditRoot, hasBlockingA11yError } from "./a11y.js";

const isDev = (): boolean => {
  try {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    return env?.["NODE_ENV"] !== "production";
  } catch {
    return true;
  }
};

async function resolveText(source: string | URL | undefined): Promise<string> {
  if (source == null) return "";
  if (typeof source === "string") return source;
  const res = await fetch(source);
  if (!res.ok) throw new Error(`obix-core: failed to load ${String(source)} (${res.status})`);
  return res.text();
}

function coerceAttr(raw: string | null, sample: unknown, attrName: string): unknown {
  if (raw === null) return sample;
  if (typeof sample === "number") {
    const n = Number(raw);
    return Number.isNaN(n) ? sample : n;
  }
  if (typeof sample === "boolean") return raw === "" || raw === "true" || raw === attrName;
  return raw;
}

/** The class produced for a given `ComponentDef`. Extends `HTMLElement`. */
export function makeElementClass<S extends object, P extends object>(
  def: ComponentDef<S, P>,
): CustomElementConstructor {
  const propKeys = (def.observedAttributes ?? (Object.keys(def.props ?? {}) as (keyof P & string)[]));
  const attrForKey = new Map(propKeys.map((k) => [kebab(k), k] as const));

  class ObixElement extends HTMLElement {
    static readonly observedAttributes = [...attrForKey.keys()];

    #store: Store<S, P> | null = null;
    #binder: BinderHandle | null = null;
    #unsubscribe: (() => void) | null = null;
    #props: P = { ...(def.props ?? {}) } as P;
    #connected = false;

    get store(): Store<S, P> | null {
      return this.#store;
    }

    async connectedCallback(): Promise<void> {
      if (this.#connected) return;
      this.#connected = true;

      for (const [attr, key] of attrForKey) {
        (this.#props as Record<string, unknown>)[key] = coerceAttr(
          this.getAttribute(attr),
          (def.props ?? ({} as P))[key],
          attr,
        );
      }

      const [templateHtml, css] = await Promise.all([
        resolveText(def.template),
        resolveText(def.styles),
      ]);
      if (!this.isConnected) return;

      const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
      if (css) adoptStyles(root, css);
      if (templateHtml) root.appendChild(parseTemplate(templateHtml));

      this.#store = createStore(def, { props: this.#props });
      this.#binder = bindRoot(root, (action, payload) => this.#store?.dispatch(action, payload));
      this.#unsubscribe = this.#store.subscribe(() => this.#render("obix:updated"));

      this.#render("obix:created");

      if (isDev()) {
        const diagnostics = auditRoot(root);
        for (const d of diagnostics) {
          const line = `[obix a11y] ${d.code} ${d.message}`;
          if (d.severity === "error") console.error(line);
          else console.warn(line);
        }
        if (hasBlockingA11yError(diagnostics)) {
          console.error(`[obix a11y] <${def.tag}> has blocking accessibility errors`);
        }
      }
    }

    attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
      const key = attrForKey.get(name);
      if (!key || !this.#connected) return;
      (this.#props as Record<string, unknown>)[key] = coerceAttr(value, (def.props ?? ({} as P))[key], name);
      if (this.#store) {
        const carried = this.#store.state;
        this.#store.destroy();
        this.#store = createStore(def, { state: carried, props: this.#props });
        this.#unsubscribe?.();
        this.#unsubscribe = this.#store.subscribe(() => this.#render("obix:updated"));
        this.#render("obix:updated");
      }
    }

    disconnectedCallback(): void {
      this.#unsubscribe?.();
      this.#binder?.destroy();
      this.#store?.destroy();
      this.#store = null;
      this.#binder = null;
      this.#connected = false;
      this.#emit("obix:destroyed");
    }

    halt(): void {
      this.#store?.halt();
      this.#emit("obix:halted");
    }

    resume(): void {
      this.#store?.resume();
    }

    #render(event: string): void {
      if (!this.#store || !this.#binder) return;
      this.#binder.update(buildScope(this.#store.state, this.#store.props, this.#store.derived()));
      this.#emit(event);
    }

    #emit(type: string): void {
      this.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail: { tag: def.tag } }));
    }
  }

  return ObixElement as CustomElementConstructor;
}

/**
 * Register `def` as a custom element. Idempotent, and a safe no-op in a non-DOM
 * environment (headless tests) — the registry is looked up lazily, never
 * referenced at module load.
 */
export function defineElement<S extends object, P extends object>(
  def: ComponentDef<S, P>,
  registry?: CustomElementRegistry,
): void {
  const reg =
    registry ?? (globalThis as { customElements?: CustomElementRegistry }).customElements;
  if (!reg) return;
  if (reg.get(def.tag)) return;
  reg.define(def.tag, makeElementClass(def));
}
