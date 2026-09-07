# @obinexusltd/obix-core-native

A **TypeScript-only registry** for native providers: declaration, host / OS /
arch / libc / ABI selection, lazy loading and managed handles. It contains no
native binary and no bridge, and it never loads native code on import or during
ordinary `doctor` inspection.

## The problem it owns

"Native support" is not one thing. A `.node` N-API addon, a raw
`.dll`/`.so`/`.dylib` behind an FFI bridge, Bun's `dlopen`, and Node's
flag-gated experimental FFI are **different providers** with different
prerequisites. Selecting one requires matching runtime, OS, arch and (on Linux)
libc/ABI. This package models that selection and the failure modes; it does not
invent a `LibPolyCall` / `NSIGII` / `PyTether` API, and a fake provider does
**not** qualify native compatibility.

## API

```ts
import {
  createNativeRegistry, probeNative,
  type NativeProviderSpec, type NativeHandle, type NativeRegistryAPI, type SelectResult,
} from "@obinexusltd/obix-core-native";
import { nodeApiProvider, inspectNodePolycall } from "@obinexusltd/obix-core-native/node";
```

| Export | Description |
|--------|-------------|
| `createNativeRegistry()` | `register(spec)` · `list()` (metadata, **no load**) · `select(op, host?)` → `{ ok, provider? , error? }` · `open(id, { signal? })` (lazy `spec.load()`) · `isSelectableHere(id)`. |
| `NativeProviderSpec` | `{ id, kind: "node-api"\|"ffi-bun"\|"ffi-node-experimental"\|"bridge", runtime[], os[], arch[], libc?, abi?, operations[], ownership: "caller-frees"\|"provider-managed", load() }`. |
| `NativeHandle` | `{ providerId, ownership, closed, call(op, …args), close() }`. `call` after `close` → `native/disposed`. |
| `probeNative(registry, operations)` | `{ operations: {…selectable, providerId?, reason}, executionTested: false, note }` — **selectability only**, never proof of a working call. |
| `nodeApiProvider({ id, addonPath, operations, … })` | `/node` — a `node-api` provider for a `.node` file. A non-`.node` path is rejected as `native/no-binary` (needs an FFI provider). Loads lazily via `createRequire`. |
| `inspectNodePolycall(fromDir?)` | `/node` — reads `@obinexusltd/node-polycall`'s declared `package.json` metadata (installed?, exports, version) **without importing or executing it**. |

## Example (JavaScript) — register + select, no load

```js
import { createNativeRegistry, probeNative } from "@obinexusltd/obix-core-native";

const reg = createNativeRegistry();
reg.register({
  id: "acme-hash", kind: "node-api",
  runtime: ["node"], os: ["linux", "win32"], arch: ["x64", "arm64"],
  abi: { napiVersion: 8 }, operations: ["hash"], ownership: "provider-managed",
  load: () => import("node:module").then(m => m.createRequire(import.meta.url)("./acme_hash.node")),
});

console.log(reg.select("hash").ok);           // true on a matching host
console.log(probeNative(reg, ["hash"]).executionTested); // false — always
```

## Example (TypeScript) — open + call + close

```ts
import { createNativeRegistry, type NativeHandle } from "@obinexusltd/obix-core-native";

const reg = createNativeRegistry();
reg.register(mySpec);

const sel = reg.select("compress");
if (!sel.ok) throw sel.error;                  // CompatError with a precise code

const h: NativeHandle = await reg.open(sel.provider!.id);
try {
  const out = await h.call<Uint8Array>("compress", input);
} finally {
  await h.close();                             // idempotent
}
```

## Host support (verified 2026-09-07)

| Concern | Status |
|---------|--------|
| Registry, selection, host/arch/abi matching, lifecycle | ✅ tested — Node 26.7.0 / Deno 2.9.6 / Bun 1.4.2, Win x64 |
| `ffi-node-experimental` gated to `runtime === "node"` | ✅ tested (Deno/Bun correctly get `native/no-provider`) |
| `nodeApiProvider` rejects non-`.node` paths | ✅ tested |
| **Native execution** (a real addon actually runs) | ❌ **not-tested** — no N-API/FFI provider, compiled `.node` fixture or `node-gyp` toolchain is proven in this environment |

Linux/macOS, other arch/libc: `not-tested`.

## Fallbacks

There is intentionally **no fallback that executes native code**. If `select()`
fails you get a specific `CompatError`; choosing to degrade (pure-JS path,
skip the feature) is the caller's decision, made from that code.

## Errors

`CompatError`: `native/no-provider`, `native/arch-mismatch`,
`native/abi-mismatch`, `native/denied`, `native/no-binary` (loader threw
`ENOENT`), `native/failure` (loader threw otherwise), `native/disposed`.

## Boundary

No binary, no build step, no FFI bindings shipped. `inspectNodePolycall` is
metadata-only and never assumes an API. Native execution must be qualified
separately with a real provider + fixture on the exact runtime/OS/arch/libc.

MIT — OBINexus Computing
