import { CompatError, isCompatError, detectHost, } from "@obinexusltd/obix-core-capabilities";
export { CompatError, isCompatError, } from "@obinexusltd/obix-core-capabilities";
export function normalizeError(value, ctx) {
    if (isCompatError(value))
        return value;
    const message = value instanceof Error
        ? value.message
        : typeof value === "string"
            ? value
            : safeStringify(value);
    return new CompatError({
        code: ctx.code ?? "diagnostics/invalid-invocation",
        package: ctx.package,
        operation: ctx.operation,
        reason: message || "unknown error",
        runtime: ctx.runtime,
        cause: value,
        remediation: ctx.remediation,
    });
}
function safeStringify(v) {
    try {
        return JSON.stringify(v);
    }
    catch {
        return String(v);
    }
}
export async function runDoctor(checks, opts = {}) {
    const host = detectHost();
    const summary = {
        "tested-pass": 0,
        "tested-fail": 0,
        unsupported: 0,
        "not-tested": 0,
    };
    const entries = [];
    let ok = true;
    for (const check of checks) {
        if (opts.signal?.aborted) {
            const entry = mkEntry(check, {
                status: "not-tested",
                detail: "cancelled before execution",
            });
            entries.push(entry);
            summary["not-tested"]++;
            opts.onCheck?.(entry);
            continue;
        }
        let res;
        try {
            res = await check.run();
        }
        catch (err) {
            res = {
                status: "tested-fail",
                detail: err instanceof Error ? err.message : String(err),
                error: normalizeError(err, {
                    package: "obix-core-diagnostics",
                    operation: `check:${check.id}`,
                    runtime: host.runtime,
                }),
            };
        }
        const entry = mkEntry(check, res);
        entries.push(entry);
        summary[res.status]++;
        const required = check.required === true;
        if (res.status === "tested-fail")
            ok = false;
        else if (required && (res.status === "unsupported" || res.status === "not-tested"))
            ok = false;
        opts.onCheck?.(entry);
    }
    return {
        schema: "obix-core-diagnostics/doctor@1",
        ok,
        runtime: host.runtime,
        runtimeVersion: host.runtimeVersion,
        os: host.os,
        arch: host.arch,
        generatedAt: new Date().toISOString(),
        summary,
        checks: entries,
    };
}
function mkEntry(check, res) {
    return {
        id: check.id,
        title: check.title,
        status: res.status,
        detail: res.detail,
        required: check.required === true,
        data: res.data ?? null,
        error: res.error ? res.error.toJSON() : null,
    };
}
const MARK = {
    "tested-pass": "PASS",
    "tested-fail": "FAIL",
    unsupported: "UNSUP",
    "not-tested": "SKIP",
};
function paint(color, status, text) {
    if (!color)
        return text;
    const c = status === "tested-pass" ? "32" : status === "tested-fail" ? "31" : status === "unsupported" ? "33" : "90";
    return `\x1b[${c}m${text}\x1b[0m`;
}
export function createReporter(opts) {
    const write = opts.write;
    const color = opts.color === true;
    return {
        report(report) {
            write(`obix doctor — ${report.runtime}${report.runtimeVersion ? " " + report.runtimeVersion : ""} on ${report.os ?? "?"}/${report.arch ?? "?"}`);
            for (const c of report.checks) {
                write(`  ${paint(color, c.status, MARK[c.status].padEnd(5))}  ${c.id.padEnd(28)} ${c.detail}`);
                if (c.error?.remediation)
                    write(`         ↳ ${c.error.remediation}`);
            }
            const s = report.summary;
            write(`${report.ok ? paint(color, "tested-pass", "OK") : paint(color, "tested-fail", "PROBLEMS")}  ` +
                `pass=${s["tested-pass"]} fail=${s["tested-fail"]} unsupported=${s.unsupported} not-tested=${s["not-tested"]}`);
        },
        error(err) {
            const e = isCompatError(err)
                ? err
                : normalizeError(err, { package: "obix-core-diagnostics", operation: "cli" });
            write(paint(color, "tested-fail", `error [${e.code}] ${e.package}/${e.operation}: ${e.reason}`));
            if (e.remediation)
                write(`  ↳ ${e.remediation}`);
        },
    };
}
export function formatReport(report, opts = { json: false }) {
    if (opts.json)
        return JSON.stringify(report) + "\n";
    const lines = [];
    createReporter({ write: (l) => lines.push(l), color: opts.color }).report(report);
    return lines.join("\n") + "\n";
}
export const EXIT = {
    ok: 0,
    failure: 1,
    invalidInvocation: 2,
};
export const EXIT_CANCELLED = 130;
export function exitCodeFor(report) {
    return report.ok ? EXIT.ok : EXIT.failure;
}
//# sourceMappingURL=index.js.map