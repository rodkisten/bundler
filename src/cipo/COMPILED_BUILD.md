# Cipó + Fábrica compiled build mode

Compiled build mode turns the existing Cipó/Fábrica authoring model into production assets:

- Cipó `styled.*(...).css\`...\`` blocks become deterministic class names.
- The generated CSS is emitted by Vite as a real `.css` asset.
- Fábrica static `html\`...\`` / `jsx.html\`...\`` templates are lowered to `document.createElement` helpers when the template is safe to compile.
- Dynamic/complex templates stay on the current runtime compiler path.

The important design point: this is not a second CSS engine. The build compiler calls the existing Cipó compiler, so helpers, aliases, nesting, variants, theme config and formatting stay aligned with runtime behavior.

## Vite usage

```ts
import { defineConfig } from 'vite'
import { cipoVite } from './src/cipo/src/vite'

export default defineConfig({
  plugins: [
    cipoVite({
      mode: 'build',
      cssFileName: 'devtools.compiled.css',
      compileFabrica: true,
      transformCssTag: true,
    }),
  ],
})
```

## Cipó input

```ts
const Panel = styled.div('Panel').css`
  display: flex;
  gap: 8px;

  &:hover {
    opacity: 0.9;
  }
`
```

## Build output shape

```ts
import '\0cipo:compiled.css'

const Panel = styled.div('Panel')('cp-Panel-abcd123')
```

and the Vite asset contains CSS similar to:

```css
.cp-Panel-abcd123{display:flex;gap:8px;}
.cp-Panel-abcd123:hover{opacity:0.9;}
```

## Fábrica input

```ts
const view = html`<button class="save">Salvar</button>`
```

## Fábrica build output shape

```ts
import { createCompiledElement } from './fabrica/compiler'

const view = createCompiledElement('button', { class: 'save' }, 'Salvar')
```

The helper uses `document.createElement`, applies props/events with Fábrica semantics and appends children with the existing `appendValue` pipeline. That keeps directives, arrays, nodes and component outputs compatible when they appear as children from compiled code.

## Safety rules

The compiler only rewrites templates it can prove are static enough:

- static Cipó CSS templates compile to CSS assets;
- dynamic Cipó CSS templates with `${...}` stay on runtime;
- simple single-root Fábrica HTML compiles to createElement;
- components, spreads, comments, `<template>`, interpolations and complex templates stay on runtime.

This makes the mode production-safe by default: when uncertain, the compiler preserves the current runtime behavior.

## DevTools build

The repository build script now routes the `devtools` root entry through Vite:

```txt
src/devtools.ts -> Vite -> cipoVite({ mode: 'build' })
```

The build emits:

```txt
dist/devtools.iife.js
dist/devtools.iife.min.js
dist/devtools.compiled.css
dist/cipo.compiled.manifest.json
```
