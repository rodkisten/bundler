# Cipó language guide

This document is the language-level reference for Cipó authoring. It covers the
runtime DSL, CSS-first configuration, Fábrica selector interoperability, theme
and token semantics, responsive values, container queries, typography, motion,
and the build/runtime parity guarantees expected from compiler integrations.

Cipó intentionally keeps native CSS valid. Its syntax is additive: a shorthand
should lower to standards-based CSS and must not reinterpret unrelated native
syntax.

## Design principles

The language follows a few rules:

- prefer a small number of deep, composable helpers over many isolated helpers;
- reuse the same parser and normalization layers in runtime and compiled builds;
- preserve native CSS whenever a construct is not unambiguously Cipó syntax;
- keep Fábrica state authoring and Cipó state selection on one vocabulary;
- make design-system tokens distinct from local runtime variables;
- lower ergonomic syntax to portable CSS instead of requiring a browser runtime.

## Variable ownership

Cipó exposes three visibly different variable forms.

### Theme tokens with `$`

Use `$name` or `$namespace.name` for design-system tokens:

```css
color: $foreground
background: $colors.surface
border-radius: $radius.control
```

These references lower to the custom properties registered by the active theme.
Short names resolve when they are unambiguous. Namespaced paths remain explicit.

### Runtime custom properties with `$$`

Use `$$name` for component-local or runtime CSS custom properties:

```css
$$gutterWidth: 48px
width: $$gutterWidth
```

Cipó lowers the declaration and reference through the configured prefix.
Runtime math remains available:

```css
$$iconWrapSize: 16px
$$iconSize: $$iconWrapSize - 1px
```

The second declaration is emitted as custom-property math using `calc(...)`.

### External CSS variables with `var()`

Use native `var()` when the variable is owned outside Cipó:

```css
color: var(--host-foreground)
```

The ownership rule is therefore:

```txt
$token          theme and design-system token
$$name          Cipó runtime or component custom property
var(--external) external CSS contract and escape hatch
```

## Token fallback chains

Token references support ordered fallbacks:

```css
color: $button.foreground ?? $foreground ?? black
```

This lowers to nested CSS custom-property fallbacks. The property context is
used when an unresolved short fallback needs a theme namespace.

The functional form is useful in helper arguments:

```css
border-color: token(button.border, foreground)
```

Both forms reuse the normal theme-reference resolver rather than a separate
fallback engine.

## Derived theme tokens

Theme values may reference other theme tokens and use runtime math:

```ts
Cipo.theme({
  spacing: {
    sm: '8px',
    md: '$spacing.sm * 2',
  },
})
```

The derived token becomes a custom-property expression based on the source
token. The same value normalization rules used by ordinary declarations apply.

## Typed runtime custom properties

The `$$name<type>` shorthand reuses Cipó's existing typed-property registry:

```css
$$progress<number>: 0
$$angle<angle>: 0deg
$$size<length>: 0px
$$tone<color>: transparent
```

A reference stays concise:

```css
opacity: $$progress
```

When supported by the configured runtime, Cipó emits the matching `@property`
registration and the prefixed custom-property declaration.

## Typed theme tokens

CSS-first theme groups may carry a CSS syntax type:

```css
@theme {
  colors<color>: (
    primary: #ff0055,
    surface: #101010
  )

  spacing<length>: (
    sm: 8px,
    md: 16px
  )
}
```

Typed theme values reuse the same property registration and validation path as
programmatic typed tokens.

## Fábrica state selectors

Cipó understands the state vocabulary emitted by Fábrica.

Fábrica markup:

```ts
html`<button :variant="primary" ?disabled=${disabled}>Save</button>`
```

Cipó:

```css
&:variant='primary' {
  bg: $primary
}

&?disabled {
  opacity: 0.5
}
```

The generated selectors are standards-based:

```css
[data-variant="primary"]
[disabled]
```

Whitespace keeps normal selector meaning. This targets a descendant:

```css
& :token='comment' {}
```

This targets the current component:

```css
&:active='true' {}
```

Camel-case names use the same normalization contract as Fábrica:

```css
&:toolTab='console' {}
```

becomes:

```css
[data-tool-tab="console"]
```

Bare non-native state names become data-presence selectors:

```css
&:selected {}
```

becomes:

```css
[data-selected]
```

### Attribute comparison operators

The state dialect supports native attribute comparison semantics:

```css
&:tags~='selected' {}
&:lang^='pt' {}
&:file$='.ts' {}
&:route*='settings' {}
&:kind|='button' {}
```

They lower respectively to `data-tags`, `data-lang`, `data-file`, `data-route`,
and `data-kind` attribute selectors with the same operators.

### Native CSS preservation

Cipó does not rewrite native pseudo syntax:

```css
:hover
:focus-visible
:disabled
:not(...)
:has(...)
:host(...)
::before
::-webkit-details-marker
```

The special Fábrica `:data=${object}` form remains a markup spread and is not a
CSS selector shorthand. Events, refs, `.property`, and `class:*` also remain
outside the selector dialect because they do not represent CSS-observable state.

## `slot()`

Fábrica can expose a semantic slot with a data attribute:

```ts
html`<header :slot="toolbar"></header>`
```

Cipó can target the same contract:

```css
slot(toolbar) {
  flex
  items-center
}
```

The implementation detail remains `[data-slot="toolbar"]`.

## `state()`

Use `state()` when several state conditions belong to one rule:

```css
state(:active, variant=primary, ?enabled) {
  color: $accent
}
```

The conditions are composed on the current selector. Data presence, data values,
boolean attributes, and negation use the same shared state-condition parser.

## `group()` and `peer()`

Relations make ancestor and sibling state explicit without handwritten selector
chains.

Group state:

```css
group(panel, :open) {
  color: $accent
}
```

This expects an ancestor relation marker such as `data-group="panel"` and its
state conditions.

Peer state:

```css
peer(field, ?checked) {
  opacity: 1
}
```

This uses the general-sibling relationship from a peer marked with
`data-peer="field"`.

These helpers only generate selectors. They do not install JavaScript behavior.

## `variant()`

The existing variant DSL remains the concise choice authoring surface:

```css
variant(size) {
  sm {
    text(12px / 1.3 / 500)
  }

  lg {
    text(18px / 1.4 / 600)
  }
}
```

Each choice generates both a `data-*` variant selector and the compatible class
variant selector used by existing Cipó integrations.

## `compound()`

Compound variants accept multiple conditions, value arrays, and negation:

```css
compound(size: [lg, xl], variant: primary) {
  font-weight: 700
}

compound(!size: [sm], variant: danger) {
  opacity: 0.8
}
```

Array inputs expand to the selector product required by every valid combination.
Negation lowers through `:not(...)` rather than inventing runtime state.

## Responsive object values

Properties can express breakpoint values directly:

```css
gap: {
  base: 8px,
  md: 16px,
  lg: 24px
}
```

The base value remains in the current rule. Named breakpoint values reuse Cipó's
existing responsive context and emit the configured media queries.

Deep helpers use the same representation:

```css
text(
  size: {
    base: 14px,
    md: 18px
  },
  lh: 1.4
)
```

This is intentionally a shared language primitive rather than a feature unique
to `text()`.

## `fluid()`

The compact form remains available:

```css
font-size: fluid(14px, 22px)
```

Named ranges can bind interpolation to configured breakpoints:

```css
font-size: fluid(
  min: 14px,
  max: 22px,
  from: sm,
  to: xl
)
```

A custom preferred expression may be supplied when the caller needs direct
control. The helper still lowers to native `clamp(...)` output.

Because `fluid()` is a value helper, it composes with deeper helpers:

```css
text(fluid(14px, 20px) / 1.5)
```

## `text()`

`text()` is Cipó's deep typography helper. The small forms remain intentionally
cheap to type.

### Positional typography

```css
text(16px)
text(16px / 1.5)
text(16px / 1.5 / 600)
```

The positions are font size, line height, and font weight.

Theme tokens and value helpers can participate:

```css
text(
  $fontSizes.sm
  /
  $lineHeights.tight
  /
  $fontWeights.medium
)
```

### Named typography

Use named arguments when the style needs more dimensions:

```css
text(
  size: 14px,
  lh: 1.4,
  weight: 500,
  family: $mono,
  color: $foreground,
  tracking: 0.01em,
  align: left,
  wrap: pretty,
  clamp: 3,
  numeric: tabular,
  ligatures: none
)
```

Supported named concepts include size, line height, weight, family, color,
alignment, decoration, shadow, tracking, case or transform, wrapping, text fill,
ellipsis, line clamp, numeric variants, and ligatures.

### Standalone text modifiers

Common one-word modifiers remain composable:

```css
text(ellipsis)
text(balance)
text(pretty)
text(tabular)
text(slashed-zero)
text(oldstyle)
text(ligatures)
text(no-ligatures)
```

Modifiers can accompany positional typography:

```css
text(14px / 1.4 / 500, ellipsis, tabular)
```

### Typography presets

Theme typography groups can represent complete text roles:

```ts
Cipo.theme({
  text: {
    body: {
      size: '16px',
      lh: 1.5,
      weight: 400,
      family: 'system-ui',
    },
  },
})
```

Use the role directly:

```css
text($body)
```

Nested presets are supported:

```css
text($heading.lg)
```

A lone ordinary token such as `text($brand)` keeps the existing standalone color
behavior unless it resolves to a known typography preset.

## `motion()`

`motion()` expresses transition end state and starting state in one place:

```css
motion(
  opacity: 0 -> 1,
  y: 8px -> 0,
  scale: 0.96 -> 1,
  duration: 200ms,
  easing: ease-out
)
```

The helper emits:

- the final declarations;
- `transition-property` and timing declarations;
- `@starting-style` with the source values;
- a reduced-motion override by default.

`x` and `y` are normalized into native `translate`. Other property names
lower to normal CSS property names.

Optional settings are:

```css
motion(
  opacity: 0 -> 1,
  duration: 180ms,
  easing: ease-out,
  delay: 40ms,
  reduce: false
)
```

Set `reduce: false` only when an application has a separate accessibility
policy.

### Motion presets

Built-in presets keep frequent entrance motions terse:

```css
motion($enter)
motion($fade-in)
motion($pop)
motion($slide-up)
```

Presets are expanded through the same motion parser, so the generated CSS
follows identical reduced-motion and starting-style rules.

## Starting styles

`starting-style { ... }` is also a first-class Cipó rule context. It lowers to
native `@starting-style` and participates in atomic identity, stylesheet output,
and compiled builds.

## Container definitions

A named container can be declared with the runtime DSL:

```css
container(card) {
  inline-size
}
```

This emits the matching container name and type declarations.

Accepted container types are `inline-size`, `size`, and `normal`.

## Container queries

Existing breakpoint-aware container queries remain available:

```css
x:cq(card >= md) {
  grid
}
```

Literal bounds can be expressed explicitly:

```css
x:container(card, min: 400px, max: 900px) {
  gap: 2
}
```

Named breakpoint comparisons reuse the configured breakpoint map. Literal length
values pass through the same value normalization policy as the rest of Cipó.

## Named theme scopes

Programmatic theme scopes isolate a token set under a selector:

```ts
Cipo.themeScope('dark', {
  colors: {
    surface: '#111',
  },
})
```

The default selector is:

```css
[data-theme="dark"]
```

A custom selector is supported for Shadow DOM or embedded surfaces:

```ts
Cipo.themeScope(
  'editor',
  {
    colors: {
      surface: '#101010',
    },
  },
  {
    selector: ':host([data-editor-theme])',
  },
)
```

## Theme inheritance

Named themes can extend previously registered scopes:

```ts
Cipo.themeScope('dark', {
  colors: {
    foreground: '#eee',
    surface: '#111',
  },
})

Cipo.themeScope(
  'amoled',
  {
    colors: {
      surface: '#000',
    },
  },
  {
    extends: 'dark',
  },
)
```

Parent tokens are merged eagerly. The child scope is self-contained and does
not require the parent selector to exist in the DOM. Extending an unknown
parent emits a structured Cipó warning.

Tooling can inspect a registered scope with `getThemeScope(name)`.

## CSS-first theme scopes

The same model is available in configuration CSS:

```css
@theme(dark) {
  colors: (
    foreground: #eee,
    surface: #111
  )
}

@theme(amoled extends dark) {
  colors: (
    surface: #000
  )
}
```

Build integrations can lower these directives to parser-free compiled config
payloads. Production does not need to ship the CSS-first config parser merely to
install already compiled theme scopes.

## Runtime and compiled parity

Every language primitive in this guide is expected to preserve behavior across:

```txt
runtime sheet/atomic authoring
        ↓
runtime DSL normalization
        ↓
Cipó compiler
        ↓
Vite whole-build compilation
        ↓
standards-based CSS output
```

Compiler integrations may move work to build time. They must not change
selector semantics, token ownership, responsive behavior, motion accessibility,
or Fábrica state contracts.

The test suite includes direct runtime tests, focused parser tests, compiled
styled component coverage, CSS-first compiled-config coverage, and Vite
integration tests.

## Native CSS escape hatch

Cipó syntax is optional. Native CSS remains the escape hatch whenever it is
clearer or when the platform already has the exact primitive required:

```css
grid-template-columns: minmax(0, 1fr) auto
color: var(--host-color)
@supports (display: grid) {}
:hover {}
```

The language should make common intent shorter without making ordinary CSS
harder to recognize.
