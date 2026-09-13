# API Reference — `@obinexusltd/obix-component-link`

## `createLink(config: LinkConfig): DOPComponent<LinkState>`

Throws `TypeError` if `href` or `label` is missing/empty.

```ts
import { createLink } from "@obinexusltd/obix-component-link";

const link = createLink({ href: "https://example.com", label: "Visit example.com" });
link.render(link.state);
```

## `renderLink(config: LinkConfig, overrides?: Partial<LinkState>): string`

One-shot create + render.

## `LinkConfig`

| Field | Type | Default | Notes |
|---|---|---|---|
| `href` | `string` | — | **Required.** |
| `label` | `string` | — | **Required.** Visible text. |
| `target` | `LinkTarget` | `"_self"` | `"_blank" \| "_self" \| "_parent" \| "_top"` |
| `rel` | `string` | `"noopener noreferrer"` when `target === "_blank"`, else `""` | Explicit value always wins. |
| `external` | `boolean` | auto-detected from `href` | See `looksExternal()` below. |
| `download` | `string` | `""` | Filename; presence turns the link into a download. |
| `ariaLabel` | `string` | computed — see [accessibility.md](./accessibility.md) | |
| `visited` | `boolean` | `false` | |

## `LinkState`

`LinkConfig`'s resolved fields (`target`, `rel`, `external`, `download`, `ariaLabel`, `visited` always concrete, never `undefined`).

## External-link detection

`looksExternal(href)` returns `true` for any absolute URL with a scheme or protocol-relative form (`//host/...`) that doesn't start with `/`. A plain path (`/about`) or relative path is treated as internal. Pass `external` explicitly to override the heuristic.

## Actions

| Action | Signature | Behaviour |
|---|---|---|
| `navigate` | `(s) => s` | Sets `visited: true`. Does not perform navigation itself. |
| `setExternal` | `(s, isExternal: boolean) => s` | Updates `external`; also sets a safe `rel` if switching to external + `_blank` and `rel` was empty. |
| `updateHref` | `(s, href: string) => s` | Replaces `href`; re-runs `looksExternal` unless `config.external` was explicitly set at construction. |

## Exported types

`Action<S>`, `DOPComponent<S>`, `LinkConfig`, `LinkState`, `LinkTarget`.
