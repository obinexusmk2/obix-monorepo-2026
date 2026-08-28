/**
 * A tiny synchronous DOM good enough for obix-runtime / obix-adapter-native
 * Level 0 tests. Not spec-complete — just enough surface for the binding
 * helpers and mount().
 */
class MiniNode {
  constructor() {
    this.childNodes = [];
    this.parentNode = null;
    this._text = "";
  }
  get isConnected() {
    let n = this;
    while (n.parentNode) n = n.parentNode;
    return n._isDocument === true;
  }
  get nextSibling() {
    const p = this.parentNode;
    if (!p) return null;
    const i = p.childNodes.indexOf(this);
    return p.childNodes[i + 1] ?? null;
  }
  appendChild(child) {
    child.parentNode?.removeChild(child);
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }
  insertBefore(child, ref) {
    child.parentNode?.removeChild(child);
    child.parentNode = this;
    const i = ref ? this.childNodes.indexOf(ref) : -1;
    if (i === -1) this.childNodes.push(child);
    else this.childNodes.splice(i, 0, child);
    return child;
  }
  removeChild(child) {
    const i = this.childNodes.indexOf(child);
    if (i >= 0) this.childNodes.splice(i, 1);
    child.parentNode = null;
    return child;
  }
  remove() {
    this.parentNode?.removeChild(this);
  }
  get textContent() {
    if (this._text !== undefined && this.childNodes.length === 0) return this._text;
    return this.childNodes.map((c) => c.textContent).join("");
  }
  set textContent(v) {
    this._text = String(v);
    this.childNodes = [];
  }
}

class MiniText extends MiniNode {
  constructor(t = "") {
    super();
    this._text = String(t);
  }
}
class MiniComment extends MiniNode {
  constructor(t = "") {
    super();
    this._text = String(t);
  }
}

class MiniElement extends MiniNode {
  constructor(tag) {
    super();
    this.tagName = tag.toUpperCase();
    this.attributes = new Map();
    this._listeners = new Map();
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }
  hasAttribute(name) {
    return this.attributes.has(name);
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }
  addEventListener(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) {
    this._listeners.get(type)?.delete(fn);
  }
  dispatch(type, event = {}) {
    for (const fn of this._listeners.get(type) ?? []) fn(event);
  }
  querySelector() {
    return null;
  }
}

export function makeDocument() {
  const document = {
    _isDocument: true,
    createElement: (tag) => new MiniElement(tag),
    createTextNode: (t) => new MiniText(t),
    createComment: (t) => new MiniComment(t),
  };
  const root = new MiniElement("div");
  root.parentNode = document;
  document.body = root;
  return { document, root };
}

export function installGlobalDocument() {
  const { document, root } = makeDocument();
  globalThis.document = document;
  return { document, root };
}
