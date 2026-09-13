# Accessibility — `@obinexusltd/obix-component-tooltip`

## `aria-describedby`, not `aria-labelledby`

```html
<span class="obix-tooltip-trigger" tabindex="0" aria-describedby="obix-tooltip"
      data-activate-on="hover" data-delay="0" data-close-delay="200">
  ?
</span>
<div id="obix-tooltip" role="tooltip" class="obix-tooltip obix-tooltip--top" hidden>
  Your password must be at least 12 characters.
</div>
```

The trigger references the tooltip via `aria-describedby`, which tells assistive tech "this text further describes the trigger" — the correct relationship for supplementary help text, as opposed to `aria-labelledby` (which would replace the trigger's accessible name entirely).

## `tabindex="0"` on the trigger

The trigger is always focusable, regardless of `activateOn` — a hover-only tooltip that isn't reachable by keyboard would be inaccessible to anyone who doesn't use a mouse. Pair `activateOn: "hover"` with real `focus`/`blur` handlers alongside `mouseenter`/`mouseleave` in your integration so keyboard users can trigger the same tooltip a mouse user gets.

## Keep `content` short

`content` is rendered as plain escaped text, not rich HTML (unlike `obix-component-card`/`obix-component-modal`, which treat their content field as trusted HTML) — tooltips are meant for short supplementary text, not complex interactive content, per the WAI-ARIA tooltip pattern's guidance that a tooltip should not contain focusable elements.

## `role="tooltip"` and visibility

The tooltip `<div>` always carries `role="tooltip"`; the `hidden` attribute (present when `!visible`) is what actually removes it from the accessibility tree — screen readers do not announce `hidden` elements, so toggling `visible` is both the visual and the accessibility-tree control.
