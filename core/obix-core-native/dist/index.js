import { CompatError, detectHost, probeCapabilities, } from "@obinexusltd/obix-core-capabilities";
export { CompatError, detectHost } from "@obinexusltd/obix-core-capabilities";
function fail(code, operation, reason, remediation) {
    return new CompatError({ code, package: "obix-core-native", operation, reason, remediation });
}
function toInfo(s) {
    return {
        id: s.id,
        kind: s.kind,
        runtime: [...s.runtime],
        os: [...s.os],
        arch: [...s.arch],
        libc: s.libc ? [...s.libc] : null,
        abi: s.abi ?? null,
        operations: [...s.operations],
        ownership: s.ownership,
        detail: s.detail ?? null,
    };
}
export function createNativeRegistry() {
    const providers = new Map();
    function assertSpec(spec) {
        for (const k of ["id", "kind", "ownership"]) {
            if (typeof spec[k] !== "string")
                throw fail("native/no-provider", "register", `provider.${k} must be a string`);
        }
        for (const k of ["runtime", "os", "arch", "operations"]) {
            if (!Array.isArray(spec[k]) || spec[k].length === 0)
                throw fail("native/no-provider", "register", `provider.${k} must be a non-empty array`);
        }
        if (typeof spec.load !== "function")
            throw fail("native/no-provider", "register", "provider.load must be a function");
    }
    function matchFailure(spec, host) {
        if (!spec.runtime.includes(host.runtime))
            return "native/no-provider";
        if (host.os && !spec.os.includes(host.os))
            return "native/no-provider";
        if (host.arch && !spec.arch.includes(host.arch))
            return "native/arch-mismatch";
        if (spec.libc && host.libc && !spec.libc.includes(host.libc))
            return "native/abi-mismatch";
        if (spec.kind === "node-api") {
            const cap = probeCapabilities(["native-addon"])["native-addon"];
            if (cap.status === "denied")
                return "native/denied";
            if (cap.status === "unavailable")
                return "native/no-provider";
        }
        else if (spec.kind === "ffi-bun") {
            if (host.runtime !== "bun" || typeof globalThis.Bun?.dlopen !== "function")
                return "native/no-provider";
        }
        else if (spec.kind === "ffi-node-experimental") {
            if (host.runtime !== "node")
                return "native/no-provider";
            const cap = probeCapabilities(["ffi"])["ffi"];
            if (cap.status !== "available")
                return "native/no-provider";
        }
        return null;
    }
    return {
        register(spec) {
            assertSpec(spec);
            if (providers.has(spec.id))
                throw fail("native/no-provider", "register", `provider id "${spec.id}" is already registered`);
            providers.set(spec.id, spec);
        },
        list() {
            return [...providers.values()].map(toInfo);
        },
        select(operation, host = detectHost()) {
            const candidates = [...providers.values()].filter((p) => p.operations.includes(operation));
            if (candidates.length === 0) {
                return {
                    ok: false,
                    error: fail("native/no-provider", "select", `no provider implements "${operation}"`, "Register a provider whose `operations` includes it."),
                };
            }
            let lastFailure = "native/no-provider";
            for (const spec of candidates) {
                const f = matchFailure(spec, host);
                if (f == null)
                    return { ok: true, provider: spec };
                lastFailure = f;
            }
            const reason = lastFailure === "native/arch-mismatch"
                ? `a provider for "${operation}" exists but not for arch ${host.arch}`
                : lastFailure === "native/abi-mismatch"
                    ? `a provider for "${operation}" exists but its libc/ABI does not match this host`
                    : lastFailure === "native/denied"
                        ? `a provider for "${operation}" exists but native addons are denied by the runtime's permission model`
                        : `a provider for "${operation}" exists but not for this runtime/OS`;
            return { ok: false, error: fail(lastFailure, "select", reason) };
        },
        isSelectableHere(providerId) {
            const spec = providers.get(providerId);
            if (!spec)
                return false;
            return matchFailure(spec, detectHost()) == null;
        },
        async open(providerId, opts = {}) {
            const spec = providers.get(providerId);
            if (!spec)
                throw fail("native/no-provider", "open", `no provider registered with id "${providerId}"`);
            const f = matchFailure(spec, detectHost());
            if (f != null) {
                throw fail(f, "open", `provider "${providerId}" is not usable on this host (${f.replace("native/", "")})`, f === "native/denied" ? "Grant the runtime's native-addon / FFI permission and retry." : undefined);
            }
            if (opts.signal?.aborted)
                throw fail("native/failure", "open", "aborted before load");
            let mod;
            try {
                mod = await spec.load();
            }
            catch (err) {
                const e = err;
                const enoent = e?.code === "ENOENT" || /ENOENT|not found|cannot find/i.test(e?.message ?? "");
                throw fail(enoent ? "native/no-binary" : "native/failure", "open", enoent
                    ? `provider "${providerId}" binary not found: ${e?.message ?? String(err)}`
                    : `provider "${providerId}" failed to load: ${e?.message ?? String(err)}`, enoent ? "Install / build the native binary for this platform, or use a different provider." : undefined);
            }
            let closed = false;
            return {
                providerId,
                ownership: spec.ownership,
                get closed() {
                    return closed;
                },
                async call(operation, ...args) {
                    if (closed)
                        throw fail("native/disposed", "call", `handle for "${providerId}" is closed`);
                    const fn = mod[operation];
                    if (typeof fn !== "function") {
                        throw fail("native/no-provider", "call", `provider "${providerId}" has no operation "${operation}"`);
                    }
                    try {
                        return (await fn(...args));
                    }
                    catch (err) {
                        throw fail("native/failure", "call", `"${operation}" threw: ${err instanceof Error ? err.message : String(err)}`);
                    }
                },
                async close() {
                    if (closed)
                        return;
                    closed = true;
                    const disposer = mod["close"] ?? mod["dispose"];
                    if (typeof disposer === "function") {
                        try {
                            await disposer();
                        }
                        catch {
                        }
                    }
                },
            };
        },
    };
}
export function probeNative(registry, operations) {
    const out = {};
    for (const op of operations) {
        const r = registry.select(op);
        out[op] = r.ok
            ? { selectable: true, providerId: r.provider.id, reason: `provider ${r.provider.id} matches this host` }
            : { selectable: false, reason: r.error?.reason ?? "no provider" };
    }
    return {
        operations: out,
        executionTested: false,
        note: "A selectable provider is not proof of a working native call. Native execution must be qualified by a real provider + fixture on the exact runtime/OS/arch/libc.",
    };
}
//# sourceMappingURL=index.js.map