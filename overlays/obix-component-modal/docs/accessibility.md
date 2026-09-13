# Accessibility — `@obinexusltd/obix-component-modal`

## Dialog semantics

```html
<div class="obix-modal-backdrop" data-backdrop="dark" data-close-on-backdrop="true">
  <div class="obix-modal obix-modal--md obix-modal--centered" role="dialog"
       aria-modal="true" aria-labelledby="obix-modal-title" data-close-on-escape="true">
    <h2 id="obix-modal-title" class="obix-modal__title">Delete item?</h2>
    <div class="obix-modal__body">...</div>
    <div class="obix-modal-actions">...</div>
  </div>
</div>
```

- `role="dialog"` + `aria-modal="true"` mark the element as a modal dialog to assistive tech.
- `aria-labelledby="${id}-title"` links the dialog to its heading — this is why `id` should be unique per modal *type* on a page.

## What you must wire yourself

This package renders markup and data attributes but does not manage behaviour. To meet WAI-ARIA Dialog (Modal) authoring practices, your integration is responsible for:

1. **Focus trapping** — moving focus into the dialog on open, cycling Tab/Shift+Tab within it, and returning focus to the trigger element on close.
2. **Escape to close** — listen for `Escape` and check `data-close-on-escape` (see [usage-guide.md](./usage-guide.md)).
3. **Backdrop click to close** — check `data-close-on-backdrop` the same way.
4. **`inert`/`aria-hidden` on background content** — hide the rest of the page from assistive tech while the modal is open.

## Why `render()` returns `""` while closed

Rendering nothing while `isOpen` is `false` means the dialog markup — including its `role="dialog"` — is not present in the DOM at all when closed, so there's no risk of a screen reader encountering an inert dialog element or of it interfering with tab order before it's opened.

## Content trust

`title` is escaped; `content` is trusted HTML — sanitize it yourself if it can originate from user input, the same trust boundary as `obix-component-card`.
