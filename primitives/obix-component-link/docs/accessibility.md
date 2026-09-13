# Accessibility — `@obinexusltd/obix-component-link`

## Accessible name precedence (`computeAriaLabel`)

In order, the first match wins:

1. Explicit `ariaLabel`, if set.
2. `"{label} (download)"` — when `download` is set.
3. `"{label} (opens in a new window)"` — when `external` and `target === "_blank"`.
4. `"{label} (external link)"` — when `external` but not opening in a new tab.
5. Plain `label` otherwise.

This means a user relying on a screen reader hears the *consequence* of activating the link (new window, download, leaving the site) without you having to hand-write that suffix every time.

## `rel="noopener noreferrer"` default

When `target === "_blank"` and no explicit `rel` is given, `rel` defaults to `"noopener noreferrer"` — this prevents the opened page from accessing `window.opener` (a security concern for external links, not primarily an accessibility one, but bundled here because it's part of the same safe-defaults design).

## The `↗` external indicator

Purely visual, marked `aria-hidden="true"` so it is not announced — the accessible name (via `computeAriaLabel`) already communicates "external" or "opens in a new window" in words, so the indicator doesn't need to be (and shouldn't be) read aloud separately.

## Text escaping

`label` is HTML-escaped before insertion; `href`, `rel`, `download`, and the computed aria-label are also escaped where they're written as attribute values.
