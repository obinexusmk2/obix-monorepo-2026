# Styling — `@obinexusltd/obix-component-button`

This package ships no CSS. `render()` emits class names only — you own the stylesheet.

## Emitted classes

| Class | When |
|---|---|
| `obix-button` | Always. |
| `obix-button--primary` / `--secondary` / `--ghost` / `--danger` | One, from `variant`. |
| `obix-button--sm` / `--md` / `--lg` | One, from `size`. |
| `obix-button__spinner` | Only while `loading` (the spinner element itself). |

## Attributes you can hook on

Beyond classes, `render()` sets plain attributes you can also select on in CSS if you prefer attribute selectors over the `disabled`/`aria-*` state classes above:

- `disabled`, `aria-disabled="true"` — while disabled or loading.
- `aria-busy="true"` — while loading.
- `aria-pressed="true"|"false"` — only present on `toggle: true` buttons.

## Example stylesheet skeleton

```css
.obix-button {
  min-width: 48px;
  min-height: 48px;
  border-radius: 6px;
  font: inherit;
  cursor: pointer;
}
.obix-button--primary { background: var(--obix-color-primary, #2563eb); color: #fff; }
.obix-button--secondary { background: var(--obix-color-secondary, #e5e7eb); }
.obix-button--ghost { background: transparent; border: 1px solid currentColor; }
.obix-button--danger { background: var(--obix-color-danger, #dc2626); color: #fff; }

.obix-button--sm { padding: 4px 10px; font-size: 0.875rem; }
.obix-button--md { padding: 8px 16px; font-size: 1rem; }
.obix-button--lg { padding: 12px 22px; font-size: 1.125rem; }

.obix-button[aria-busy="true"] { cursor: progress; }
.obix-button[disabled] { opacity: 0.6; cursor: not-allowed; }

.obix-button__spinner {
  display: inline-block;
  width: 1em; height: 1em;
  margin-inline-end: 0.5em;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: obix-spin 0.6s linear infinite;
}
@keyframes obix-spin { to { transform: rotate(360deg); } }
```

The `--obix-color-*` custom properties above are a suggested convention, not something this package defines or reads — pick names that fit your own design tokens.
