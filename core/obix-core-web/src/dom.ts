/**
 * @obinexusltd/obix-core-web/dom
 *
 * Browser-only. This is the ONLY entrypoint that reads DOM globals or calls
 * `customElements.define`. It delegates mounting to an injected `MountAdapter`
 * (the existing, verified one) and adds ownership tracking around it:
 *   - focus + selection are preserved across a re-render (no blind
 *     full-container replacement that drops the caret)
 *   - repaints coalesce through @obinexusltd/obix-core-scheduler when the caller
 *     opts in, so an attribute burst produces one write, not N
 *   - reconnecting a custom element does not double-subscribe or double-mount
 *   - `detach` / `disconnectedCallback` run cleanup exactly once
 */
import { CompatError } from "@obinexusltd/obix-core-capabilities";
import { createScheduler, type SchedulerAPI, type TimerToken } from "@obinexusltd/obix-core-scheduler";
import { requireDom, type MountAdapter, type MountInstance, type WebArtifact } from "./index.js";

export { requireDom, inspectWebSupport } from "./index.js";
export type { MountAdapter, MountInstance, WebArtifact } from "./index.js";

export interface WebHostHandle {
  update(state: unknown): void;
  detach(): void;
  readonly detached: boolean;
}

export interface AttachOptions {
  /** The *existing*, verified DOM mount adapter. Omitted => built-in string paint. */
  adapter?: MountAdapter;
  /**
   * Coalesce synchronous `update()` bursts into one paint. Pass a scheduler to
   * control the clock (tests inject a virtual clock); pass `true` to use a
   * default scheduler over the system clock. Omitted => paint synchronously.
   */
  coalesce?: SchedulerAPI | boolean;
}

interface FocusSnapshot {
  path: number[] | null;
  selStart: number | null;
  selEnd: number | null;
}

function snapshotFocus(root: Element): FocusSnapshot {
  const active = (root.ownerDocument ?? document).activeElement;
  if (!active || !root.contains(active)) return { path: null, selStart: null, selEnd: null };
  const path: number[] = [];
  let el: Element | null = active;
  while (el && el !== root) {
    const parent: Element | null = el.parentElement;
    if (!parent) break;
    path.unshift(Array.prototype.indexOf.call(parent.children, el));
    el = parent;
  }
  const input = active as HTMLInputElement;
  const canSelect = typeof input.selectionStart === "number";
  return {
    path,
    selStart: canSelect ? input.selectionStart : null,
    selEnd: canSelect ? input.selectionEnd : null,
  };
}

function restoreFocus(root: Element, snap: FocusSnapshot): void {
  if (!snap.path) return;
  let el: Element | null = root;
  for (const i of snap.path) {
    el = el?.children?.[i] ?? null;
    if (!el) return;
  }
  if (el && typeof (el as HTMLElement).focus === "function") {
    (el as HTMLElement).focus();
    const input = el as HTMLInputElement;
    if (snap.selStart != null && typeof input.setSelectionRange === "function") {
      try {
        input.setSelectionRange(snap.selStart, snap.selEnd ?? snap.selStart);
      } catch {
        /* not a text input */
      }
    }
  }
}

/**
 * Attach an artifact to `el`. If `adapter` is given, mounting is delegated to it.
 * Otherwise a minimal built-in renderer is used: it writes `render(state)` into
 * `el` **only when the markup changed**, snapshotting and restoring focus +
 * caret around the write.
 */
export function attachWebHost(el: Element, artifact: WebArtifact, opts: AttachOptions = {}): WebHostHandle {
  requireDom("attachWebHost");
  if (!(el instanceof Element)) {
    throw new CompatError({
      code: "web/dom-required",
      package: "obix-core-web",
      operation: "attachWebHost",
      reason: "first argument must be a DOM Element",
    });
  }

  let detached = false;
  let lastHtml: string | null = null;
  let instance: MountInstance | null = null;

  // Repaint coalescing (opt-in). Owns its scheduler only when it created one.
  const sched: SchedulerAPI | null =
    opts.coalesce === true ? createScheduler() : typeof opts.coalesce === "object" ? opts.coalesce : null;
  const ownsSched = opts.coalesce === true;
  let pendingState: unknown;
  let hasPending = false;
  let repaintToken: TimerToken | null = null;

  function apply(state: unknown): void {
    if (instance) instance.update(state);
    else paint(state);
  }

  function flush(): void {
    repaintToken = null;
    if (!hasPending || detached) return;
    hasPending = false;
    const s = pendingState;
    pendingState = undefined;
    apply(s);
  }

  function paint(state: unknown): void {
    const html = artifact.render(state);
    if (html === lastHtml) return;
    const snap = snapshotFocus(el);
    el.innerHTML = html; // scoped to this element, not the whole container/document
    lastHtml = html;
    restoreFocus(el, snap);
  }

  if (opts.adapter) {
    instance = opts.adapter.mount(el, artifact);
  } else {
    paint(artifact.state);
  }

  return {
    update(state: unknown) {
      if (detached) return;
      if (!sched) {
        apply(state);
        return;
      }
      pendingState = state;
      hasPending = true;
      if (!repaintToken) repaintToken = sched.schedule(flush, 0);
    },
    detach() {
      if (detached) return;
      detached = true;
      if (repaintToken && sched) sched.cancel(repaintToken);
      repaintToken = null;
      hasPending = false;
      if (ownsSched && sched) sched.dispose();
      if (instance) instance.destroy();
      else el.innerHTML = "";
      lastHtml = null;
    },
    get detached() {
      return detached;
    },
  };
}

/** Idempotent detach for a handle. */
export function detachWebHost(handle: WebHostHandle): void {
  handle.detach();
}

export interface DefineElementOptions {
  /** Build the artifact for one element instance (given the element). */
  create: (host: HTMLElement) => WebArtifact;
  adapter?: MountAdapter;
  /** Coalesce attribute-change repaint bursts. See {@link AttachOptions.coalesce}. */
  coalesce?: SchedulerAPI | boolean;
  /** Observed attributes forwarded as an `attributeChanged` action, if present. */
  observedAttributes?: string[];
}

const DEFINED = new Set<string>();

/**
 * Register a custom element that mounts an OBIX artifact. The ONLY call to
 * `customElements.define` in this package. Reconnecting the element (moved in
 * the DOM) re-attaches without leaking the previous mount; disconnect cleans up
 * exactly once.
 */
export function defineElement(tagName: string, opts: DefineElementOptions): void {
  requireDom("defineElement");
  if (DEFINED.has(tagName) || customElements.get(tagName)) {
    return; // idempotent — never double-define
  }
  DEFINED.add(tagName);

  class ObixHostElement extends HTMLElement {
    #handle: WebHostHandle | null = null;
    #artifact: WebArtifact | null = null;
    /** Running state, folded forward across attribute changes. */
    #state: unknown = undefined;

    static get observedAttributes(): string[] {
      return opts.observedAttributes ?? [];
    }

    connectedCallback(): void {
      if (this.#handle && !this.#handle.detached) return; // moved, not re-created
      const artifact = opts.create(this);
      // Fold the element's current observed-attribute values into the initial
      // state before the first paint. `attributeChangedCallback` also fires
      // during upgrade, but earlier than this and while `#handle` is null, so it
      // is ignored there — this is the single, ordered application.
      let state = artifact.state;
      const attrAction = artifact.actions?.["attributeChanged"];
      if (attrAction) {
        for (const name of opts.observedAttributes ?? []) {
          if (this.hasAttribute(name)) state = attrAction(state, name, this.getAttribute(name));
        }
      }
      this.#artifact = artifact;
      this.#state = state;
      this.#handle = attachWebHost(this, { ...artifact, state }, {
        adapter: opts.adapter,
        coalesce: opts.coalesce,
      });
    }

    disconnectedCallback(): void {
      // A move fires disconnect then connect synchronously; defer cleanup so a
      // reconnect in the same tick keeps the mount.
      queueMicrotask(() => {
        if (!this.isConnected && this.#handle) {
          this.#handle.detach();
          this.#handle = null;
          this.#artifact = null;
          this.#state = undefined;
        }
      });
    }

    attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
      const attrAction = this.#artifact?.actions?.["attributeChanged"];
      if (attrAction && this.#handle && !this.#handle.detached) {
        this.#state = attrAction(this.#state, name, value);
        this.#handle.update(this.#state);
      }
    }
  }

  customElements.define(tagName, ObixHostElement);
}
