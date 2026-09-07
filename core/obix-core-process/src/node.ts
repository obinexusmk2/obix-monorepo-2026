/**
 * @obinexusltd/obix-core-process/node
 *
 * Wires `createProcessRunner` to `node:child_process` (always `shell: false`),
 * plus PATH lookup and `bin`-field resolution. Importing this touches
 * `node:child_process` / `node:module`; do not import it from a portable
 * context.
 */
import { spawn as cpSpawn, execFile } from "node:child_process";
import { Readable } from "node:stream";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { join, dirname, delimiter } from "node:path";
import {
  createProcessRunner,
  resolveTool,
  type ChildProc,
  type ProcessRunnerAPI,
  type ResolveToolHooks,
  type SpawnParams,
} from "./index.js";

function nodeSpawn(params: SpawnParams): ChildProc {
  const child = cpSpawn(params.command, [...params.args], {
    cwd: params.cwd,
    env: params.env as NodeJS.ProcessEnv | undefined,
    shell: false, // never a shell
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const exited = new Promise<{ code: number | null; signal: string | null }>((resolve, reject) => {
    child.on("exit", (code, signal) => resolve({ code, signal }));
    child.on("error", (err) => reject(err));
  });

  return {
    pid: child.pid,
    streams: {
      stdout: child.stdout ? (Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>) : null,
      stderr: child.stderr ? (Readable.toWeb(child.stderr) as ReadableStream<Uint8Array>) : null,
    },
    exited,
    kill: (signal?: string) => child.kill((signal as NodeJS.Signals) ?? "SIGTERM"),
    killTree:
      process.platform === "win32" && child.pid
        ? () =>
            new Promise<boolean>((resolve) => {
              execFile("taskkill", ["/pid", String(child.pid), "/T", "/F"], () => resolve(true));
            })
        : undefined,
  };
}

/** PATH lookup honouring PATHEXT on Windows. */
export function which(name: string): string | null {
  if (name.includes("/") || name.includes("\\")) return existsSync(name) ? name : null;
  const paths = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  const pathext =
    process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";") : [];
  const hasKnownExt = pathext.some((e) => name.toLowerCase().endsWith(e.toLowerCase()));
  // try the name verbatim first (covers "node.exe"), then each PATHEXT
  const exts = hasKnownExt ? [""] : ["", ...pathext];
  for (const dir of paths) {
    for (const ext of exts) {
      const candidate = join(dir, name + ext);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

/** Resolve `pkg`'s `bin` (string or map) to an absolute JS path, from `fromDir`. */
export function resolveJsBin(fromDir: string): (pkg: string, bin?: string) => string | null {
  const req = createRequire(join(fromDir, "noop.js"));
  return (pkg, bin) => {
    let manifestPath: string;
    try {
      manifestPath = req.resolve(`${pkg}/package.json`);
    } catch {
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const manifest = req(manifestPath) as { bin?: string | Record<string, string> };
    const pkgDir = dirname(manifestPath);
    if (typeof manifest.bin === "string") {
      return join(pkgDir, manifest.bin);
    }
    if (manifest.bin && typeof manifest.bin === "object") {
      const key = bin ?? Object.keys(manifest.bin)[0];
      const rel = key ? manifest.bin[key] : undefined;
      return rel ? join(pkgDir, rel) : null;
    }
    return null;
  };
}

export interface NodeProcessRunnerOptions {
  /** Directory used as the resolution base for `js-bin` tools. Default `process.cwd()`. */
  resolveFrom?: string;
}

export function createNodeProcessRunner(opts: NodeProcessRunnerOptions = {}): ProcessRunnerAPI & {
  resolve(spec: Parameters<typeof resolveTool>[0]): ReturnType<typeof resolveTool>;
} {
  const runner = createProcessRunner(nodeSpawn);
  const from = opts.resolveFrom ?? process.cwd();
  const hooks: ResolveToolHooks = {
    which,
    resolveJsBin: resolveJsBin(from),
    jsRuntime: process.execPath,
  };
  return Object.assign(runner, {
    resolve: (spec: Parameters<typeof resolveTool>[0]) => resolveTool(spec, hooks),
  });
}

export { resolveTool } from "./index.js";
export type { ProcessRunnerAPI, SpawnResult, SpawnRequest } from "./index.js";
