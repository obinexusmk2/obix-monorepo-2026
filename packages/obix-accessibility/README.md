# obix-accessibility

**Compile-time accessibility analysis for OBIX. Mandatory. Not optional.**

```bash
npm install obix-accessibility
```

## Purpose

| Export | Role |
|---|---|
| `analyzeA11y(templateDescriptor)` | `{ model: A11yModel, diagnostics }` — runs **before emit** |
| `validateLiveRegions(td)` | `aria-live` validity + "will it ever announce?" |
| `checkFocusPolicy(td)` | `tabindex` sanity, accessible names, `<a>` without href |
| `checkHeadingHierarchy(td)` | no skipped heading levels |
| `hasBlockingA11yError(diagnostics)` | any `severity:"error"` OBIX-A* → compiler refuses to emit |

## Why it is a separate package but still non-optional (Problem 5)

The 20-package graph keeps accessibility as its own public package, but
`obix-compiler` declares a **normal, required** dependency on it — not a peer, not
optional. `npm install obix-compiler` installs a11y analysis, and no
supported flag turns it off. There is no `--no-a11y`. Enforced by
`scripts/check-a11y-required.mjs` (GATE 7).

## No runtime here

There is deliberately no `announce()`. Live-region text changes go through
ordinary `obix-runtime` bindings.

## Dependency role

`obix-spec` + `obix-template`. **Never** depends on `obix-compiler`.

## Level 0 status

✅ Live regions, focus policy, heading hierarchy, role / ARIA-name checks.
Deferred: the full accessibility-contract runner.
