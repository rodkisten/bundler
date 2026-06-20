# Rod Browser Toolbox
[see online](https://rodkisten.github.io/bundler)

[![📦 Publish browser bundle](https://github.com/rodkisten/bundler/actions/workflows/publish-browser-bundle.yml/badge.svg)](https://github.com/rodkisten/bundler/actions/workflows/publish-browser-bundle.yml)

Browser-first build system for the Rod ecosystem. The project emits one browser global per root entrypoint, plus ESM/IIFE builds, extracted examples, and a generated landing page.

## Packages

| Root entry | Browser global | Ownership |
|---|---:|---|
| `src/broto.ts` | `window.Broto` | reactive runtime: signal, computed, effect, batch, store, graph, scheduler, async resources |
| `src/fabrica.ts` | `window.Fabrica` | HTML/UI runtime: templates, parser, renderer, directives, DOM parts, components and hydration |
| `src/fabrica-elements.ts` | `window.FabricaElements` | element/component factories: createElement, adapters, props, refs, children, wrappers |
| `src/cipo.ts` | `window.Cipo` | CSS runtime: aliases, tokens, atomic engine, stylesheet compiler |
| `src/index.ts` | `window.Rod` | umbrella namespace exporting Broto, Fabrica, FabricaElements and Cipo |

## Architecture

```txt
Broto
 ├── signal
 ├── computed
 ├── effect
 ├── batch
 ├── store
 ├── graph
 ├── scheduler
 ├── async
 └── resources

Fabrica
 ├── html
 ├── template parser
 ├── renderer
 ├── directives
 ├── DOM parts
 ├── components
 └── hydration

Fabrica Elements
 ├── createElement
 ├── adapters
 ├── props
 ├── refs
 ├── children
 └── component wrappers

Cipo
 ├── css runtime
 ├── aliases
 ├── tokens
 ├── atomic engine
 └── stylesheet compiler
```

## Build outputs

```txt
src/broto.ts              -> dist/broto.iife.js              -> window.Broto
src/fabrica.ts            -> dist/fabrica.iife.js            -> window.Fabrica
src/fabrica-elements.ts   -> dist/fabrica-elements.iife.js   -> window.FabricaElements
src/cipo.ts               -> dist/cipo.iife.js               -> window.Cipo
src/index.ts              -> dist/index.iife.js              -> window.Rod
```

Every entry also gets `.iife.min.js`, `.esm.js`, `.esm.min.js`, source maps and build metadata when enabled.

## Commands

```bash
pnpm typecheck
pnpm build
pnpm verify
```

## Example extraction

The builder extracts `@example` blocks from TSDoc. When a single TSDoc comment has multiple examples, the shared summary/remarks text is rendered once for the group instead of being duplicated for every example.

## Landing page

`dist/index.html` uses a responsive forest/mata visual theme with layered gradients, noise, glass panels, modern CSS filters and mobile-safe layouts.


## Cipó native CSS functions and stylesheet authoring

Cipó now separates platform CSS functions from custom helpers. Native CSS such as
`max()`, `min()`, `clamp()`, `calc()`, `env()`, `var()`, `light-dark()`,
`color-mix()`, `oklch()`, gradients, filters, transforms, shapes and grid helpers
passes through untouched while Cipó-only helpers such as `alpha()` and
`outlineGlow()` are resolved by the helper registry.

Input:

```ts
const styleText = Cipo.sheet.css`
  .panel {
    right: max(0.5rem, env(safe-area-inset-right))
    bottom:
      max(1.125rem, env(safe-area-inset-bottom))
    background: linear-gradient(180deg, color-mix(in oklch, $panel 88%, transparent), light-dark(#fff, #000))
    color: oklch(from $brand l c h)
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr))
  }
`;
```

Output:

```css
.panel {
  right: max(0.5rem, env(safe-area-inset-right));
  bottom: max(1.125rem, env(safe-area-inset-bottom));
  background: linear-gradient(180deg, color-mix(in oklch, var(--cipo-colors-panel) 88%, transparent), light-dark(#fff, #000));
  color: oklch(from var(--cipo-colors-brand) l c h);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
}
```

Future browser functions can be registered without creating custom helpers:

```ts
Cipo.registerNativeFunction('anchor-size');

Cipo.sheet.css`
  .popover {
    width: anchor-size(width)
  }
`;
```

The declaration tokenizer also supports multi-line values where the property and
value are split across lines, which is useful for mobile-first safe-area CSS.

## Fábrica component runtime upgrade

Fábrica now supports deep component composition and ownership-aware rendering.

Input:

```ts
const Button = Fabrica.component(function Button(props) {
  return Fabrica.html`
    <button class=${props.class}>
      ${props.children}
    </button>
  `;
});

Fabrica.render(document.body, Fabrica.html`
  <${Button} class="primary">
    Save
  </${Button}>
`);
```

Output:

```html
<button class="primary">Save</button>
```

The runtime now links DOM ranges to Broto owners, so effects, resources, context, refs, event listeners and lifecycle cleanup are disposed together.

## Fábrica micro-JSX

Fábrica now has a tiny JSX-like syntax inside template strings. It is still browser-native: no Babel, no AST transform, no virtual DOM.

Input:

```ts
const Dock = Fabrica.component(function Dock() {
  return Fabrica.html`<button>Open</button>`;
});

Fabrica.render(document.body, Fabrica.html.jsx`
  <Dock />
`);
```

Output:

```html
<button>Open</button>
```

For explicit parser-safe composition:

```ts
Fabrica.render(document.body, Fabrica.html.jsx`
  <f-component name="Dock" />
`);
```

Unregistered components render a visible `<fabrica-component-error>` fallback, which makes broken names obvious during userscript debugging.

## Error boundaries and owned async resources

Input:

```ts
const Profile = Fabrica.component(function Profile(props, ctx) {
  const profile = ctx.resource(
    (abort, id) => fetch(`/users/${id}`, { signal: abort }).then((r) => r.json()),
    { source: () => props.id, cacheKey: (id) => `user:${id}`, retries: 1 },
  );

  return Fabrica.html`${() => profile().loading ? "Loading" : profile().value?.name}`;
});
```

Output while loading:

```html
Loading
```

Output after success:

```html
Rod
```

## Fabrica micro-JSX, preferred syntax

Use `Fabrica.jsx.html` for component templates. It keeps the runtime browser-native and usually gives better syntax highlighting than `html.jsx`.

```ts
const Panel = Fabrica.component("Panel", function Panel(props) {
  return Fabrica.html`<section>${props.children}</section>`;
});

Fabrica.render(document.body, Fabrica.jsx.html`
  <Panel>Inspector</Panel>
`);
```

`Fabrica.html.jsx` still works. Dynamic props on component tags are passed as raw values, so objects, signals and functions are not stringified.

## Staff-level additive APIs

This pass keeps existing APIs intact and adds diagnostics/composition helpers for larger apps and userscripts.

### Broto diagnostics

```ts
import { inspectRuntime, inspectSignals, inspectEffects, inspectScheduler } from './src/broto'

const snapshot = inspectRuntime()
console.table(snapshot.signals)
console.table(snapshot.effects)
console.log(snapshot.scheduler)
```

Use this to find effect leaks, owner trees that were not disposed, resources still polling, and large reactive graphs.

### Fabrica lifecycle helpers

```ts
import { onMount, onDispose, onError } from './src/fabrica'

onMount(() => {
  const controller = new AbortController()
  window.addEventListener('resize', sync, { signal: controller.signal })
  return () => controller.abort()
})

onDispose(() => console.log('owner disposed'))
onError((error) => {
  console.error(error)
  return true
})
```

These helpers are additive. Component context lifecycle APIs continue working as before.

### Fabrica Elements recipes

```ts
import { recipeProps } from './src/fabrica-elements'

const button = recipeProps({
  base: { class: 'btn', type: 'button' },
  variants: {
    tone: { primary: { class: 'btn-primary' }, danger: { class: 'btn-danger' } },
    size: { sm: { class: 'btn-sm' }, lg: { class: 'btn-lg' } },
  },
  defaults: { tone: 'primary', size: 'sm' },
  compound: [{ tone: 'danger', size: 'lg', props: { class: 'btn-danger-lg' } }],
})

button({ tone: 'danger', size: 'lg', class: 'extra' })
// { class: 'btn btn-danger btn-lg btn-danger-lg extra', type: 'button', ... }
```

### Cipó source explanations

```ts
import { explainCss } from './src/cipo/src'

const report = explainCss('.card { bg: alpha($brand / 20%) }', 'stylesheet')
console.log(report.transformedCss)
console.log(report.cssText)
console.log(report.validation)
```
