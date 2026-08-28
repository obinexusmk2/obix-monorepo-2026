import test from "node:test";
import assert from "node:assert/strict";
import { scopeCss, scopeComponentCss, createScopeToken } from "../dist/index.js";
import { createScopeToken as specToken } from "@obinexusltd/obix-spec";

test("re-exports the ONE canonical token function", () => {
  assert.equal(createScopeToken, specToken);
  assert.equal(createScopeToken("Timer"), specToken("Timer"));
});

test("scopeCss appends the scope attribute to the rightmost compound", () => {
  const { css } = scopeCss(".Timer__button { color: red; }", "obix-abcdef01");
  assert.match(css, /\.Timer__button\[data-obix-scope="obix-abcdef01"\]/);
});

test("scopeCss handles descendant selectors + @media", () => {
  const { css } = scopeCss("@media (min-width: 40em) { .a .b { color: blue; } }", "obix-11111111");
  assert.match(css, /@media \(min-width: 40em\)/);
  assert.match(css, /\.a \.b\[data-obix-scope="obix-11111111"\]/);
});

test("scopeComponentCss derives the token deterministically", () => {
  const a = scopeComponentCss("Timer", ".x{color:red}");
  const b = scopeComponentCss("Timer", ".x{color:red}");
  assert.equal(a.token, b.token);
  assert.equal(a.css, b.css);
});
