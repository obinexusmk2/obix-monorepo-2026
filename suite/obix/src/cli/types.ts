import type { Diagnostic } from "obix-core";

export interface CliResult {
  ok: boolean;
  message: string;
  diagnostics?: Diagnostic[];
  data?: unknown;
}
