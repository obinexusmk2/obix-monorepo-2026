#!/usr/bin/env node
/**
 * `obix` — the OBIX application-suite CLI.
 *
 *   obix create <dir>            scaffold a standard HTML/CSS/TS Web Component app
 *   obix dev [--port <n>]        zero-bundle dev server with live reload
 *   obix build [--outdir <dir>]  esbuild bundle → <outdir>/ (default dist/)
 *   obix check [--no-types]      accessibility audit + tsc --noEmit
 */
import { create } from "../cli/create.js";
import { dev } from "../cli/dev.js";
import { build } from "../cli/build.js";
import { check } from "../cli/check.js";
import type { CliResult } from "../cli/types.js";

const USAGE = `obix — the OBIX application suite

  obix create <dir>             scaffold a standard HTML/CSS/TS Web Component app
  obix dev [--port <n>]         zero-bundle dev server with live reload
  obix build [--outdir <dir>]   esbuild bundle → <outdir>/ (default: dist/)
  obix check [--no-types]       accessibility audit of every *.html + tsc --noEmit
`;

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
    process.stdout.write(USAGE);
    return cmd ? 0 : 1;
  }

  const positional = rest.find((a) => !a.startsWith("--"));

  let result: CliResult;
  switch (cmd) {
    case "create": {
      if (!positional) {
        process.stderr.write("obix create: missing <dir>\n");
        return 2;
      }
      result = create(positional);
      break;
    }
    case "dev": {
      const server = await dev({ port: flag(rest, "--port") ? Number(flag(rest, "--port")) : undefined });
      process.stdout.write(server.message + "\n");
      const shutdown = (): void => void server.data.close().then(() => process.exit(0));
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
      return await new Promise<number>(() => {}); // run until signalled
    }
    case "build": {
      result = await build({ outdir: flag(rest, "--outdir"), minify: !rest.includes("--no-minify") });
      break;
    }
    case "check": {
      result = check({ types: !rest.includes("--no-types") });
      break;
    }
    default:
      process.stderr.write(`obix: unknown command "${cmd}"\n\n${USAGE}`);
      return 2;
  }

  for (const d of result.diagnostics ?? []) {
    const line = `  ${d.severity.toUpperCase()} ${d.code} ${d.message}`;
    (d.severity === "error" ? process.stderr : process.stdout).write(line + "\n");
  }
  process.stdout.write((result.ok ? "OK  " : "FAIL  ") + result.message + "\n");
  return result.ok ? 0 : 1;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`obix: ${(err as Error).message}\n`);
    process.exit(1);
  },
);
