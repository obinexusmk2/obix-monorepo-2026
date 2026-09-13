# `adapters/` — the `@obinexusltd/obix-adapter-*` set

Five **paradigm projections** of one Data-Oriented Programming (DOP) artifact.
Parallel to the frozen unscoped `packages/obix-adapter-*` graph — these are the
**scoped, zero-dependency** rebuild, from the `dop-adapter` / `dynamo` references.

| Package | Projection |
|---|---|
| [`@obinexusltd/obix-adapter-data`](./obix-adapter-data) | identity — caller threads state |
| [`@obinexusltd/obix-adapter-func`](./obix-adapter-func) | `reduce` / `replay` + a `create()` closure |
| [`@obinexusltd/obix-adapter-oop`](./obix-adapter-oop) | a generated class |
| [`@obinexusltd/obix-adapter-reactive`](./obix-adapter-reactive) | subscribers + effects lifecycle |
| [`@obinexusltd/obix-adapter-ssr`](./obix-adapter-ssr) | DOM-free string render **+ the compliance reference** |

## Rules this set follows

- **Zero dependencies.** No `dependencies`, no `devDependencies`. The shared
  ~2 KB reducer (`src/dop.ts`) and the artifact types (`src/types.ts`) are
  **vendored byte-identically** into each package.
- **One action path.** Every projection routes transitions through the same
  `reduce()` — the invariant the frozen `obix-ir` graph enforces, without the
  dependency (`obix/docs/obix-docs/GETTING-STARTED.md` §1: "state, actions,
  render, DOP — no dependencies").
- **Paradigm agnostic.** One artifact object satisfies all five packages via
  TypeScript structural typing (`OBIX_JSX_ADAPTER_ARCHITECTURE.md`).
- **Compliance.** For any action trace, `data`, `func`, `oop` and `reactive`
  render the identical HTML and reach the identical state as `ssr`.
  `@obinexusltd/obix` ships `checkCompliance()` to assert it.
- **`src/` ships to npm.** Each `package.json` `files` is
  `["src", "dist", "README.md", "LICENSE"]` and `exports` adds `"./src"`.

## The DOP artifact

```ts
interface DOPComponent<S, P = {}> {
  name: string;
  state: S;                                            // initial state
  props?: P;
  actions: Record<string, (ctx, payload?) => void>;    // mutate ctx.state (deep-cloned first)
  derived?: Record<string, (state, props) => unknown>;
  effects?: Record<string, { everyMs; while(state, props); dispatch }>;  // reactive only
  render?: (view: { state; props; derived }) => string;
  validate?: (state, props) => { valid: boolean; violations: string[] };
}
```

## Build & test

```bash
npm install                 # links the packages into node_modules/@obinexusltd/
npm run build:adapters      # tsc each package → dist/
node --test adapters/obix-adapter-*/test/
npm run demo:obix           # @obinexusltd/obix drives one component through all five
```
