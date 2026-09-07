import { CompatError } from "@obinexusltd/obix-core-capabilities";
import { createScheduler } from "@obinexusltd/obix-core-scheduler";
import { requireDom } from "./index.js";
export { requireDom, inspectWebSupport } from "./index.js";
function snapshotFocus(root) {
    const active = (root.ownerDocument ?? document).activeElement;
    if (!active || !root.contains(active))
        return { path: null, selStart: null, selEnd: null };
    const path = [];
    let el = active;
    while (el && el !== root) {
        const parent = el.parentElement;
        if (!parent)
            break;
        path.unshift(Array.prototype.indexOf.call(parent.children, el));
        el = parent;
    }
    const input = active;
    const canSelect = typeof input.selectionStart === "number";
    return {
        path,
        selStart: canSelect ? input.selectionStart : null,
        selEnd: canSelect ? input.selectionEnd : null,
    };
}
function restoreFocus(root, snap) {
    if (!snap.path)
        return;
    let el = root;
    for (const i of snap.path) {
        el = el?.children?.[i] ?? null;
        if (!el)
            return;
    }
    if (el && typeof el.focus === "function") {
        el.focus();
        const input = el;
        if (snap.selStart != null && typeof input.setSelectionRange === "function") {
            try {
                input.setSelectionRange(snap.selStart, snap.selEnd ?? snap.selStart);
            }
            catch {
            }
        }
    }
}
export function attachWebHost(el, artifact, opts = {}) {
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
    let lastHtml = null;
    let instance = null;
    const sched = opts.coalesce === true ? createScheduler() : typeof opts.coalesce === "object" ? opts.coalesce : null;
    const ownsSched = opts.coalesce === true;
    let pendingState;
    let hasPending = false;
    let repaintToken = null;
    function apply(state) {
        if (instance)
            instance.update(state);
        else
            paint(state);
    }
    function flush() {
        repaintToken = null;
        if (!hasPending || detached)
            return;
        hasPending = false;
        const s = pendingState;
        pendingState = undefined;
        apply(s);
    }
    function paint(state) {
        const html = artifact.render(state);
        if (html === lastHtml)
            return;
        const snap = snapshotFocus(el);
        el.innerHTML = html;
        lastHtml = html;
        restoreFocus(el, snap);
    }
    if (opts.adapter) {
        instance = opts.adapter.mount(el, artifact);
    }
    else {
        paint(artifact.state);
    }
    return {
        update(state) {
            if (detached)
                return;
            if (!sched) {
                apply(state);
                return;
            }
            pendingState = state;
            hasPending = true;
            if (!repaintToken)
                repaintToken = sched.schedule(flush, 0);
        },
        detach() {
            if (detached)
                return;
            detached = true;
            if (repaintToken && sched)
                sched.cancel(repaintToken);
            repaintToken = null;
            hasPending = false;
            if (ownsSched && sched)
                sched.dispose();
            if (instance)
                instance.destroy();
            else
                el.innerHTML = "";
            lastHtml = null;
        },
        get detached() {
            return detached;
        },
    };
}
export function detachWebHost(handle) {
    handle.detach();
}
const DEFINED = new Set();
export function defineElement(tagName, opts) {
    requireDom("defineElement");
    if (DEFINED.has(tagName) || customElements.get(tagName)) {
        return;
    }
    DEFINED.add(tagName);
    class ObixHostElement extends HTMLElement {
        #handle = null;
        #artifact = null;
        #state = undefined;
        static get observedAttributes() {
            return opts.observedAttributes ?? [];
        }
        connectedCallback() {
            if (this.#handle && !this.#handle.detached)
                return;
            const artifact = opts.create(this);
            let state = artifact.state;
            const attrAction = artifact.actions?.["attributeChanged"];
            if (attrAction) {
                for (const name of opts.observedAttributes ?? []) {
                    if (this.hasAttribute(name))
                        state = attrAction(state, name, this.getAttribute(name));
                }
            }
            this.#artifact = artifact;
            this.#state = state;
            this.#handle = attachWebHost(this, { ...artifact, state }, {
                adapter: opts.adapter,
                coalesce: opts.coalesce,
            });
        }
        disconnectedCallback() {
            queueMicrotask(() => {
                if (!this.isConnected && this.#handle) {
                    this.#handle.detach();
                    this.#handle = null;
                    this.#artifact = null;
                    this.#state = undefined;
                }
            });
        }
        attributeChangedCallback(name, _old, value) {
            const attrAction = this.#artifact?.actions?.["attributeChanged"];
            if (attrAction && this.#handle && !this.#handle.detached) {
                this.#state = attrAction(this.#state, name, value);
                this.#handle.update(this.#state);
            }
        }
    }
    customElements.define(tagName, ObixHostElement);
}
//# sourceMappingURL=dom.js.map