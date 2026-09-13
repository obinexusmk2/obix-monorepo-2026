# Accessibility — `@obinexusltd/obix-component-button`

## WCAG 2.5.5 Target Size

`ButtonState.minWidth` / `minHeight` are hard-coded to `"48px"` and applied via an inline `style` attribute on every render, regardless of `size`. This is not configurable through `ButtonConfig` — it is a floor, not a default, so `obix-button--sm` still meets the touch-target minimum.

## Disabled vs. loading

Both states set the `disabled` attribute and `aria-disabled="true"`. `loading` additionally sets `aria-busy="true"` and renders a `<span aria-hidden="true" class="obix-button__spinner">` — the spinner is decorative and hidden from assistive tech; the accessible name still comes from `aria-label`/the button text, so screen readers announce the label, not "spinner".

```html
<button class="obix-button obix-button--primary obix-button--md" type="button"
        aria-label="Save" style="min-width:48px;min-height:48px"
        disabled aria-disabled="true" aria-busy="true">
  <span aria-hidden="true" class="obix-button__spinner"></span>Save
</button>
```

## Toggle buttons

When `toggle: true`, `aria-pressed` is emitted and flips via `actions.toggle`. Screen readers announce "pressed" / "not pressed" — do not pair `toggle` with `aria-expanded` semantics; this component only emits `aria-pressed`.

## Accessible name

`aria-label` defaults to `label`. Set `ariaLabel` explicitly when the visible label is not a sufficient accessible name (e.g. an icon-only button using `label` purely as a tooltip string is still required — this component has no icon-only mode, `label` is always rendered as text content).

## Text escaping

`label` is HTML-escaped before being placed in the DOM (`esc()` in `src/index.ts`), so user-supplied text cannot break out of the `<button>` element or inject markup.

## What this component does **not** do

- It does not manage focus trapping or keyboard shortcuts — `focus`/`blur` actions only track `focused` state for your own styling hooks.
- It does not debounce double-clicks; `click` is a no-op only when `disabled`/`loading` is already true.
