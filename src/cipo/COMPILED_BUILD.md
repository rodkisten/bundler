# Cipó + Fábrica compiled build mode

Compiled build mode keeps the authoring model exactly the same and moves the expensive work out of the hot path:

- Cipó `styled.*(...).css\`...\`` blocks become deterministic class names.
- The generated CSS is real Cipó CSS compiled by the existing runtime compiler.
- By default, Vite bundles that CSS as a virtual JS module and injects it with `insertCss()`, so the browser still receives the same runtime `<style id="cipo-runtime-style">` behavior.
- `cssDelivery: 'asset'` is available when a separate `.css` file is wanted.
- Fábrica `html\`...\`` / `jsx.html\`...\`` templates are lowered to `document.createElement` helpers where safe.
- Dynamic templates use `createCompiledTemplate(...)`, which parses the static HTML once and hydrates values through Fábrica runtime primitives.
- Unsupported or risky Fábrica shapes fall back to `html\`...\`` inside the helper, preserving all current runtime behavior.

The important design point: **this is not a second engine**. Cipó build mode calls the existing stylesheet compiler. Fábrica build mode delegates props, events and children to `applyProps`, `bindEvent` and `appendValue`.

## Vite usage

```ts
import { defineConfig } from 'vite'
import { cipoVite } from './src/cipo/src/vite'

export default defineConfig({
  plugins: [
    cipoVite({
      mode: 'build',
      cssDelivery: 'style-tag', // default: compiled CSS is injected through Cipó runtime style tag
      compileFabrica: true,
      transformCssTag: true,
    }),
  ],
})
```

To emit a physical CSS asset instead:

```ts
cipoVite({
  mode: 'build',
  cssDelivery: 'asset',
  cssFileName: 'devtools.compiled.css',
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

## Default build output shape

```ts
import '\0cipo:compiled-style-tag.js'

const Panel = styled.div('Panel')('cp-Panel-abcd123')
```

The virtual style module is JS, not a CSS file:

```ts
import { insertCss } from './src/cipo/src/injection'

insertCss(`
.cp-Panel-abcd123{display:flex;gap:8px;}
.cp-Panel-abcd123:hover{opacity:0.9;}
`)
```

That keeps build mode hydrated with the same `<style>` tag and dedupe behavior used by runtime mode.

## Fábrica input

```ts
const view = html`<button class="save" @click=${save}>Salvar</button>`
```

## Fábrica build output shape

```ts
import { createCompiledElement, createCompiledTemplate } from './fabrica/compiler'

const view = createCompiledTemplate([
  '<button class="save" @click=',
  '>Salvar</button>',
] as unknown as TemplateStringsArray, save)
```

For fully static single-root templates, the compiler can lower further:

```ts
const view = createCompiledElement('button', { class: 'save' }, 'Salvar')
```

## Runtime reuse contract

Compiled Fábrica helpers intentionally call existing runtime code:

| Feature | Runtime primitive reused |
|---|---|
| `@click`, `@input.prevent`, delegated modifiers | `bindEvent()` |
| `class`, `style`, `attrs`, `dataset`, `on` maps | `applyProps()` |
| children, arrays, DOM nodes, raw HTML, component output, directives | `appendValue()` |
| unsupported component-tag syntax or risky templates | `html()` fallback |

This keeps `@evento` behavior aligned with runtime and avoids maintaining a shadow implementation.

## DevTools build

The repository build script routes the `devtools` root entry through Vite and scopes the transform to `src/devtools/**`:

```txt
src/devtools.ts -> Vite -> cipoVite({
  mode: 'build',
  cssDelivery: 'style-tag',
  compileFabrica: true,
})
```

The build emits:

```txt
dist/devtools.iife.js
dist/devtools.iife.min.js
dist/cipo.compiled.manifest.json
```

No CSS file is emitted by default because the compiled CSS is hydrated through Cipó's runtime style tag. Use `cssDelivery: 'asset'` when you explicitly want a real asset next to the bundle.
