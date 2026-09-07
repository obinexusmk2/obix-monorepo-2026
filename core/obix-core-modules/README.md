# @obinexusltd/obix-core-modules

Portable ES-module resolution, loading and package-set validation for the OBIX
CLI. The **portable root** touches no filesystem — it composes the host's own
`import()` and `import.meta.resolve`; the `/node` subpath adds disk-backed asset
copying.

## The problem it owns

A CLI needs to resolve and load *user* modules (config files, plugins, job
modules) the same way on Node, Deno and Bun, classify "not found" vs "no such
export" without leaking host stack traces, and confirm that an installed family
of packages (`@scope/foo-*`) is at one exact version. It must **not** promise
synchronous CommonJS `require` — only the asynchronous `import()` baseline is
implemented.

## API

```ts
import {
  createModuleResolver, modules,
  type ModuleResolverAPI, type ResolvedSpecifier, type LoadResult,
  type InstalledManifest, type PackageSetReport,
} from "@obinexusltd/obix-core-modules";
import { createNodeModuleResolver, copyAssets } from "@obinexusltd/obix-core-modules/node";
```

| Export | Description |
|--------|-------------|
| `createModuleResolver(hooks?)` | Resolver bound to injected `importImpl` / `resolveImpl`, else the host's `import()` and `import.meta.resolve`. |
| `modules` | A ready resolver bound to this host. |
| `resolveModule(specifier, parentURL)` | Relative specifiers → a concrete `file:` URL (`#`/`?` in a path are percent-encoded first); bare specifiers → `import.meta.resolve` when the host honours the 2nd arg, else `kind:"bare"` passthrough for the host loader. |
| `loadModule(specifier, parentURL)` | Resolve then `await import()`. Classifies `module/resolve` (not found) vs `module/load` (found, failed to evaluate / missing export). |
| `resolveAsset(assetSpecifier, ownerURL)` | Resolve a data file **relative to the module that owns it**, never `process.cwd()`. |
| `validatePackageSet(manifests, { familyPrefix, expectedVersion })` | Reports `version-mismatch`, `range-not-exact`, `missing`, `duplicate-version`. |
| `createNodeModuleResolver()` / `copyAssets(specs)` | `/node` — same resolver plus real asset copying (`fs`). |

## Example (JavaScript)

```js
import { modules } from "@obinexusltd/obix-core-modules";

const here = import.meta.url;
const r = modules.resolveModule("./plugins/logger.js", here);
console.log(r.kind, r.resolved); // "url" file:///…/plugins/logger.js

const { namespace } = await modules.loadModule("./plugins/logger.js", here);
namespace.register?.();
```

## Example (TypeScript)

```ts
import { modules, type PackageSetReport } from "@obinexusltd/obix-core-modules";

const report: PackageSetReport = modules.validatePackageSet(
  [
    { name: "@acme/ui-core", version: "2.1.0", dependencies: { "@acme/ui-theme": "2.1.0" } },
    { name: "@acme/ui-theme", version: "2.1.0" },
  ],
  { familyPrefix: "@acme/ui-", expectedVersion: "2.1.0" },
);
if (!report.ok) for (const p of report.problems) console.error(p.kind, p.package, "-", p.detail);
```

## Host support (verified 2026-09-07)

| Runtime | `resolveModule` bare kind | Notes |
|---------|--------------------------|-------|
| Node 26.7.0 / Win x64 | `url` | `import.meta.resolve(spec, parentURL)` honours the parent arg |
| Deno 2.9.6 / Win x64 | `bare` (passthrough) | 2-arg `import.meta.resolve` not honoured — the host loader resolves |
| Bun 1.4.2 / Win x64 | `bare` (passthrough) | same as Deno |
| browser / web worker | authored, not run here | relative → URL works; bare needs an import map |

Linux/macOS and Node 22/24 LTS: authored, `not-tested`.

## Fallbacks

- Bare specifier where the host cannot resolve against `parentURL` → `kind:"bare"`;
  the value is handed to the host loader unchanged (documented, not an error).
- `resolveAsset` always resolves against the owner URL, so a CLI run from any cwd
  finds a package's bundled data.

## Errors

`CompatError` only: `module/resolve` (specifier did not resolve / file absent),
`module/load` (resolved but failed to evaluate, or the named export is missing).
The host's own error is attached as `cause`.

## Boundary

No filesystem in the portable root. It does not implement CommonJS `require`, a
bundler, or a plugin lifecycle — only resolve + load + validate.

MIT — OBINexus Computing
