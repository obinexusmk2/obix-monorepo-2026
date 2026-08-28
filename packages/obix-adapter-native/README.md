# @obinexusltd/obix-adapter-native

**The Native projection — the only OBIX adapter that touches the DOM.**

```bash
npm install @obinexusltd/obix-adapter-native
```

## API

```ts
import { mount } from "@obinexusltd/obix-adapter-native";
const handle = mount(artifact, document.querySelector("#app"), { props: { limitSeconds: 5 } });
handle.instance.dispatch("Start");
handle.unmount();
```

Builds the DOM from `artifact.template`, wires `obix-runtime` bindings by
child-index path, and drives state through the **reactive** projection — so every
transition still goes through `obix-ir.applyAction`.

## Dependency role

`obix-spec`, `obix-ir`, `obix-adapter-reactive`, `obix-runtime`. It is the single
DOM boundary: SSR and the four pure adapters never import it, and
`obix-adapter-ssr` structurally cannot.

## Level 0 status

✅ `mount`, text / attribute / boolean / ARIA bindings, single-element `obix:if`,
native events, `every` effects. Deferred: loops, slots, composition, hydration.
