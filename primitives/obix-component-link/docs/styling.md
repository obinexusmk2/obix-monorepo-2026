# Styling — `@obinexusltd/obix-component-link`

No CSS is shipped.

## Emitted classes

| Class | When |
|---|---|
| `obix-link` | Always. |
| `obix-link--external` | When `external` is true. |
| `obix-link--visited` | When `visited` is true (you control this via the `navigate` action — it is not derived from browser `:visited` history). |
| `obix-link__external` | The `↗` indicator span, only rendered when `external`. |

## Example stylesheet skeleton

```css
.obix-link { color: var(--obix-link-color, #2563eb); text-decoration: underline; }
.obix-link--visited { color: var(--obix-link-visited-color, #7c3aed); }
.obix-link__external { margin-inline-start: 0.15em; font-size: 0.85em; }
```

Because `obix-link--visited` is driven by your own `visited` state rather than the browser's native `:visited` pseudo-class, you can style it consistently across origins and clear it on demand — at the cost of it not reflecting actual browser history unless you wire that up yourself (e.g. checking `document.querySelector(...).matches(':visited')`, which is itself heavily restricted by browsers for privacy reasons).
