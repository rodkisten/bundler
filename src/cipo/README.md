# Cipó Next 🌿

Cipó Next is a modular semantic CSS runtime based on Rod's previous single-file implementation. It preserves the old API while adding a cleaner DSL, plugin hooks, token inference, inline styles, JIT caching, recipes and modern CSS utilities.

## Preserved API

```ts
configure({ prefix: 'rod' })
theme({ colors: { brand: '#f97316' } })
const card = css`color:red;`
html`<div class="${card}">Hello</div>`
injectGlobal`body{margin:0;}`
getCssText()
reset()
cipo.div.css`px:4;`
cipo(MyComponent).css`color:red;`
window.Cipo
window.RodK
```

## New API direction

Old compatibility remains:

```ts
css`
  @with(bg(red), px(4), rounded(xl));
`
```

Promoted API:

```ts
css`
  glass;
  buttonBase;

  px: 4;
  py: 2;
  bg: $brand;
  color: $ink;
  rounded: $xl;
  shadow: $panel;

  text(size: lg, weight: 800, lh: 1.1, color: $ink);

  x:hover {
    bg: alpha($brand / 18%);
  }

  x:md {
    px: 6;
  }
`
```

## Setup with theme

```ts
setup({
  prefix: 'rod',
  minify: false,
  layers: true,
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

Output includes tokens:

```css
@layer cipo.tokens {
  :root {
    --rod-colors-brand: #f97316;
    --rod-radius-xl: 1.5rem;
  }
}
```

## Token inference

Cipó resolves tokens without `$theme`:

```css
bg: $brand;
color: $ink;
rounded: $xl;
shadow: $panel;
```

Explicit namespaces also work:

```css
bg: $colors.brand;
rounded: $radius.xl;
```

Legacy works too:

```css
bg: $theme.colors.brand;
```

## Property aliases

Input:

```css
px: 4;
py: 2;
gap: 3;
bg: $brand;
rounded: $xl;
```

Output:

```css
padding-inline: calc(var(--rod-spacing, 0.25rem) * 4);
padding-block: calc(var(--rod-spacing, 0.25rem) * 2);
gap: calc(var(--rod-spacing, 0.25rem) * 3);
background: var(--rod-colors-brand);
border-radius: var(--rod-radius-xl);
```

## Standalone aliases

Built-ins include:

```css
hidden;
flex;
grid;
center;
glass;
buttonBase;
focusRing;
interactive;
cardSurface;
truncate;
balance;
pretty;
gpu;
absolute-fill;
screen-safe;
sr-only;
```

Custom alias:

```ts
registerAlias('elevatedPanel', `
  glass;
  rounded: $xl;
  shadow: $panel;
`)
```

Usage:

```ts
css`
  elevatedPanel;
  px: 4;
`
```

## Helpers

Built-ins:

```css
alpha($brand / 20%)
lighten($brand, 10%)
darken($brand, 10%)
saturate($brand, 20%)
desaturate($brand, 20%)
mix($brand, $panel, 50%)
gradient(linear, to right, $brand, $panel)
fluid(1rem, 3rem, 4vw)
spacing(4)
rem(16px)
outlineGlow($brand)
softBorder(alpha($ink / 12%))
```

Custom helper:

```ts
registerHelper('ring', (args, ctx) => {
  return `0 0 0 3px ${ctx.resolveValue(`alpha(${args || '$brand'} / 25%)`)}`
})
```

Usage:

```css
box-shadow: ring($brand);
```

## Responsive and variants

```css
x:md {
  px: 6;
}

x:not(md) {
  display: none;
}

x:dark {
  bg: $panel;
}

x:hover {
  bg: alpha($brand / 18%);
}

x:motion-safe {
  transition: transform 160ms ease;
}
```

Custom variants:

```ts
registerVariant('hocus', ['&:hover', '&:focus-visible'])
```

```css
hocus {
  bg: $brand;
}
```

## Text helper

Input:

```css
text(size: lg, weight: 800, lh: 1.1, color: $ink, decoration: underline, shadow: $panel, wrap: balance);
```

Output:

```css
font-size: var(--rod-text-lg);
font-weight: 800;
line-height: 1.1;
color: var(--rod-colors-ink);
text-decoration-line: underline;
text-shadow: var(--rod-shadow-panel);
text-wrap: balance;
```

## inline.css

```ts
const style = inline.css`
  px: 2;
  py: 1;
  bg: alpha($brand / 16%);
  color: saturate($brand, 20%);
`

String(style)
```

Output:

```css
padding-inline: calc(var(--rod-spacing, 0.25rem) * 2); padding-block: calc(var(--rod-spacing, 0.25rem) * 1); background: color-mix(in oklch, var(--rod-colors-brand) 16%, transparent); color: oklch(from var(--rod-colors-brand) l calc(c + 20%) h);
```

Object input:

```ts
inline.css({ px: 2, bg: '$brand' })
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
    size: {
      sm: 'px:2;py:1;',
      lg: 'px:5;py:3;',
    },
  },
  defaults: { tone: 'primary', size: 'sm' },
})

button({ tone: 'danger', size: 'lg' })
```

## DOM and component APIs

```ts
const el = document.createElement('div')
const styled = cipo(el).css`px:4;bg:$brand;`

const Card = cipo.div.css`glass;px:4;`
const node = Card({ class: 'extra', children: 'Hello' })

const StyledComponent = cipo(MyComponent).css`color:red;`
```

## Shadow/local injection

```ts
const shadow = host.attachShadow({ mode: 'open' })
const styles = css`glass;px:4;`
injectStyle(shadow, styles)
```

## Debug

```ts
const firstClass = String(card).split(' ')[0]
explain(firstClass)
inspect(document.querySelector('.card')!)
getCssText()
```

## Limitations

- The parser is still a small scanner, not a full CSS parser.
- Complex nested `@media`, `@supports`, `@keyframes` are not fully modeled yet.
- Color helpers use modern CSS color functions and need modern browsers.
- Build-time extraction is not implemented yet. Current JIT is runtime-only.
- Hot class merging and DOM usage pruning are future work.

## Next steps

1. Add a real tokenizer with source positions.
2. Add build-time extractor CLI.
3. Add `@container` and named container contexts.
4. Add keyframes/animation registry.
5. Add CSS variable binding helpers for mouse/scroll state.
6. Add source map metadata for generated rules.
7. Add optional static analysis for unused aliases/helpers.

## Commands

```bash
npm run typecheck
npm run build
npm run test
```
