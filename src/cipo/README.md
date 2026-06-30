# Cipó Next 🌿

Cipó is the CSS owner in the Rod browser toolbox. It provides a semantic CSS DSL, atomic class generation, full stylesheet compilation, inline style compilation, JIT caching, theme tokens, helpers, aliases, recipes and browser-friendly debug tools.

Cipó does **not** own HTML rendering. Fábrica owns reactivity/templates. `fabrica-elements` owns element/component factories. Cipó consumes that bridge for `cipo.div.css``...`` ` and `cipo(Component).css``...`` `.


## Internal compiler layout

The runtime compiler is split by responsibility so feature work does not keep inflating the main public entry file:

- `css.ts` owns public APIs and artifact creation.
- `css-mode.ts` owns the tiny top-level scanner that routes polymorphic `css` calls to inline, configure, atomic, or stylesheet mode.
- `runtime-dsl.ts` owns runtime-safe design-language expansion such as token objects, mixins, palettes and smart helpers.

The mode scanner is intentionally string-first and bounded. It does not parse declarations or selectors; it only peeks at top-level directives so `Cipo.css` remains fast enough to be the universal entry point.

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


## Smart modern shorthands

Cipó ships a runtime-safe shorthand layer for the things you write constantly in UI code. These helpers compile to plain CSS declarations and are available in `css`, `atomic.css`, `sheet.css`, `inline.css`, aliases and recipes.

### Size and position helpers

Input:

```ts
const card = atomic.css`
  h(contain, min: 240px, max: 70vh)
  w(fill, min: 320px, max: 960px)
  pos(fixed, top: 0, right: 0)
`
```

Output shape:

```css
height: auto;
min-height: 15rem;
max-height: 70vh;
width: 100%;
min-width: 20rem;
max-width: 60rem;
position: fixed;
top: 0;
right: 0;
```

### Grid, layout and composition helpers

Input:

```ts
const layout = atomic.css`
  grid-template(cols: 220px minmax(0, 1fr), rows: auto minmax(0, 1fr))
  grid-flow(row dense)
  stack(gap: 3)
  cluster(gap: 2, justify: space-between)
  center(max: 720px, px: 16px, text: center)
  cover(header: auto, main: minmax(0, 1fr), footer: auto)
  sidebar(side: right, width: 280px, gap: 16px)
`
```

Output shape:

```css
grid-template-columns: 13.75rem minmax(0, 1fr);
grid-template-rows: auto minmax(0, 1fr);
grid-auto-flow: row dense;
display: flex;
flex-direction: column;
flex-wrap: wrap;
justify-content: space-between;
box-sizing: content-box;
margin-inline: auto;
max-width: 45rem;
padding-inline: 1rem;
text-align: center;
```

### Text, word-breaking and borders

Input:

```ts
const textCard = atomic.css`
  text(nowrap)
  break(anywhere)
  bor: red
  bor-x: 2px dashed color-amber-245
`
```

Output shape:

```css
white-space: nowrap;
overflow-wrap: anywhere;
border: 1px solid red;
border-inline: 0.125rem dashed oklch(...);
```

`bor`, `bor-x`, `bor-y`, `bor-t`, `bor-r`, `bor-b` and `bor-l` infer `solid` and `1px` when they are omitted.

### Background helpers

Input:

```ts
const hero = atomic.css`
  bg: gradient(repeating-linear, 90deg, red, blue)
  background-image: image(https://example.com/panel.png)
  color: color-amber-245
`
```

Output shape:

```css
background: repeating-linear-gradient(90deg, red, blue);
background-image: url("https://example.com/panel.png");
color: oklch(...);
```

The generated `color-{name}-{shade}` and `bg-{name}-{shade}` utilities are deterministic OKLCH colors. Unknown color families are assigned a stable hue by hashing the name.

### Scroll, snap, interaction and motion

Input:

```ts
const scroller = atomic.css`
  scroll(smooth)
  scrollbar(thin)
  snap(x, mandatory)
  snap-item(start)
  overscroll(contain)
  tap(none)
  select(none)
  drag(none)
  focus-ring($brand)
  transition(colors, transform)
  animate(fade-in)
`
```

Output shape:

```css
scroll-behavior: smooth;
scrollbar-width: thin;
scroll-snap-type: x mandatory;
scroll-snap-align: start;
overscroll-behavior: contain;
touch-action: none;
user-select: none;
-webkit-user-drag: none;
outline: 2px solid var(--...);
transition: color 160ms ease, background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
animation: fade-in 180ms ease-out both;
```

### Modern stylesheet wrappers

`sheet.css` supports runtime wrapper blocks that compile to native CSS wrappers while preserving the current selector.

Input:

```ts
const styleText = sheet.css`
  .card {
    color: red

    supports(backdrop-filter: blur(1px)) {
      backdrop-filter: blur(18px)
    }

    layer(components) {
      bg: blue
    }

    x:cq(md) {
      grid-template(cols: 1fr 1fr)
    }

    reduce-motion {
      transition: none
    }
  }
`
```

Output shape:

```css
.card { color: red; }
@supports (backdrop-filter: blur(0.0625rem)) { .card { backdrop-filter: blur(1.125rem); } }
@layer components { .card { background: blue; } }
@container md { .card { grid-template-columns: 1fr 1fr; } }
@media (prefers-reduced-motion: reduce) { .card { transition: none; } }
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

### Semantic typed theme schema

CSS-first themes can declare a Cipó semantic type directly on a scalar token or
on an entire nested group. A group annotation is inherited by every scalar leaf.

```ts
configureCss`
  @cipo {
    theme-validation: warn;
    register-typed-theme-properties: true;
  }

  @theme {
    spacing<size>: 0.25rem;

    radius<length>: (
      sm: 6px,
      md: 14px,
      modal: 24px,
      pill: 999px
    );

    shadow<shadow>: (
      panel: 0 28px 90px rgb(0 0 0 / 0.72),
      modal: 0 32px 120px rgb(0 0 0 / 0.78)
    );
  }
`
```

`<length>` and `<size>` validate every value and automatically emit native
`@property` registrations because they map safely to browser syntax. `<shadow>`
is a richer semantic Cipó type: it validates each shadow layer, but does not emit
an invalid fictional `syntax: "<shadow>"` registration.

```css
@property --cipo-radius-md {
  syntax: "<length>";
  inherits: true;
  initial-value: 0px;
}

:root {
  --cipo-radius-md: 0.875rem;
  --cipo-shadow-panel: 0 1.75rem 5.625rem rgb(0 0 0 / 0.72);
}
```

Annotation options are optional and comma-separated:

```css
radius<length, no-register>: (sm: 6px, md: 14px);
progress<number, register, inherits:false, initial:0>: 0.72;
legacy<any, validation:off>: proprietary-value;
```

Validation modes:

- `strict` throws and fails the build/config application.
- `warn` reports a structured warning and preserves the original token value.
- `off` keeps the schema metadata but skips validation.
- `var()`, `env()` and `attr()` values are marked as deferred because the browser
  owns their final computed value.

Built-in native-compatible types include `length`, `size`, `spacing`,
`length-percentage`, `percentage`, `number`, `integer`, `angle`, `time`,
`resolution`, `color`, `transform`, `image`, `gradient`, `url` and
`custom-ident`. Semantic-only validators include `shadow`, `easing`, `border`,
`transition`, `font`, `z-index`, `string` and `any`.

JS-first themes use the same registry and validation pipeline:

```ts
theme({
  radius: typedTheme('length', { sm: '6px', md: '14px' }),
  elevation: typedTheme('shadow', {
    panel: '0 28px 90px rgb(0 0 0 / 0.72)',
  }),
})

typedProperty('dockOffset', 'length', '12px', { inherits: false })
```

Custom semantic types can reuse existing validators:

```ts
defineThemeType('positive-length', {
  cssSyntax: '<length>',
  registrable: true,
  initialValue: '0px',
  validate(value) {
    const base = validateThemeValue('length', value)
    if (base.status !== 'valid') return { ...base, type: 'positive-length' }
    return value.trim().startsWith('-')
      ? {
          status: 'invalid',
          valid: false,
          type: 'positive-length',
          value,
          code: 'positive-length-negative',
          reason: 'Negative lengths are not allowed.',
        }
      : { status: 'valid', valid: true, type: 'positive-length', value }
  },
})
```

The CSS-first object parser preserves comma-separated CSS values, so font stacks,
transition lists, gradients and multi-layer shadows can live inside typed maps
without being mistaken for sibling token entries.

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

## Modern runtime design features

Cipó now includes a browser-safe design-system layer that stays string-first, bounded and cache-friendly. These features run in the runtime compiler and generate static CSS, so they are safe for userscripts, Shadow DOM styling and interactive tooling.

### Reactive CSS values

Use `signal(name)` when a value should be controlled by a CSS custom property instead of forcing a DOM rerender.

```ts
Cipo.sheet.css`
  .card {
    bg: signal(theme.cardBg)
  }
`
```

Output shape:

```css
.card {
  background: var(--cipo-signal-theme-card-bg);
}
```

`when(dark, truthy, falsy)` compiles to `light-dark(...)`, while other names compile to a fallback custom property.

```ts
Cipo.sheet.css`
  .card {
    color: when(dark, color(amber-245), color(sky-200))
  }
`
```

### Context variables

Use `provide(name: value)` to expose a local custom property and `consume(name)` to read it in descendants.

```ts
Cipo.sheet.css`
  .card {
    provide(cardColor: sky-240)

    .icon {
      color: consume(cardColor)
    }
  }
`
```

Output shape:

```css
.card { --cipo-context-card-color: sky-240; }
.card .icon { color: var(--cipo-context-card-color); }
```

### Variants

Variants generate both data-attribute selectors and class selectors, so components can choose either DOM API.

```ts
Cipo.sheet.css`
  .button {
    variant(size) {
      sm { px: 2 }
      lg { px: 6 }
    }
  }
`
```

Output shape:

```css
.button[data-size="sm"], .button.size-sm { ... }
.button[data-size="lg"], .button.size-lg { ... }
```

### Compound variants

```ts
Cipo.sheet.css`
  .button {
    compound(size: lg, tone: danger) {
      shadow: glow(red-300)
    }
  }
`
```

Output shape:

```css
.button[data-size="lg"][data-tone="danger"], .button.size-lg.tone-danger { ... }
```

### Slots

```ts
Cipo.sheet.css`
  .card {
    slot(header) {
      pb: 2
    }
  }
`
```

Output shape:

```css
.card [data-slot="header"] { padding-bottom: ...; }
```

### Dark blocks

`dark { ... }` is a shorthand for the configured dark selector.

```ts
Cipo.sheet.css`
  .card {
    bg: white

    dark {
      bg: color(zinc-900)
    }
  }
`
```

### Color system helper

`color(...)` is a Cipó color-system helper unless it is using native CSS color spaces such as `display-p3`.

```ts
Cipo.sheet.css`
  .card {
    color: color(brand/45%)
    border-color: color(brand+12)
    bg: color(amber-245)
  }
`
```

Supported forms:

```css
color(amber-245)
color(amber, 245)
color(brand/45%)
color(brand+12)
color(display-p3 1 0.5 0)
```

### Palette generation

`palette(name, source)` generates deterministic OKLCH custom properties for common shades.

```ts
Cipo.sheet.css`
  :root {
    palette(brand, amber)
  }
`
```

Output shape:

```css
:root {
  --cipo-brand-50: oklch(...);
  --cipo-brand-100: oklch(...);
  --cipo-brand-200: oklch(...);
  --cipo-brand-300: oklch(...);
  --cipo-brand-400: oklch(...);
  --cipo-brand-500: oklch(...);
  --cipo-brand-600: oklch(...);
  --cipo-brand-700: oklch(...);
  --cipo-brand-800: oklch(...);
  --cipo-brand-900: oklch(...);
  --cipo-brand-950: oklch(...);
}
```

### Smart shadows

```ts
Cipo.sheet.css`
  .card {
    shadow: elevation(4)
    box-shadow: glow(sky-240)
  }
`
```

Supported forms:

```css
shadow(elevation(4))
shadow(glow(sky-240))
shadow(glass)
glow(sky-240)
```

## CSS-first configuration

Cipó can now be configured from CSS, similar in spirit to Tailwind's CSS-first setup, while still lowering everything into the existing runtime APIs. This means `setup({ ... })` keeps working, and `configure.css` simply becomes a more readable authoring layer.

```ts
Cipo.configure.css`
  @cipo {
    prefix: rod;
    layers: true;
    color-mode: oklch;
    rem: 16px;
  }

  @theme {
    colors: (
      brand: #f97316,
      ink: #f8fafc,
      panel: #0f172a
    );

    spacing: 0.25rem;

    radius: (
      md: 12px,
      xl: 24px
    );
  }

  @breakpoints {
    sm: 640px;
    md: 768px;
    lg: 1024px;
  }

  @alias glassCard {
    bg: alpha($colors.panel / 72%)
    border: 1px solid alpha($colors.ink / 12%)
    backdrop-filter: blur(18px)
  }

  @property $$angle {
    syntax: "<angle>";
    inherits: false;
    initial: 0deg;
  }
`;
```

### Supported CSS-first directives

| Directive | Purpose |
|---|---|
| `@cipo { ... }` | Runtime config such as `prefix`, `layers`, `important`, `debug`, `minify`, `color-mode`, `rem`, `dark-selector` and `theme-root`. |
| `@theme { ... }` | Registers nested theme tokens and injects CSS custom properties. |
| `@tokens { ... }` | Alias for `@theme`, useful when thinking in design-token language. |
| `@breakpoints { ... }` | Registers responsive breakpoints. Plain lengths become `(min-width: value)`. Full media queries are preserved. |
| `@alias name { ... }` | Registers a declaration macro usable as `name` inside `sheet.css`, `atomic.css` and `inline.css`. |
| `@helper name { ... }` | CSS-only helper alias. JS value helpers still use `registerHelper()`. |
| `@property $$name { ... }` | Registers a typed custom property through the CSS Properties and Values API. |
| `@layer tokens, base, components;` | Emits a cascade layer order declaration. |
| `@preset name;` | Applies a registered CSS-first preset. |
| `@plugin name;` | Runs a registered config plugin hook. |

### Presets

```ts
Cipo.registerPreset('forest', `
  @cipo { prefix: leaf; layers: true; }

  @theme {
    colors: (brand: #22c55e, ink: #ecfccb);
  }
`);

Cipo.configure.css`
  @preset forest;
`;
```

Presets may be CSS strings, functions returning CSS, or regular `CipoConfig` objects:

```ts
Cipo.registerPreset('quiet', { debug: false, minify: true });
```

### Plugins

Config plugins receive a tiny safe API that delegates to existing Cipó primitives.

```ts
Cipo.registerConfigPlugin('forms', api => {
  api.theme({ colors: { field: '#e5e7eb' } });
  api.alias('fieldBase', `
    border: 1px solid $colors.field
    px: 3
    py: 2
  `);
  api.property('focusOpacity', { syntax: '<number>', initial: 0 });
});

Cipo.configure.css`
  @plugin forms;
`;
```

### Alternate entry points

All of these use the same engine:

```ts
Cipo.configure.css`@cipo { prefix: rod; }`;
Cipo.setup.css`@theme { colors: (brand: #f97316); }`;
Cipo.setupFromCss('@breakpoints { md: 768px; }');
Cipo.configSheet('@tokens { spacing: 0.25rem; }');
```

### Merge order

Configuration is applied in call order. A later `configure.css` call can override earlier `setup(...)` values, and a later `setup(...)` call can override CSS-first values. Theme tokens merge deeply, so small incremental config sheets are cheap and predictable.

## Performance baselines

Cipó benchmark output is stored in `bench/cipo.json` together with complete
runner metadata, repeated-round measurements and the baseline/current source
commits:

```bash
pnpm bench:cipo
```

The branch workflow runs baseline and current on the same GitHub runner,
alternates order across three rounds and aggregates by median. Warm-cache,
cold-compile and class-name cases remain separate groups. The synthetic
`String.raw` control is shown in the report but excluded from Cipó's package-wide
geometric mean.

A result is labeled faster or slower only when it exceeds the larger of the
minimum 3% threshold, combined Tinybench RME and cross-round variation.
Excessively noisy measurements are marked unstable and should be rerun.

## Named Cipó components registered in Fabrica

Cipó's styled factory now auto-registers components that have an explicit name
when a Fabrica registry exists. Anonymous styled components keep the existing
behavior and are never registered implicitly.

```ts
import { styled } from '../cipo'
import { html, render } from '../fabrica'

const Button = styled.button('Button').css`
  inline-flex
  items-center
  px: 4
  py: 2
  bg: $brand
`

render(root, html`
  <Button type="button" onClick=${save}>Save</Button>
`)
```

The normal `html` entrypoint performs a tiny static-chunk scan and only enables
registered uppercase component parsing when it sees `<Uppercase...>`. Ordinary
HTML templates remain on the original fast path. `jsx.html` remains fully
supported.

A shorter direct style form is also supported:

```ts
const Badge = styled.span('StatusBadge')`
  px: 2
  rounded: 999px
`
```

### `Cipo.component()` facade

```ts
import { component } from '../cipo'

const Card = component('SettingsCard', {
  as: 'article',
  attrs: (props) => ({
    role: 'region',
    'aria-label': props.label,
  }),
}).css`
  grid
  p: 4
`
```

The same facade is available as `Cipo.component()` in the browser global.

### Loading order and explicit connection

Cipó can load before Fabrica. Named components are stored in a small pending Map
and flushed when Fabrica installs, without intervals or DOM observers.

```ts
import {
  connectFabrica,
  configureFabricaRegistry,
  pendingFabricaComponents,
} from '../cipo'

configureFabricaRegistry({ collision: 'replace' })
connectFabrica(Fabrica)
console.log(pendingFabricaComponents())
```

Named styled components expose `className`, `artifact`, `displayName`, `tag`,
`registeredName`, `register()`, `unregister()` and `withComponent()`.

## Debug-readable deterministic atomic classes

Readable names can be enabled through the backwards-compatible `debug` option:

```ts
setup({
  prefix: 'app',
  debug: {
    enabled: true,
    readableClassNames: true,
    maxClassLabelLength: 72,
    includeContext: true,
  },
})

css`
  background-attachment: fixed;
  x:md:hover { color: $brand; }
`
```

Typical output:

```txt
app-background-attachment-fixed-k3x9q7
app-md-hover-color-var-app-colors-brand-p8w2z1
```

The final segment is the existing deterministic atomic-rule hash, not a random
UUID. The readable prefix is diagnostic decoration, while the hash remains the
canonical identity for cache reuse and deduplication. `debug: false` keeps the
compact production format `app-a-k3x9q7`.

Safety rules applied to readable labels:

- URL, `data:` and `blob:` payloads are replaced by neutral labels;
- quoted user content is not copied into class names;
- labels are normalized to lowercase class-safe segments;
- oversized values are truncated while the stable hash is retained;
- breakpoint, pseudo, dark, supports, container and layer contexts can be
  included or disabled with `includeContext`.

## Styled builders consuming polymorphic `css` results

The styled bridge accepts precompiled polymorphic artifacts in addition to the
existing tagged-template syntax:

```ts
const brandCss = css`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`

const Brand = styled.div('Brand')(brandCss)
```

Supported inputs are recursive and composable:

```ts
const base = css`display:inline-flex; align-items:center;`
const rounded = css`border-radius:999px;`

const Action = styled.button('Action')((props) => [
  base,
  rounded,
  props.danger && css`color:$danger;`,
  props.disabled && inline.css`opacity:.5; cursor:not-allowed;`,
])
```

The resolver dispatches artifacts by kind:

| Artifact | Styled behavior |
| --- | --- |
| `cipo.css` | merges generated atomic/scope classes |
| `cipo.inline-css` | composes the declaration text into `style` |
| `cipo.stylesheet` | injects the stylesheet once |
| arrays/functions | resolves recursively with the current props |
| `false`, `null`, `undefined` | skips the branch |

Static artifacts are exposed through `component.artifact` and
`component.artifacts`. Components with prop-dependent inputs expose
`component.dynamicStyles === true`. Registration, `attrs`, polymorphic `as`,
`withComponent()`, collision policies and delayed Fabrica connection continue to
use the same named-component lifecycle.

## Instance-scoped styled factories

When an application uses more than one Fabrica instance, create one Cipó styled
factory per registry instead of reconnecting the global `styled` bridge:

```ts
const shell = Fabrica.getOrCreate('@rod/alerta')
const sandbox = Fabrica.create({ name: 'sandbox' })

const shellStyled = Cipo.createStyled({ fabrica: shell })
const sandboxStyled = Cipo.createStyled({ fabrica: sandbox })

const ShellButton = shellStyled.button('Button')`
  inline-flex
  px: 3
`

const SandboxButton = sandboxStyled.button('Button')`
  grid
  place-items: center
`
```

`createStyled()` keeps its own tag cache, pending-registration queue and registry
bridge while sharing Cipó's compiler and atomic CSS caches. Named components are
registered through the new `registry.register()` fast path, so Fabrica's legacy
`registerComponent()` deprecation warning is not triggered.

## 🌿 Enterprise CSS authoring

### Bang important declarations

Any declaration can be marked important by placing `!` before the property name:

```ts
const button = css`
  !bg: $brand
  !px: 4
  color: $ink
`
```

Cipó normalizes this after token/helper resolution, so scaled values still compile correctly and existing `!important` markers are not duplicated.

### Atomic promotion by reuse

Set a promotion threshold when you want one-off declarations to stay local and repeated declarations to become shared atoms:

```ts
setup({
  atomic: { minUses: 2 },
})
```

The first use compiles into the component scope class. When the same declaration/context is seen again, Cipó promotes it into the shared atomic rule cache. This keeps generated class lists quieter in small components while preserving dedupe for real reuse.

### Global selector scope

Use scope to isolate generated selectors:

```ts
setup({
  scope: { strategy: 'where', selector: '.my-app' },
})
```

Strategies are `none`, `where`, `class`, `id`, `selector` and `host`. The recommended default for apps and userscripts is `where` because `:where(...)` does not add specificity.

### Container queries

Container declarations are preserved as native CSS while query variants stay in Cipó syntax:

```ts
sheet.css`
  .card {
    container: card / inline-size

    x:cq(md) {
      grid-template(cols: 1fr 1fr)
    }
  }
`
```

### Tailwind-style utilities, CSS-first

Cipó keeps the ergonomics of modern utility systems but places them inside CSS declarations:

```ts
sheet.css`
  .utility {
    sr-only
    not-sr-only
    bg: color-sky-240
    text(nowrap)
    break(anywhere)
    ring: glow
    space-y: 2
  }
`
```

### Debug observatory

```ts
const stats = getDebugOverlayStats()
installDebugOverlay(document)
```

The stats object reports total atoms, inserted rules, promoted atoms, single-use fallbacks, reused atoms and generated CSS bytes.

