# @obinexusltd/obix-game-pong

**ObixPong** — a neon Pong built the OBIX way: state, physics, rendering, and
DOM wiring are four separate modules, none of which know about the others'
concerns. Zero dependencies.

```bash
npm install @obinexusltd/obix-game-pong
```

```ts
import { mountPong } from "@obinexusltd/obix-game-pong";

mountPong(document.getElementById("game"));
```

Controls: `W`/`S` for the left paddle, `↑`/`↓` for the right, `Space` to
serve, pause, resume, or start a new game after one ends.

## Why this exists

This package is a demonstration of the OBIX `{ name, state, actions, render }`
Data-Oriented pattern applied to something that isn't a static UI widget: a
real-time game loop, with the same purity and separation-of-concerns
guarantees as `@obinexusltd/obix-component-button` or the
`@obinexusltd/obix-adapter-*` projections elsewhere in this monorepo. See
[docs/architecture.md](docs/architecture.md) for exactly how the four layers
(`physics.ts`, `actions.ts`, `render.ts`, `mount.ts`) divide the work, and
[docs/testing.md](docs/testing.md) for how that separation lets the entire
game's logic be unit-tested without a browser.

## Documentation

- [docs/api-reference.md](docs/api-reference.md) — every exported function and type
- [docs/usage-guide.md](docs/usage-guide.md) — installation and common recipes
- [docs/architecture.md](docs/architecture.md) — the four-layer separation of concerns
- [docs/physics.md](docs/physics.md) — the collision/scoring model in depth
- [docs/accessibility.md](docs/accessibility.md) — keyboard controls, ARIA, the live announcer
- [docs/testing.md](docs/testing.md) — what's covered and how to add a test

## Assets

`assets/images/` — background, ball, and paddle art by
[Hektor Profe](https://hektorprofe.net/), licensed
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); see
[LICENSE-ASSETS.txt](LICENSE-ASSETS.txt) for the full attribution. The demo's
score/heading font is [Micro 5](https://fonts.google.com/specimen/Micro+5),
loaded from Google Fonts rather than vendored.

## Demo

```bash
npm run build
node ../../scripts/_dev_static_server.mjs games/obix-game-pong 8080
# open http://localhost:8080/examples/index.html
```

(Any static file server works — `examples/index.html` only needs `dist/` built once.)

Source code is MIT-licensed — see [LICENSE](LICENSE).
