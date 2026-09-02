/**
 * obix — the OBIX application suite.
 *
 * Re-exports the whole `obix-core` runtime and namespaces `obix-test`, so an
 * application depends on one package. Ships the `obix` CLI (`create` / `dev` /
 * `build` / `check`) for bundling standard HTML + CSS + TypeScript Web
 * Component apps — no `.obix` file, no framework.
 */
export * from "obix-core";
export * as Test from "obix-test";

export { create } from "./cli/create.js";
export { dev } from "./cli/dev.js";
export { build } from "./cli/build.js";
export { check } from "./cli/check.js";
export type { CliResult } from "./cli/types.js";
