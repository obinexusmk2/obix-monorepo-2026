# @obinexusltd/obix-parser

**Section scanner + strict OBIX template/script parser.**

```bash
npm install @obinexusltd/obix-parser
```

## Purpose

Turns a `PascalCaseComponent.obix` source into an AST:

| Export | Role |
|---|---|
| `scanSections(source)` | split into `<style>` / `<template>` / `<script>`; tolerates all top-level whitespace; flags duplicates |
| `parseTemplate(raw)` | strict OBIX template grammar over a semantic-HTML vocabulary — text/attr interpolation, boolean attrs, `aria-*`, `on:event`, `obix:if` |
| `parseScript(raw)` | **structural** extraction of `state` / `props` / `actions` / `derived` / `effects` — does *not* parse JS expressions |
| `parseStyles(raw)` | brace-balance check; hands raw CSS to `obix-styles` |
| `parseObix(source, name)` | all of the above + `obix-spec.validateObixAST()` |

## The parser seal (Problem 7)

There is no cryptographic "conformance seal". After parsing, the AST is passed
through `obix-spec.validateObixAST()`. Any third-party parser must produce an AST
that passes the same structural gate before the compiler will accept it. That
gate — not a signature — *is* the seal.

## Dependency role

Depends only on `@obinexusltd/obix-spec`. **Never** depends on any adapter, the
runtime, or the compiler. Consumed by `obix-compiler` and `obix-language-server`.

## Level 0 status

✅ Section scanning, strict template subset (interpolation, boolean/ARIA attrs,
`on:` events, single-element `obix:if` as required by the frozen Timer fixture),
structural script extraction. Deferred to Level 1: loops, slots, composition,
mixed attribute interpolation, SCSS, full JS parsing.
