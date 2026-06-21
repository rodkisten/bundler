# Cipó Next 🌿

Cipó is the CSS owner in the Rod browser toolbox. It provides a semantic CSS DSL, atomic class generation, full stylesheet compilation, inline style compilation, JIT caching, theme tokens, helpers, aliases, recipes and browser-friendly debug tools.

Cipó does **not** own HTML rendering. Fábrica owns reactivity/templates. `fabrica-elements` owns element/component factories. Cipó consumes that bridge for `cipo.div.css``...`` ` and `cipo(Component).css``...`` `.

## Install / import

```ts
import {
  assertAtomicCssArtifact,
  cipo,
  css,
  explain,
  inline,
  injectGlobal,
  injectStyle,
  recipe,
  registerAlias,
  registerHelper,
  registerProperty,
  setup,
  theme,
} from './src/cipo'
```

Userscript:

```js
// @require https://OWNER.github.io/REPO/cipo.iife.js
const { css, inline, setup } = window.Cipo
```

## Setup with theme

Input:

```ts
setup({
  prefix: 'rod',
  layers: true,
  minify: false,
  rem: { enabled: true, baseFontSize: 16 },
  colorMode: 'oklch',
  jit: { enabled: true, cache: true, maxEntries: 3000 },
  theme: {
    colors: {
      brand: '#f97316',
      panel: '#0f172a',
      ink: '#f8fafc',
      danger: '#ef4444',
    },
    spacing: '0.25rem',
    radius: { md: '12px', xl: '24px' },
    shadow: { panel: '0 24px 80px rgb(0 0 0 / 0.35)' },
    text: { sm: '0.875rem', lg: '1.25rem' },
  },
})
```

Output token layer shape:

```css
@layer cipo.tokens {
  :root {
    --rod-colors-brand: #f97316;
    --rod-colors-panel: #0f172a;
    --rod-radius-xl: 1.5rem;
  }
}
```

## Token inference

Input:

```css
bg: $panel
color: $ink
rounded: $xl
shadow: $panel
```

Output shape:

```css
background: var(--rod-colors-panel);
color: var(--rod-colors-ink);
border-radius: var(--rod-radius-xl);
box-shadow: var(--rod-shadow-panel);
```

Explicit namespaces are also supported:

```css
bg: $colors.panel
rounded: $radius.xl
```

Legacy `$theme.colors.panel` remains supported for compatibility.

## Atomic/component mode

Declaration-first CSS returns a class artifact.

Input:

```ts
const card = css`
  glass
  px: 4
  py: 3
  bg: $panel
  color: $ink
  rounded: $xl

  x:hover {
    bg: alpha($brand / 18%)
  }

  x:md {
    px: 6
  }
`
```

Output API:

```ts
String(card)
// 'rod-s-... rod-a-... rod-a-...'

card.kind
// 'cipo.css'
```

Output CSS shape:

```css
@layer cipo.atomic {
  .rod-a-... {
    padding-inline: calc(var(--rod-spacing, 0.25rem) * 4);
  }

  .rod-a-...:hover {
    background: color-mix(in oklch, var(--rod-colors-brand) 18%, transparent);
  }

  @media (min-width: 768px) {
    .rod-a-... {
      padding-inline: calc(var(--rod-spacing, 0.25rem) * 6);
    }
  }
}
```

## Full stylesheet mode

A top-level selector returns stylesheet text instead of a class list.

Input:

```ts
const sheet = css`
  .card {
    px: 4
    bg: $panel

    &:hover {
      bg: alpha($brand / 18%)
    }
  }
`
```

Output:

```ts
String(sheet)
// '.card { padding-inline: ...; background: ... } .card:hover { ... }'

sheet.kind
// 'cipo.stylesheet'
```

Use it with:

```ts
injectGlobal(sheet)
injectStyle(shadowRoot, sheet)
```

## Inline style mode

Input:

```ts
const style = inline.css`
  px: 2
  py: 1
  color: saturate($brand, 20%)
  bg: alpha($brand / 14%)
`
```

Output:

```ts
String(style)
// 'padding-inline: ...; padding-block: ...; color: ...; background: ...;'
```

## Aliases

Built-in aliases:

```css
hidden
flex
grid
center
glass
buttonBase
focusRing
interactive
cardSurface
truncate
balance
pretty
gpu
absolute-fill
screen-safe
sr-only
```

Custom alias:

```ts
registerAlias('elevatedPanel', `
  glass
  rounded: $xl
  shadow: $panel
`)

const panel = css`
  elevatedPanel
  px: 4
`
```

## Property aliases

Input:

```css
px: 4
py: 2
gap: 3
bg: $brand
rounded: $xl
```

Output:

```css
padding-inline: calc(var(--rod-spacing, 0.25rem) * 4);
padding-block: calc(var(--rod-spacing, 0.25rem) * 2);
gap: calc(var(--rod-spacing, 0.25rem) * 3);
background: var(--rod-colors-brand);
border-radius: var(--rod-radius-xl);
```

Custom property alias:

```ts
registerProperty('bleed', { property: 'margin-inline', scale: 'spacing' })

css`
  bleed: -4
`
```

## Helpers

Built-ins include:

```css
alpha($brand / 18%)
gradient(linear, to right, $brand, $danger)
fluid(1rem, 2rem, 4vw)
spacing(4)
lighten($brand, 10%)
darken($brand, 10%)
saturate($brand, 20%)
```

Custom helper:

```ts
registerHelper('outlineGlow', (args, context) => {
  return `0 0 0 3px ${context.resolveValue(`alpha(${args || '$brand'} / 25%)`)}`
})

css`
  x:focus-visible {
    box-shadow: outlineGlow($brand)
  }
`
```

## x variants

`x:` is reserved for runtime contexts:

```css
x:hover { bg: alpha($brand / 18%) }
x:focus-visible { outline: 2px solid $brand }
x:md { px: 6 }
x:not(md) { width: 100% }
x:dark { bg: $panel }
```

## Recipes

```ts
const button = recipe({
  base: 'buttonBase;focusRing;',
  variants: {
    tone: {
      primary: 'bg:$brand;color:$ink;',
      danger: 'bg:$danger;color:white;',
    },
  },
  defaults: { tone: 'primary' },
})

button({ tone: 'danger' }).className
```

## DOM factories via Fabrica Elements

```ts
const Button = cipo.button.css`
  buttonBase
  bg: $brand
  color: $ink
`

const node = Button({ children: 'Save' })
```

## Debug

```ts
const card = css`color: $brand`
assertAtomicCssArtifact(card)
const firstClass = card.className.split(' ')[0] ?? ''

explain(firstClass)
getCssText()
```

## Limitations

- Fábrica owns real HTML rendering. Cipó's `html``...`` helper is compatibility-only.
- Full stylesheet mode is selector-first. Declaration-first input stays atomic/component mode.
- Helpers should be value-level functions. Use aliases for declaration-level macros.
- JIT cache is runtime-only; build-time extraction is a future step.

## Next steps

- Generate API reference pages from TSDoc comments.
- Add perf benchmark fixtures for parser/JIT hot paths.
- Add optional static extraction for production builds.
- Add more recipe examples and visual kitchen-sink pages.

## Performance and helper safety notes

Cipó 1.1.1 changes the helper resolver from recursive expansion to a bounded iterative scanner. This matters for helpers that expand into other helpers.

Input:

```ts
const button = css`
  px: 4
  py: 2
  bg: $brand
  color: saturate($brand, 20%)
  /* bg: alpha($brand / 14%) */
  #box-shadow: outlineGlow($brand)
  $glassCard
  bleed: -4

  x:focus-visible {
    box-shadow: outlineGlow($brand)
  }

  x:hover {
    bg: alpha($brand / 72%)
  }

  x:md {
    px: 6
  }

  x:not(md) {
    width: 100%
  }
`
```

Output shape:

```css
.cipo-a-... {
  padding-inline: calc(var(--cipo-spacing, 0.25rem) * 4);
}

.cipo-a-... {
  padding-block: calc(var(--cipo-spacing, 0.25rem) * 2);
}

.cipo-a-... {
  background: var(--cipo-colors-brand);
}

.cipo-a-... {
  color: oklch(from var(--cipo-colors-brand) l calc(c + 20%) h);
}

.cipo-a-... {
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--cipo-colors-brand) 28%, transparent);
}

.cipo-a-... {
  margin: calc(var(--cipo-spacing, 0.25rem) * -4);
}

.cipo-a-...:focus-visible {
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--cipo-colors-brand) 28%, transparent);
}

.cipo-a-...:hover {
  background: color-mix(in oklch, var(--cipo-colors-brand) 72%, transparent);
}

@media (min-width: 768px) {
  .cipo-a-... {
    padding-inline: calc(var(--cipo-spacing, 0.25rem) * 6);
  }
}

@media not all and (min-width: 768px) {
  .cipo-a-... {
    width: 100%;
  }
}
```

### New syntax supported in this patch

`$glassCard` as a standalone line expands the registered `glassCard` alias. Inside values, `$brand` still resolves to a theme token.

`#box-shadow: ...` strips the `#` and writes the raw CSS property. This is useful when you want the exact property, not a future alias or plugin override.

`bleed: -4` maps to `margin` with the spacing scale, so it becomes a negative spacing calculation.

Block comments can hide whole Cipó blocks safely:

```css
/*
x:hover {
  bg: alpha($brand / 72%)
}
*/
```

## Styled components with Fábrica

Cipó's callable API is also exported as `styled` for familiar styled-components-like authoring.

```ts
import { styled } from '../cipo'
import { html, render } from '../fabrica'
import { signal } from '../broto'

const tone = signal('primary')

const Button = styled.button.css`
  px: 4
  py: 2
  bg: $brand
  color: $ink
`

render(root, html`
  <${Button} data-tone=${tone} @click=${save}>
    Save
  </${Button}>
`)
```

When rendered through Fábrica component tags, dynamic props backed by Broto signals are reactive. Fábrica owns the effect and cleanup; Cipó only compiles the class list and Fabrica Elements creates the DOM or adapter payload.

## Validation and explainability

Cipó keeps the existing `explain()` and `inspect()` APIs and adds `validateCss()` for fast debug checks on generated CSS:

```ts
const button = sheet.css`
  .button {
    color: red !important
  }
`

const result = validateCss(String(button))
console.log(result.valid)
```

`validateCss()` is not a heavyweight browser parser. It is a linear safety scan for unclosed blocks/functions/comments/strings and duplicated `!important`, useful in tests, generated docs and userscript diagnostics.

## Debugging source CSS

Use `explainCss()` when a helper, token, alias or nested stylesheet behaves unexpectedly:

```ts
const report = explainCss('.card { bg: alpha($brand / 20%) }', 'stylesheet')
console.log(report.transformedCss)
console.log(report.cssText)
console.log(report.validation)
```

## Advanced stylesheet helpers

```ts
const scoped = sheet.css.scoped('.app')`
  .card { px: 4 }
`
```

```ts
const layered = sheet.css.layer('components')`
  .card { color: red }
`
```

For diagnostics:

```ts
const info = explainDetailed('.card { color: red }', 'stylesheet')
const perf = benchmark('color: red', 100, 'atomic')
```

## Runtime token DSL and OKLCH utilities

Cipó runtime can now compile a bounded design-token DSL without a build step. It stays browser-safe: token objects, mixins, simple macro conditions, CSS-variable math and Tailwind-like color utilities are expanded into static CSS text.

```ts
const styleText = sheet.css`
  :root {
    $dock(
      radius: 14px,
      size: (sm: 4px, md: 1rem)
    )

    $$iconWrapSize: 16px
    $$iconSize: $$iconWrapSize - 1px

    $$glass(c: color, b: length) {
      py: *b
      color-amber-245
      bg-*c-235
      x:md { color-accent-420 }
    }
  }

  .card {
    glass(amber, 4)
  }
`
```

Output shape:

```css
:root {
  --cipo-dock-radius: .875rem;
  --cipo-dock-size-sm: .25rem;
  --cipo-dock-size-md: 1rem;
  --cipo-icon-wrap-size: 1rem;
  --cipo-icon-size: calc(var(--cipo-icon-wrap-size) - .0625rem);
}
.card {
  padding-block: calc(var(--cipo-spacing, .25rem) * 4);
  color: oklch(...);
  background: oklch(...);
}
```

Runtime boundaries:

- ✅ token objects and flattened CSS variables
- ✅ derived `$$variable` math via `calc(...)`
- ✅ simple mixins and equality macro blocks
- ✅ `x:*` media/pseudo blocks inside mixins
- ✅ generated OKLCH colors such as `color-amber-245` and `bg-sky-200`
- ❌ loops and massive utility generation remain build-time concerns
- ❌ deep type-checking remains dev/build-time only

Benchmarks are generated with:

```bash
pnpm bench
```

## Custom `@property` support

Cipó now treats the CSS Properties and Values API as a first-class part of the token engine. You can define typed custom properties in stylesheets, from JavaScript, or directly inside theme tokens.

### Declarative `sheet.css`

```ts
const styleText = sheet.css`
  @property $$angle {
    syntax: "<angle>"
    inherits: false
    initial: 0deg
  }

  .knob {
    $$angle: 24deg
    rotate: var(--cipo-angle)
  }
`
```

Output shape:

```css
@property --cipo-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}

.knob {
  --cipo-angle: 24deg;
  rotate: var(--cipo-angle);
}
```

Rules:

- `$$angle` is normalized to `--cipo-angle`.
- `initial` is accepted as an ergonomic alias for `initial-value`.
- `withImportant` never applies to `@property` internals, only normal declarations.
- Duplicate JS registrations are deduped by name and definition signature.
- `validateCss()` checks `@property` name, `syntax`, `inherits` and `initial-value`.

### JS-first registration

```ts
property('angle', {
  syntax: '<angle>',
  inherits: false,
  initial: '0deg',
})

properties({
  progress: { syntax: '<number>', initial: 0 },
  panelOpacity: { syntax: '<number>', inherits: true, initialValue: 0.94 },
})
```

All names below normalize to the same CSS property:

```ts
property('angle', { syntax: '<angle>', initial: '0deg' })
property('$$angle', { syntax: '<angle>', initial: '0deg' })
property('--cipo-angle', { syntax: '<angle>', initial: '0deg' })
```

### Typed theme tokens

```ts
theme({
  knob: {
    angle: typed.angle('0deg', false),
    progress: typed.number(0),
    glow: typed.color('transparent'),
  },
})
```

This injects both the `@property` rules and the token values:

```css
@property --cipo-knob-angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }
:root { --cipo-knob-angle: 0deg; }
```

### Runtime typed declarations

Typed values can also be used directly in the runtime DSL:

```ts
const styleText = sheet.css`
  :root {
    $$panelOpacity: typed("<number>", 0.94)
    $$dockAngle: angle(0deg, false)
    $$glow: color(transparent)
  }
`
```

The declaration keeps the custom property value in the stylesheet and registers the property in the runtime style sheet.

### Typed helpers

```ts
typed('<length>', '1rem')
typed.angle('0deg')
typed.number(0)
typed.length('1rem')
typed.percent('0%')
typed.color('transparent')
typed.time('120ms')
typed.integer(0)
typed.transform('none')
typed.shadow('none')
typed.image('none')
typed.string('ready')
```
