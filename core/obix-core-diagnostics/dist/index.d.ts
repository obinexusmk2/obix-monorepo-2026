import { CompatError, type CompatErrorCode, type RuntimeName } from "@obinexusltd/obix-core-capabilities";
export { CompatError, isCompatError, type CompatErrorCode, } from "@obinexusltd/obix-core-capabilities";
export interface NormalizeContext {
    package: string;
    operation: string;
    code?: CompatErrorCode;
    runtime?: RuntimeName;
    remediation?: string;
}
export declare function normalizeError(value: unknown, ctx: NormalizeContext): CompatError;
export type SupportStatus = "tested-pass" | "tested-fail" | "unsupported" | "not-tested";
export interface CheckResult {
    status: SupportStatus;
    detail: string;
    data?: unknown;
    error?: CompatError;
}
export interface DoctorCheck {
    id: string;
    title: string;
    required?: boolean;
    run(): CheckResult | Promise<CheckResult>;
}
export interface DoctorReport {
    schema: "obix-core-diagnostics/doctor@1";
    ok: boolean;
    runtime: RuntimeName;
    runtimeVersion: string | null;
    os: string | null;
    arch: string | null;
    generatedAt: string;
    summary: Record<SupportStatus, number>;
    checks: Array<{
        id: string;
        title: string;
        status: SupportStatus;
        detail: string;
        required: boolean;
        data: unknown;
        error: Record<string, unknown> | null;
    }>;
}
export interface RunDoctorOptions {
    signal?: AbortSignal;
    onCheck?: (entry: DoctorReport["checks"][number]) => void;
}
export declare function runDoctor(checks: readonly DoctorCheck[], opts?: RunDoctorOptions): Promise<DoctorReport>;
export interface ReporterOptions {
    write: (line: string) => void;
    color?: boolean;
}
export declare function createReporter(opts: ReporterOptions): {
    report(report: DoctorReport): void;
    error(err: unknown): void;
};
export declare function formatReport(report: DoctorReport, opts?: {
    json: boolean;
    color?: boolean;
}): string;
export declare const EXIT: {
    readonly ok: 0;
    readonly failure: 1;
    readonly invalidInvocation: 2;
};
export declare const EXIT_CANCELLED = 130;
export declare function exitCodeFor(report: DoctorReport): number;
//# sourceMappingURL=index.d.ts.map