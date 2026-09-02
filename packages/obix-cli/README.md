# obix-cli

**`obixc` — the OBIX command-line tool.**

```bash
npm install -g obix-cli
```

## Commands

| Command | What |
|---|---|
| `obixc build <file.obix> [--out dir]` | compile to `<Name>.mjs` + `<Name>.ir.json` |
| `obixc check <file.obix>` | parse + accessibility + semantic diagnostics (exit 1 on error) |
| `obixc test <file.obix>` | run the sibling `<Name>.test.obix` behavioural cases |
| `obixc verify <file.obix>` | compile + a11y model + `<Name>.obix.test` contract parse |
| `obixc equivalence <file.obix> [--trace "Start,Tick,Tick,Stop"]` | compare every projection to `referenceFold` |

## Design

The CLI **orchestrates**; it holds no compiler or test logic. `build` / `check`
call `obix-compiler`; `test` / `equivalence` call
`obix-equivalence`; validation comes from `obix-validator`.

## Dependency role

`obix-compiler`, `obix-equivalence`, `obix-validator`. Nothing depends on the CLI.

## Level 0 status

✅ All five commands. `test` executes the Level 0 behavioural DSL against the
reactive projection with virtual time.
