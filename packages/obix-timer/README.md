# obix-timer

**The frozen OBIX golden fixture.** Reference fixture · teaching example · acceptance artifact.

```bash
npm install obix-timer
```

## What ships

| Path / export | What |
|---|---|
| `fixture/Timer.obix` | the frozen component source |
| `fixture/Timer.test.obix` | behavioural TDD cases (Addendum A §5.1) |
| `fixture/Timer.obix.test` | conformance contract (Addendum A §5.2) |
| `fixtures/draft-0.2.1-addendum-a/` | immutable snapshot + `CHECKSUM` |
| `TimerDOP` | the compiled canonical `DOPArtifact` (Model B refined) |
| `EXPECTED_TRACES` | canonical traces + expected outcomes |
| `TIMER_OBIX_SOURCE` | the source string (LF-normalised) |
| `FIXTURE_VERSION` | `"draft-0.2.1-addendum-a"` |
| `FIXTURE_CHECKSUM` | sha256 of the LF-normalised `Timer.obix` |
| `verifyFixture()` | recompute + compare |

## Fixture identity vs npm version (Problem 13)

The **npm package** version tracks the unified OBIX line (`0.2.1`). The **fixture**
identity is separate metadata *inside* the package: `FIXTURE_VERSION` +
`FIXTURE_CHECKSUM`, plus the immutable `fixtures/draft-0.2.1-addendum-a/` snapshot
and a git tag at the freeze point. The fixture is not versioned with ordinary
product semver.

## Terminal semantics (Addendum A — adopted Model B refined)

At `seconds === limitSeconds`: `running === false`, `finished === true`,
`cannotStart === true`, `statusLabel === "Finished"`. `Start` at the limit is
identity; `Reset` is the only way out. `Tick` never decreases `seconds` — a
restored `{ seconds: 8, running: true }` becomes `{ seconds: 8, running: false }`,
never `{ seconds: 5, ... }`.

## Dependency role

Depends on `obix-spec`, `obix-ir` and the four pure adapters. **Nothing depends
on `obix-timer`** — the cycle checker enforces it as a leaf.

## Level 0 status

✅ Complete and frozen.
