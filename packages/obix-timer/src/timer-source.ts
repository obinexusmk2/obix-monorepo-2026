import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

/** Read a shipped fixture file, normalised to LF so checksums are stable
 *  regardless of git autocrlf settings. */
function readFixture(name: string): string {
  const url = new URL(`../fixture/${name}`, import.meta.url);
  return readFileSync(fileURLToPath(url), "utf8").replace(/\r\n/g, "\n");
}

/** The frozen `Timer.obix` source, exactly as shipped. */
export const TIMER_OBIX_SOURCE: string = readFixture("Timer.obix");

/** The behavioural TDD suite source (`Timer.test.obix`). */
export const TIMER_TEST_OBIX_SOURCE: string = readFixture("Timer.test.obix");

/** The conformance contract source (`Timer.obix.test`). */
export const TIMER_OBIX_TEST_SOURCE: string = readFixture("Timer.obix.test");

export function sha256(text: string): string {
  return createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
}
