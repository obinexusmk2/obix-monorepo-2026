# @obinexusltd/obix-component-link

**The `ObixLink` primitive** — a semantic anchor with automatic external-link
indication and safe `rel` defaults.

Split out of `@obinexusltd/obix-component-primitives` as an independent package.

```bash
npm install @obinexusltd/obix-component-link
```

> **Zero dependencies.** Data-Oriented: `{ name, state, actions, render }`.
> Actions are pure `(state, …args) => newState`; `render(state)` is deterministic
> HTML. Spec: `docs/obix-docs/OBIX_COMPONENT_DOCUMENTATION_PART2.md` § ObixLink.

## API

```ts
import { createLink, renderLink } from "@obinexusltd/obix-component-link";

renderLink({ href: "/about", label: "About Us", ariaLabel: "About Us page" });
// <a class="obix-link" href="/about" aria-label="About Us page">About Us</a>

renderLink({ href: "https://example.com", label: "External Site", target: "_blank" });
// <a class="obix-link obix-link--external" href="https://example.com" target="_blank"
//    rel="noopener noreferrer" aria-label="External Site (opens in a new window)">
//   External Site<span class="obix-link__external" aria-hidden="true">↗</span></a>

renderLink({ href: "/document.pdf", label: "Download Guide", download: "guide.pdf" });
// … download="guide.pdf" aria-label="Download Guide (download)" …
```

### `createLink(config)`

| config | type | default |
|---|---|---|
| `href` | `string` | **required** |
| `label` | `string` | **required** |
| `target` | `"_blank" \| "_self" \| "_parent" \| "_top"` | `"_self"` |
| `rel` | `string` | `"noopener noreferrer"` when `target="_blank"` |
| `external` | `boolean` | auto-detected from the protocol |
| `download` | `string` (filename) | — |
| `ariaLabel` | `string` | derived (adds "(opens in a new window)" / "(external link)" / "(download)") |
| `visited` | `boolean` | `false` |

### Actions — `link.actions.*(state, …args) → LinkState`

`navigate` · `setExternal(state, external)` · `updateHref(state, href)`

## Accessibility

- External links flagged visually (`obix-link--external` + `↗`) and in the
  `aria-label` · `rel="noopener noreferrer"` forced for `target="_blank"` ·
  descriptive `aria-label` derived when not supplied · `label` / `aria-label` HTML-escaped

## Related primitives

`@obinexusltd/obix-component-`[`button`](../obix-component-button) ·
[`card`](../obix-component-card) ·
[`image`](../obix-component-image) ·
[`video`](../obix-component-video)
