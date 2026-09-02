import test from "node:test";
import assert from "node:assert/strict";
import { resolvePath, buildScope, bindRoot } from "../dist/index.js";

// ── a tiny fake DOM, just the surface bindRoot() touches ────────────────────

class FakeText {
  constructor(value) {
    this.nodeType = 3;
    this.nodeValue = value;
    this.childNodes = [];
  }
}
class FakeEl {
  constructor(tag) {
    this.nodeType = 1;
    this.tagName = tag.toUpperCase();
    this.nodeValue = null;
    this.childNodes = [];
    this._attrs = new Map();
    this._listeners = new Map();
    this.hidden = false;
  }
  append(...kids) {
    this.childNodes.push(...kids);
    return this;
  }
  setAttribute(n, v) {
    this._attrs.set(n, String(v));
  }
  getAttribute(n) {
    return this._attrs.has(n) ? this._attrs.get(n) : null;
  }
  removeAttribute(n) {
    this._attrs.delete(n);
  }
  toggleAttribute(n, force) {
    const on = force ?? !this._attrs.has(n);
    if (on) this._attrs.set(n, "");
    else this._attrs.delete(n);
    return on;
  }
  getAttributeNames() {
    return [...this._attrs.keys()];
  }
  addEventListener(t, fn) {
    (this._listeners.get(t) ?? this._listeners.set(t, new Set()).get(t)).add(fn);
  }
  removeEventListener(t, fn) {
    this._listeners.get(t)?.delete(fn);
  }
  fire(t, ev = {}) {
    for (const fn of this._listeners.get(t) ?? []) fn(ev);
  }
  _descendants() {
    const out = [];
    const walk = (n) => {
      for (const c of n.childNodes) {
        if (c.nodeType === 1) {
          out.push(c);
          walk(c);
        }
      }
    };
    walk(this);
    return out;
  }
  querySelectorAll(sel) {
    assert.equal(sel, "*");
    return this._descendants();
  }
}

test("resolvePath walks dotted paths and tolerates gaps", () => {
  const scope = { a: { b: { c: 42 } }, x: 1 };
  assert.equal(resolvePath(scope, "a.b.c"), 42);
  assert.equal(resolvePath(scope, "x"), 1);
  assert.equal(resolvePath(scope, "a.nope.c"), undefined);
});

test("buildScope layers derived over state over props", () => {
  const s = buildScope({ n: 2 }, { n: 1, label: "p" }, { n: 3 });
  assert.equal(s.n, 3);
  assert.equal(s.label, "p");
  assert.equal(s.state.n, 2);
  assert.equal(s.props.n, 1);
});

test("text markers, event dispatch, attr + data-if bindings", () => {
  const root = new FakeEl("div");
  const out = new FakeEl("output").append(new FakeText("{label} ({count})"));
  const btn = new FakeEl("button");
  btn.setAttribute("data-on-click", "Inc");
  btn.setAttribute("data-bind-disabled", "atMax");
  const hint = new FakeEl("p");
  hint.setAttribute("data-if", "atMax");
  root.append(out, btn, hint);

  const dispatched = [];
  const binder = bindRoot(root, (a) => dispatched.push(a));

  binder.update(buildScope({ count: 1 }, {}, { label: "Count", atMax: false }));
  assert.equal(out.childNodes[0].nodeValue, "Count (1)");
  assert.equal(btn.getAttribute("disabled"), null);
  assert.equal(hint.hidden, true);

  btn.fire("click");
  assert.deepEqual(dispatched, ["Inc"]);

  binder.update(buildScope({ count: 9 }, {}, { label: "Count", atMax: true }));
  assert.equal(out.childNodes[0].nodeValue, "Count (9)");
  assert.equal(btn.getAttribute("disabled"), "");
  assert.equal(hint.hidden, false);

  binder.destroy();
  btn.fire("click");
  assert.deepEqual(dispatched, ["Inc"], "no dispatch after destroy()");
});

test("non-boolean bind attribute is set/removed by value", () => {
  const root = new FakeEl("div");
  const el = new FakeEl("div");
  el.setAttribute("data-bind-aria-label", "props.name");
  root.append(el);
  const binder = bindRoot(root, () => {});
  binder.update(buildScope({}, { name: "Timer" }, {}));
  assert.equal(el.getAttribute("aria-label"), "Timer");
  binder.update(buildScope({}, { name: null }, {}));
  assert.equal(el.getAttribute("aria-label"), null);
});
