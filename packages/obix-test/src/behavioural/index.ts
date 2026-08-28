/**
 * Behavioural test DSL (`Timer.test.obix`). Level 0 parses the structure into
 * runnable case objects; it does not evaluate them here (the CLI / a test runner
 * drives them against a projection + virtual clock).
 */
export type BehaviouralStep =
  | { op: "dispatch"; action: string; payload?: unknown }
  | { op: "advance"; ms: number };

export interface Expectation {
  target: string; // e.g. "state.seconds", "derived.finished", "transitions"
  matcher: "is" | "isNot";
  value: unknown;
}

export interface BehaviouralCase {
  name: string;
  givenProps?: Record<string, unknown>;
  givenState?: Record<string, unknown>;
  steps: BehaviouralStep[];
  expectations: Expectation[];
}

export interface BehaviouralSuite {
  cases: BehaviouralCase[];
}

const literal = (raw: string): unknown => {
  const t = raw.trim();
  if (t === "true") return true;
  if (t === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  const s = t.match(/^"([^"]*)"$/);
  if (s) return s[1];
  return t;
};

const objectLiteral = (raw: string): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  const body = raw.trim().replace(/^\{/, "").replace(/\}$/, "");
  for (const pair of body.split(",")) {
    const m = pair.match(/^\s*([A-Za-z_$][\w$]*)\s*:\s*(.+?)\s*$/);
    if (m) out[m[1]!] = literal(m[2]!);
  }
  return out;
};

export function parseTestDSL(source: string): BehaviouralSuite {
  const cases: BehaviouralCase[] = [];
  const re = /test\s+([A-Za-z_$][\w$]*)\s*\{([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const name = m[1]!;
    const body = m[2]!;
    const c: BehaviouralCase = { name, steps: [], expectations: [] };
    for (const lineRaw of body.split("\n")) {
      const line = lineRaw.trim();
      if (!line || line.startsWith("//")) continue;
      let g: RegExpMatchArray | null;
      if ((g = line.match(/^given props\s+(\{.*\})$/))) c.givenProps = objectLiteral(g[1]!);
      else if ((g = line.match(/^given state\s+(\{.*\})$/))) c.givenState = objectLiteral(g[1]!);
      else if ((g = line.match(/^dispatch\s+([A-Za-z_$][\w$]*)(?:\s+(.+))?$/))) c.steps.push({ op: "dispatch", action: g[1]!, payload: g[2] ? literal(g[2]) : undefined });
      else if ((g = line.match(/^advance\s+(\d+)ms$/))) c.steps.push({ op: "advance", ms: Number(g[1]) });
      else if ((g = line.match(/^expect\s+(.+?)\s+is\s+not\s+(.+)$/))) c.expectations.push({ target: g[1]!, matcher: "isNot", value: literal(g[2]!) });
      else if ((g = line.match(/^expect\s+(.+?)\s+is\s+(.+)$/))) c.expectations.push({ target: g[1]!, matcher: "is", value: literal(g[2]!) });
    }
    cases.push(c);
  }
  return { cases };
}
