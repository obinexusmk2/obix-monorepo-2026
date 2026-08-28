/**
 * @obinexusltd/obix-cli — programmatic entry points behind the `obixc` binary.
 * These are thin wrappers; all real work lives in obix-compiler / obix-test /
 * obix-validator.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { compileFile, checkSource } from "@obinexusltd/obix-compiler";
import { readFileSync } from "node:fs";
import {
  checkEquivalence,
  parseTestDSL,
  parseContractDSL,
  runWithVirtualTime,
} from "@obinexusltd/obix-test";
import { loadComponent, parseTrace } from "./runtime.js";
import type { Diagnostic, TraceItem } from "@obinexusltd/obix-spec";

export interface CliResult {
  ok: boolean;
  message: string;
  diagnostics?: Diagnostic[];
  data?: unknown;
}

export async function build(file: string, outDir = "dist"): Promise<CliResult> {
  const result = compileFile(file);
  if (!result.ok || !result.code || !result.ir) {
    return { ok: false, message: `build failed: ${file}`, diagnostics: result.diagnostics };
  }
  mkdirSync(outDir, { recursive: true });
  const stem = basename(file).replace(/\.obix$/, "");
  writeFileSync(join(outDir, `${stem}.mjs`), result.code, "utf8");
  writeFileSync(join(outDir, `${stem}.ir.json`), JSON.stringify(result.ir, null, 2), "utf8");
  return { ok: true, message: `built ${stem}.mjs + ${stem}.ir.json in ${outDir}`, diagnostics: result.diagnostics };
}

export function check(file: string): CliResult {
  const source = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const { ok, diagnostics } = checkSource(source, file);
  return { ok, message: ok ? `ok: ${file}` : `${diagnostics.filter((d) => d.severity === "error").length} error(s) in ${file}`, diagnostics };
}

export async function verify(file: string): Promise<CliResult> {
  const compiled = compileFile(file);
  const contractPath = file.replace(/\.obix$/, ".obix.test");
  let contract;
  try {
    contract = parseContractDSL(readFileSync(contractPath, "utf8"));
  } catch {
    contract = undefined;
  }
  return {
    ok: compiled.ok,
    message: compiled.ok ? `verified ${file}` : `verify failed ${file}`,
    diagnostics: compiled.diagnostics,
    data: { a11y: compiled.a11y, contract },
  };
}

export async function equivalence(file: string, traceSpec?: string): Promise<CliResult> {
  const { artifact, cleanup } = await loadComponent(file);
  try {
    const trace: TraceItem[] = traceSpec
      ? parseTrace(traceSpec)
      : [["Start"], ["Tick"], ["Tick"], ["Stop"]];
    const report = checkEquivalence(artifact, { trace });
    return {
      ok: report.equivalent,
      message: report.equivalent ? "adapter equivalence holds" : `divergence:\n${report.divergences.join("\n")}`,
      data: report,
    };
  } finally {
    cleanup();
  }
}

export async function test(file: string): Promise<CliResult> {
  const { artifact, cleanup } = await loadComponent(file);
  try {
    const dslPath = file.replace(/\.obix$/, ".test.obix");
    const suite = parseTestDSL(readFileSync(dslPath, "utf8"));
    const failures: string[] = [];
    for (const c of suite.cases) {
      const run = runWithVirtualTime(artifact, { props: c.givenProps as never, state: c.givenState as never });
      for (const step of c.steps) {
        if (step.op === "dispatch") run.dispatch(step.action, step.payload);
        else run.advance(step.ms);
      }
      for (const exp of c.expectations) {
        const actual = readTarget(exp.target, run, artifact as unknown as ReadArtifact);
        const pass = exp.matcher === "is" ? deepEq(actual, exp.value) : !deepEq(actual, exp.value);
        if (!pass) failures.push(`${c.name}: ${exp.target} ${exp.matcher} ${JSON.stringify(exp.value)} — got ${JSON.stringify(actual)}`);
      }
      run.stop();
    }
    return {
      ok: failures.length === 0,
      message: failures.length === 0 ? `${suite.cases.length} behavioural case(s) passed` : failures.join("\n"),
      data: { total: suite.cases.length, failures },
    };
  } finally {
    cleanup();
  }
}

interface ReadArtifact {
  derived: Record<string, (s: unknown, p: unknown) => unknown>;
  props: unknown;
}

function readTarget(target: string, run: { state: Record<string, unknown>; transitions: number }, artifact: ReadArtifact): unknown {
  if (target === "transitions") return run.transitions;
  if (target.startsWith("state.")) return run.state[target.slice(6)];
  if (target.startsWith("derived.")) {
    const name = target.slice(8);
    return artifact.derived[name]?.(run.state, artifact.props);
  }
  return undefined;
}

function deepEq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
