#!/usr/bin/env node
import { build, check, test, verify, equivalence } from "../index.js";

const USAGE = `obixc — the OBIX command-line tool

  obixc build <file.obix> [--out <dir>]     compile to <dir>/<Name>.mjs + <Name>.ir.json
  obixc check <file.obix>                   parse + a11y + semantic diagnostics
  obixc test <file.obix>                    run the sibling <Name>.test.obix cases
  obixc verify <file.obix>                  compile + a11y model + contract parse
  obixc equivalence <file.obix> [--trace "Start,Tick,Tick,Stop"]
                                           compare every projection to referenceFold
`;

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  const file = rest.find((a) => !a.startsWith("--"));

  if (!cmd || cmd === "--help" || cmd === "-h") {
    process.stdout.write(USAGE);
    return cmd ? 0 : 1;
  }
  if (!file && cmd !== "help") {
    process.stderr.write(`obixc ${cmd}: missing <file.obix>\n`);
    return 2;
  }

  try {
    let res;
    switch (cmd) {
      case "build":
        res = await build(file!, flag(rest, "--out") ?? "dist");
        break;
      case "check":
        res = check(file!);
        break;
      case "test":
        res = await test(file!);
        break;
      case "verify":
        res = await verify(file!);
        break;
      case "equivalence":
        res = await equivalence(file!, flag(rest, "--trace"));
        break;
      case "help":
        process.stdout.write(USAGE);
        return 0;
      default:
        process.stderr.write(`obixc: unknown command "${cmd}"\n${USAGE}`);
        return 2;
    }

    for (const d of res.diagnostics ?? []) {
      const line = `  ${d.severity.toUpperCase()} ${d.code} ${d.message}`;
      if (d.severity === "error") process.stderr.write(line + "\n");
      else process.stdout.write(line + "\n");
    }
    process.stdout.write((res.ok ? "OK  " : "FAIL ") + res.message + "\n");
    return res.ok ? 0 : 1;
  } catch (err) {
    process.stderr.write(`obixc ${cmd}: ${(err as Error).message}\n`);
    return 1;
  }
}

main(process.argv.slice(2)).then((code) => process.exit(code));
