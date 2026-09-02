# obix-equivalence

**Adapter-equivalence orchestration + behavioural / contract DSL parsers.**

```bash
npm install obix-equivalence
```

## Equivalence (Problem 1)

```ts
const report = checkEquivalence(artifact, { trace: [["Start"],["Tick"],["Tick"],["Stop"]] });
report.expected;         // oracle final state (from referenceFold — no adapters)
report.equivalent;       // state + render + validation match, every step, every projection
report.stepWise;         // states match at every step
report.renderEqual;      // render() matches the oracle at every step
report.validationEqual;  // validate() matches the oracle at every step
report.perAdapter;       // data / functional / functional.create / oop / reactive traces
```

The expected values are always `obix-validator.referenceFold`. Adapters are never
compared only to each other.

## Sub-modules (Problem 11 — one package, not two)

| Import | Contents |
|---|---|
| `obix-equivalence` | everything |
| `.../equivalence` | `checkEquivalence` |
| `.../behavioural` | `parseTestDSL` (`Timer.test.obix`) |
| `.../contracts` | `parseContractDSL` (`Timer.obix.test`) |
| `.../virtual-time` | `runWithVirtualTime`, `createVirtualClock` |

## Dependency role

`obix-spec`, `obix-ir`, `obix-validator` + the four **pure** adapters (never the
native adapter). Adapters never depend on this package. Consumed by `obix-cli`.

## Level 0 status

✅ Equivalence orchestration + DSL parsing. Contract/behavioural *execution*
is driven by the CLI and consumers.
