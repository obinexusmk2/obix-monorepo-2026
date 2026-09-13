import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  renderToString,
  renderTrace,
  renderDocument,
  compliance,
  ComplianceError,
} from "../dist/index.js";

const Counter = {
  name: "Counter",
  state: { count: 0 },
  actions: {
    inc: (ctx, by = 1) => {
      ctx.state.count += by;
    },
  },
  derived: { label: (s) => `count: ${s.count}` },
  render: (v) => `<button aria-label="${v.derived.label}">${v.state.count}</button>`,
};

test("renderToString is a pure string fold", () => {
  assert.equal(renderToString(Counter), '<button aria-label="count: 0">0</button>');
  assert.equal(
    renderToString(Counter, { state: { count: 7 } }),
    '<button aria-label="count: 7">7</button>',
  );
});

test("renderTrace folds then renders", () => {
  assert.equal(
    renderTrace(Counter, [["inc"], ["inc"], ["inc"]]),
    '<button aria-label="count: 3">3</button>',
  );
});

test("renderDocument returns the html and the exact state", () => {
  const doc = renderDocument(Counter, { trace: [["inc"], ["inc"]] });
  assert.equal(doc.name, "Counter");
  assert.deepEqual(doc.state, { count: 2 });
  assert.equal(doc.html, '<button aria-label="count: 2">2</button>');
});

test("the compiled SSR module is DOM-free by construction", () => {
  // check the emitted JS (comments stripped by tsconfig removeComments), so the
  // banned words in this package's own doc-comments don't count.
  const dir = new URL("../dist/", import.meta.url);
  const code =
    readFileSync(new URL("index.js", dir), "utf8") + "\n" + readFileSync(new URL("dop.js", dir), "utf8");
  for (const banned of ["window", "document", "HTMLElement", "Element", "Node", "addEventListener"]) {
    assert.ok(
      !new RegExp(`\\b${banned}\\b`).test(code),
      `compiled ssr must not reference ${banned}`,
    );
  }
});

// --- compliance, exercised with inline stub projections (no sibling imports) ---
const agree = {
  Data: {
    apply: (c, s, a, p) => {
      const d = structuredClone(s);
      c.actions[a]({ state: d }, p);
      return d;
    },
    replay(c, t, from) {
      let s = from ?? c.state;
      for (const [a, p] of t) s = this.apply(c, s, a, p);
      return s;
    },
    render: (c, s) => c.render({ state: s, derived: { label: c.derived.label(s) } }),
  },
  Func: {
    toFunctional: (c) => ({
      create: ({ state } = {}) => {
        let s = structuredClone(state ?? c.state);
        return {
          dispatch(a, p) {
            c.actions[a]({ state: s }, p);
            return s;
          },
          getState: () => s,
          render: () => c.render({ state: s, derived: { label: c.derived.label(s) } }),
        };
      },
    }),
  },
  OOP: {
    toOOP: (c) =>
      class {
        constructor({ state } = {}) {
          this.state = structuredClone(state ?? c.state);
        }
        dispatch(a, p) {
          c.actions[a]({ state: this.state }, p);
          return this.state;
        }
        render() {
          return c.render({ state: this.state, derived: { label: c.derived.label(this.state) } });
        }
      },
  },
  Reactive: {
    toReactive: (c) => () => {
      let s = structuredClone(c.state);
      return {
        replay(t) {
          for (const [a, p] of t) c.actions[a]({ state: s }, p);
          return s;
        },
        get state() {
          return s;
        },
        render: () => c.render({ state: s, derived: { label: c.derived.label(s) } }),
      };
    },
  },
  SSR: { renderToString },
};

test("compliance() passes when every projection agrees", () => {
  const check = compliance(agree);
  const report = check(Counter, [["inc"], ["inc"], ["inc"]]);
  assert.equal(report.ok, true);
  assert.equal(report.reference.html, '<button aria-label="count: 3">3</button>');
  assert.deepEqual(
    report.rows.map((r) => r.projection),
    ["data", "func", "oop", "reactive", "ssr"],
  );
});

test("compliance() throws ComplianceError when a projection diverges", () => {
  const broken = {
    ...agree,
    OOP: {
      toOOP: () =>
        class {
          dispatch() {}
          get state() {
            return { count: 999 };
          }
          render() {
            return "<button>WRONG</button>";
          }
        },
    },
  };
  assert.throws(() => compliance(broken)(Counter, [["inc"]]), (err) => {
    assert.ok(err instanceof ComplianceError);
    assert.match(err.message, /oop/);
    return true;
  });
});
