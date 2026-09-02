/**
 * Canonical OBIX package graph — the single source of truth for:
 *   - which packages exist (exactly 20)
 *   - the allowed internal dependency edges
 *   - topological build / publish order
 *
 * Consumed by build-all, check-cycles, check-graph-rules, publish-all.
 */

export const SCOPE = "@obinexusltd";
export const PREFIX = "obix-";

/** The 20 public packages, in a stable canonical listing order. */
export const PACKAGES = [
  "obix-spec",
  "obix-ir",
  "obix-parser",
  "obix-compiler",
  "obix-template",
  "obix-styles",
  "obix-adapter-data",
  "obix-adapter-func",
  "obix-adapter-oop",
  "obix-adapter-reactive",
  "obix-adapter-native",
  "obix-adapter-ssr",
  "obix-runtime",
  "obix-effects",
  "obix-validator",
  "obix-test",
  "obix-accessibility",
  "obix-cli",
  "obix-language-server",
  "obix-timer",
];

/**
 * Allowed internal runtime dependencies (package.json "dependencies").
 * An edge A -> [B, C] means A may import from B and C, and nothing else
 * inside the @obinexusltd/obix-* family.
 */
export const GRAPH = {
  "obix-spec": [],
  "obix-ir": ["obix-spec"],
  "obix-parser": ["obix-spec"],
  "obix-template": ["obix-spec"],
  "obix-styles": ["obix-spec"],
  "obix-effects": ["obix-spec"],
  "obix-runtime": [],
  "obix-validator": ["obix-spec", "obix-ir"],
  "obix-accessibility": ["obix-spec", "obix-template"],
  "obix-adapter-data": ["obix-spec", "obix-ir"],
  "obix-adapter-func": ["obix-spec", "obix-ir"],
  "obix-adapter-oop": ["obix-spec", "obix-ir"],
  "obix-adapter-reactive": ["obix-spec", "obix-ir", "obix-effects"],
  "obix-adapter-ssr": ["obix-spec", "obix-ir"],
  "obix-adapter-native": ["obix-spec", "obix-ir", "obix-adapter-reactive", "obix-runtime"],
  "obix-compiler": [
    "obix-spec",
    "obix-ir",
    "obix-parser",
    "obix-template",
    "obix-styles",
    "obix-accessibility",
    "obix-validator",
  ],
  "obix-test": [
    "obix-spec",
    "obix-ir",
    "obix-validator",
    "obix-adapter-data",
    "obix-adapter-func",
    "obix-adapter-oop",
    "obix-adapter-reactive",
  ],
  "obix-cli": ["obix-compiler", "obix-test", "obix-validator"],
  "obix-language-server": ["obix-spec", "obix-parser", "obix-template", "obix-compiler"],
  "obix-timer": [
    "obix-spec",
    "obix-ir",
    "obix-adapter-data",
    "obix-adapter-func",
    "obix-adapter-oop",
    "obix-adapter-reactive",
  ],
};

/**
 * Hard architectural rules from Draft 0.2.1 §6 / §DEPENDENCY GRAPH RULES.
 * Each entry: [description, predicate(graph) => boolean-ok].
 */
export const RULES = [
  ["spec depends on nothing", (g) => g["obix-spec"].length === 0],
  ["runtime has no semantic/compiler deps", (g) => g["obix-runtime"].length === 0],
  ["ir does not depend on compiler", (g) => !g["obix-ir"].includes("obix-compiler")],
  ["parser does not depend on any adapter", (g) => !g["obix-parser"].some((d) => d.startsWith("obix-adapter-"))],
  ["validator does not depend on any adapter", (g) => !g["obix-validator"].some((d) => d.startsWith("obix-adapter-"))],
  ["validator does not depend on test", (g) => !g["obix-validator"].includes("obix-test")],
  ["no adapter depends on validator", (g) => PACKAGES.filter((p) => p.startsWith("obix-adapter-")).every((p) => !g[p].includes("obix-validator"))],
  ["no adapter depends on test", (g) => PACKAGES.filter((p) => p.startsWith("obix-adapter-")).every((p) => !g[p].includes("obix-test"))],
  ["no adapter depends on compiler", (g) => PACKAGES.filter((p) => p.startsWith("obix-adapter-")).every((p) => !g[p].includes("obix-compiler"))],
  ["runtime does not depend on compiler", (g) => !g["obix-runtime"].includes("obix-compiler")],
  ["effects does not depend on the reactive adapter", (g) => !g["obix-effects"].includes("obix-adapter-reactive")],
  ["ssr does not depend on the native adapter", (g) => !g["obix-adapter-ssr"].includes("obix-adapter-native")],
  ["ssr does not depend on runtime", (g) => !g["obix-adapter-ssr"].includes("obix-runtime")],
  ["ssr does not depend on the reactive adapter", (g) => !g["obix-adapter-ssr"].includes("obix-adapter-reactive")],
  ["accessibility does not depend on compiler", (g) => !g["obix-accessibility"].includes("obix-compiler")],
  ["compiler depends on accessibility (a11y is mandatory)", (g) => g["obix-compiler"].includes("obix-accessibility")],
  ["compiler depends on validator", (g) => g["obix-compiler"].includes("obix-validator")],
  ["test depends on the four pure adapters", (g) => ["data", "func", "oop", "reactive"].every((a) => g["obix-test"].includes(`obix-adapter-${a}`))],
  ["test does not depend on the native adapter", (g) => !g["obix-test"].includes("obix-adapter-native")],
  ["cli depends on compiler and test", (g) => g["obix-cli"].includes("obix-compiler") && g["obix-cli"].includes("obix-test")],
  ["language-server depends on parser and compiler", (g) => g["obix-language-server"].includes("obix-parser") && g["obix-language-server"].includes("obix-compiler")],
  ["timer is a leaf — nothing depends on it", (g) => PACKAGES.every((p) => !g[p].includes("obix-timer"))],
  ["timer is never a dep of compiler/runtime/adapters", (g) => ["obix-compiler", "obix-runtime", ...PACKAGES.filter((p) => p.startsWith("obix-adapter-"))].every((p) => !g[p].includes("obix-timer"))],
];

/** Kahn topological sort of GRAPH. Throws on cycle. */
export function topoSort(graph = GRAPH) {
  const indeg = new Map(Object.keys(graph).map((n) => [n, 0]));
  for (const n of Object.keys(graph)) for (const d of graph[n]) indeg.set(n, indeg.get(n) + 1);
  const queue = [...indeg.entries()].filter(([, d]) => d === 0).map(([n]) => n).sort();
  const order = [];
  while (queue.length) {
    const n = queue.shift();
    order.push(n);
    for (const m of Object.keys(graph)) {
      if (graph[m].includes(n)) {
        indeg.set(m, indeg.get(m) - 1);
        if (indeg.get(m) === 0) {
          queue.push(m);
          queue.sort();
        }
      }
    }
  }
  if (order.length !== Object.keys(graph).length) {
    const stuck = Object.keys(graph).filter((n) => !order.includes(n));
    throw new Error(`dependency cycle involves: ${stuck.join(", ")}`);
  }
  return order;
}

/** Detect cycles by DFS; returns array of cycles (each an array of node names). */
export function findCycles(graph = GRAPH) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map(Object.keys(graph).map((n) => [n, WHITE]));
  const stack = [];
  const cycles = [];
  const visit = (n) => {
    color.set(n, GRAY);
    stack.push(n);
    for (const d of graph[n] ?? []) {
      if (color.get(d) === GRAY) {
        const i = stack.indexOf(d);
        cycles.push(stack.slice(i).concat(d));
      } else if (color.get(d) === WHITE) {
        visit(d);
      }
    }
    stack.pop();
    color.set(n, BLACK);
  };
  for (const n of Object.keys(graph)) if (color.get(n) === WHITE) visit(n);
  return cycles;
}

export function pkgName(short) {
  return `${SCOPE}/${short}`;
}
