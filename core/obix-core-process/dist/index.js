import { CompatError, probeCapabilities } from "@obinexusltd/obix-core-capabilities";
export { CompatError } from "@obinexusltd/obix-core-capabilities";
export function resolveTool(spec, hooks = {}) {
    if (spec.kind === "js-bin") {
        const abs = hooks.resolveJsBin?.(spec.package, spec.bin) ?? null;
        if (!abs) {
            return {
                found: false,
                command: "",
                args: [],
                kind: "js-bin",
                detail: `no installed "${spec.bin ?? spec.package}" bin for package ${spec.package}`,
            };
        }
        const runtime = hooks.jsRuntime ?? currentRuntimeExecPath();
        return {
            found: true,
            command: runtime,
            args: [abs],
            kind: "js-bin",
            runtime,
            detail: `${spec.package} bin resolved to ${abs}, run under ${runtime}`,
        };
    }
    const abs = hooks.which?.(spec.name) ?? null;
    return abs
        ? { found: true, command: abs, args: [], kind: "executable", detail: `${spec.name} on PATH: ${abs}` }
        : { found: false, command: "", args: [], kind: "executable", detail: `${spec.name} not found on PATH` };
}
function currentRuntimeExecPath() {
    const p = globalThis.process;
    return typeof p?.execPath === "string" ? p.execPath : "node";
}
export function createProcessRunner(spawnImpl) {
    const live = new Set();
    async function run(params, req) {
        if (typeof params.command !== "string" || params.command === "") {
            throw new CompatError({
                code: "process/tool-not-found",
                package: "obix-core-process",
                operation: "spawnTool",
                reason: "command must be a non-empty string (an executable path, not a shell line)",
            });
        }
        const maxBuffer = req.maxBuffer ?? 8 * 1024 * 1024;
        const killSignal = req.killSignal ?? "SIGTERM";
        const started = now();
        let proc;
        try {
            proc = spawnImpl(params);
        }
        catch (err) {
            throw new CompatError({
                code: "process/tool-not-found",
                package: "obix-core-process",
                operation: "spawnTool",
                reason: `cannot spawn ${params.command}: ${err instanceof Error ? err.message : String(err)}`,
                cause: err,
                remediation: "Check the executable path exists and is executable; a JS tool must be resolved to its installed bin.",
            });
        }
        const entry = { proc, tree: req.tree === true };
        live.add(entry);
        let timedOut = false;
        let aborted = false;
        let timer;
        const stop = (why) => {
            if (why === "timeout")
                timedOut = true;
            else
                aborted = true;
            if (entry.tree && proc.killTree)
                void proc.killTree();
            else
                proc.kill(killSignal);
        };
        if (req.timeoutMs && req.timeoutMs > 0) {
            timer = setTimeout(() => stop("timeout"), req.timeoutMs);
            if (typeof timer.unref === "function")
                timer.unref();
        }
        const onAbort = () => stop("abort");
        if (req.signal) {
            if (req.signal.aborted)
                stop("abort");
            else
                req.signal.addEventListener("abort", onAbort, { once: true });
        }
        let stdout;
        let stderr;
        let stdoutTruncated;
        let stderrTruncated;
        let code;
        let signal;
        try {
            const [[so, sot], [se, set], exit] = await Promise.all([
                drain(proc.streams.stdout, maxBuffer),
                drain(proc.streams.stderr, maxBuffer),
                proc.exited,
            ]);
            [stdout, stdoutTruncated] = [so, sot];
            [stderr, stderrTruncated] = [se, set];
            ({ code, signal } = exit);
        }
        catch (err) {
            if (timer)
                clearTimeout(timer);
            if (req.signal)
                req.signal.removeEventListener("abort", onAbort);
            live.delete(entry);
            const e = err;
            const enoent = e?.code === "ENOENT" || /ENOENT/.test(e?.message ?? "");
            throw new CompatError({
                code: enoent ? "process/tool-not-found" : "process/nonzero-exit",
                package: "obix-core-process",
                operation: "spawnTool",
                reason: enoent
                    ? `executable not found: ${params.command}`
                    : `child process error: ${e?.message ?? String(err)}`,
                cause: err,
                remediation: enoent
                    ? "Resolve a JS tool to its installed bin (resolveTool), or give an absolute executable path."
                    : undefined,
            });
        }
        if (timer)
            clearTimeout(timer);
        if (req.signal)
            req.signal.removeEventListener("abort", onAbort);
        live.delete(entry);
        return {
            command: params.command,
            args: params.args,
            cwd: params.cwd,
            code,
            signal,
            timedOut,
            aborted,
            durationMs: now() - started,
            stdout,
            stderr,
            stdoutTruncated,
            stderrTruncated,
        };
    }
    return {
        spawnTool(req) {
            return run({ command: req.command, args: req.args ?? [], cwd: req.cwd, env: req.env }, req);
        },
        async spawnShellScript(req) {
            const lower = req.command.toLowerCase();
            if (!/\.(cmd|bat|ps1)$/.test(lower)) {
                throw new CompatError({
                    code: "process/tool-not-found",
                    package: "obix-core-process",
                    operation: "spawnShellScript",
                    reason: `spawnShellScript is only for .cmd/.bat/.ps1 targets, got ${req.command}`,
                    remediation: "Use spawnTool for a normal executable.",
                });
            }
            return run({ command: req.command, args: req.shellArgsArray, cwd: req.cwd, env: req.env }, req);
        },
        async terminateChild(handle, opts = {}) {
            handle.kill(opts.signal ?? "SIGTERM");
            try {
                await handle.done;
            }
            catch {
            }
        },
        async disposeAll(opts = {}) {
            const sig = opts.signal ?? "SIGKILL";
            const pending = [];
            for (const entry of [...live]) {
                if ((opts.tree ?? entry.tree) && entry.proc.killTree)
                    pending.push(entry.proc.killTree());
                else
                    entry.proc.kill(sig);
                pending.push(entry.proc.exited.catch(() => { }));
            }
            await Promise.all(pending);
            live.clear();
        },
        get activeCount() {
            return live.size;
        },
    };
}
async function drain(stream, maxBuffer) {
    if (!stream)
        return [new Uint8Array(0), false];
    const chunks = [];
    let total = 0;
    let truncated = false;
    const reader = stream.getReader();
    try {
        for (;;) {
            const { value, done } = await reader.read();
            if (done)
                break;
            if (total < maxBuffer) {
                const room = maxBuffer - total;
                if (value.byteLength <= room) {
                    chunks.push(value);
                    total += value.byteLength;
                }
                else {
                    chunks.push(value.subarray(0, room));
                    total = maxBuffer;
                    truncated = true;
                }
            }
            else {
                truncated = true;
            }
        }
    }
    finally {
        reader.releaseLock();
    }
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
        out.set(c, off);
        off += c.byteLength;
    }
    return [out, truncated];
}
function now() {
    const perf = globalThis.performance;
    return perf?.now ? perf.now() : Date.now();
}
export function canSpawn() {
    return probeCapabilities(["spawn"])["spawn"].status === "available";
}
//# sourceMappingURL=index.js.map