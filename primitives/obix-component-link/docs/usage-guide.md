# Usage Guide — `@obinexusltd/obix-component-link`

## Install

```bash
npm install @obinexusltd/obix-component-link
```

Zero runtime dependencies.

## Quick start

```ts
import { createLink } from "@obinexusltd/obix-component-link";

const link = createLink({ href: "/docs", label: "Read the docs" });
document.querySelector("#slot")!.innerHTML = link.render(link.state);
// <a class="obix-link" href="/docs" aria-label="Read the docs">Read the docs</a>
```

## External links

External-ness is auto-detected from the URL — you rarely need to set `external` yourself:

```ts
createLink({ href: "https://other-site.com", label: "Other Site", target: "_blank" });
// rel defaults to "noopener noreferrer"; an ↗ indicator is appended; aria-label
// becomes "Other Site (opens in a new window)"
```

## Downloads

```ts
createLink({ href: "/report.pdf", label: "Download report", download: "report.pdf" });
// aria-label becomes "Download report (download)"
```

## Overriding the accessible name

```ts
createLink({ href: "/settings", label: "Settings", ariaLabel: "Account settings" });
```

An explicit `ariaLabel` always wins over the computed one — see [accessibility.md](./accessibility.md) for the full precedence order.

## Updating href after construction

```ts
let state = link.state;
state = link.actions.updateHref(state, "https://new-destination.com");
// external re-evaluated automatically unless `external` was set explicitly in the original config
```
