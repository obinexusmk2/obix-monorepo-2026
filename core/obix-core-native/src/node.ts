/**
 * @obinexusltd/obix-core-native/node
 *
 * Node helpers for building providers: load a `.node` Node-API addon, and
 * *inspect* (never execute) an installed `@obinexusltd/node-polycall`.
 * Importing this touches `node:module`; it does NOT load any native code.
 */
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { extname } from "node:path";
import { CompatError } from "@obinexusltd/obix-core-capabilities";
import type { NativeModule, NativeProviderSpec, Ownership } from "./index.js";

export interface NodeApiProviderOptions {
  id: string;
  /** Absolute path to a `.node` addon. */
  addonPath: string;
  operations: string[];
  os?: string[];
  arch?: string[];
  libc?: ("glibc" | "musl")[];
  napiVersion?: number;
  ownership?: Ownership;
  /** Map an operation name to a method on the loaded addon. Default: identity. */
  bind?: (addon: Record<string, unknown>) => NativeModule;
  detail?: string;
}

/**
 * Build a `node-api` provider spec that loads a `.node` addon **lazily** (only
 * when the registry `open()`s it). A raw `.dll` / `.so` / `.dylib` is rejected —
 * that needs an FFI provider, not this.
 */
export function nodeApiProvider(o: NodeApiProviderOptions): NativeProviderSpec {
  const ext = extname(o.addonPath).toLowerCase();
  if (ext !== ".node") {
    throw new CompatError({
      code: "native/no-binary",
      package: "obix-core-native",
      operation: "nodeApiProvider",
      reason: `addonPath must be a .node addon, got "${ext}" — a .dll/.so/.dylib needs an FFI provider`,
      remediation: "Point at a compiled Node-API .node addon, or register an ffi-* / bridge provider.",
    });
  }
  return {
    id: o.id,
    kind: "node-api",
    runtime: ["node"],
    os: o.os ?? [process.platform],
    arch: o.arch ?? [process.arch],
    libc: o.libc,
    abi: { napiVersion: o.napiVersion },
    operations: [...o.operations],
    ownership: o.ownership ?? "provider-managed",
    detail: o.detail ?? o.addonPath,
    load: () => {
      if (!existsSync(o.addonPath)) {
        const e = new Error(`ENOENT: no such addon ${o.addonPath}`) as Error & { code?: string };
        e.code = "ENOENT";
        throw e;
      }
      const req = createRequire(import.meta.url);
      const addon = req(o.addonPath) as Record<string, unknown>;
      return o.bind ? o.bind(addon) : (addon as NativeModule);
    },
  };
}

export interface PolycallInspection {
  installed: boolean;
  resolvedFrom: string | null;
  /** `exports` keys from its package.json — declaration only, nothing imported. */
  exportKeys: string[];
  version: string | null;
  note: string;
}

/**
 * Inspect an installed `@obinexusltd/node-polycall` **without importing or
 * executing it**: resolve its `package.json` and read the declared metadata.
 * The result is informational — this function never auto-registers a provider.
 */
export function inspectNodePolycall(fromDir = process.cwd()): PolycallInspection {
  const NOTE =
    "Informational only. To use node-polycall you must register a provider whose " +
    "load() imports it and expose its real, verified operations — this package " +
    "does not assume an API.";
  try {
    const req = createRequire(`${fromDir}/noop.js`);
    const pj = req.resolve("@obinexusltd/node-polycall/package.json");
    const manifest = req(pj) as { version?: string; exports?: Record<string, unknown> };
    return {
      installed: true,
      resolvedFrom: pj,
      exportKeys: manifest.exports ? Object.keys(manifest.exports) : [],
      version: manifest.version ?? null,
      note: NOTE,
    };
  } catch {
    return { installed: false, resolvedFrom: null, exportKeys: [], version: null, note: NOTE };
  }
}

export { createNativeRegistry, probeNative } from "./index.js";
export type { NativeRegistryAPI, NativeProviderSpec, NativeHandle } from "./index.js";
