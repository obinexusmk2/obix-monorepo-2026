# Module resolution & loading — design notes

## Why a wrapper over `import()` at all

The host already has `import()` and `import.meta.resolve`. This package exists to
give the CLI **one behaviour** and **one error vocabulary** across three hosts
whose `import.meta.resolve` differ, and to keep asset resolution anchored to the
*owning module* rather than the process working directory.

## `resolveModule(specifier, parentURL)`

| Input | Result |
|-------|--------|
| `./x.js`, `../a/b.js`, `/abs/x.js` | `kind: "url"`, a concrete `file:` URL. `#` and `?` in the path are percent-encoded (`%23` / `%3F`) **before** `new URL()` so they are treated as path characters, not fragment/query. |
| bare (`lodash`, `@scope/pkg/sub`) | `import.meta.resolve(spec, parentURL)` when the host honours the 2nd argument (Node) → `kind: "url"`. Otherwise `kind: "bare"` — the specifier is returned unchanged (`via: "passthrough"`) for the host loader to resolve. |

`kind: "bare"` is **not** an error. Deno and Bun ignore or reject the 2nd
argument of `import.meta.resolve`; passthrough is the correct, documented
behaviour there — the subsequent `import()` in `loadModule` still resolves it.

## `loadModule` error classification

```
resolve fails                     -> module/resolve
resolved, import() throws          -> module/load   (cause = host error)
resolved, imported, export missing -> module/load   ("no such export: <action>")
```

The host's stack trace is attached as `cause`, not surfaced as the message.

## `resolveAsset(assetSpecifier, ownerURL)`

Always resolved relative to `ownerURL` (the module that ships the asset), never
`process.cwd()`. A CLI invoked from any directory therefore finds a package's
bundled data files.

## `validatePackageSet`

Given the installed manifests of a family (`@scope/foo-*`) and an expected exact
version, reports:

| problem | meaning |
|---------|---------|
| `version-mismatch` | a family package is not at `expectedVersion` |
| `range-not-exact` | a dependency range uses `^`/`~`/`*` instead of an exact pin |
| `missing` | a manifest references a family package not present in the set |
| `duplicate-version` | the same family package appears at two versions |

This is what lets `obix doctor` assert the ten `obix-core-*` packages are one
coherent install.

## Not implemented

Synchronous CommonJS `require`. Only the asynchronous `import()` baseline is
provided; the README and types say so explicitly rather than shipping a
half-working sync path.
