# Changelog

## 1.1.0

- Preserved the previous Cipó API.
- Added modular architecture by responsibility.
- Added `configure({ theme })` and `setup()`.
- Added `$token` inference without `$theme` requirement.
- Added `registerAlias`, `registerHelper`, `registerProperty`, `registerVariant` and `recipe`.
- Added runtime JIT cache for CSS and inline CSS.
- Added `inline.css` template/object API.
- Added cascade layers, pretty output and minify mode.
- Added REM conversion by default.
- Added modern helper set for colors, gradients, fluid values and spacing.
- Added aliases for layout, flex, grid, effects, typography and daily utilities.

## 1.1.1

- Fixed the hot helper resolver so nested helpers like `outlineGlow($brand)` and `alpha($brand / 14%)` no longer recurse until the browser freezes.
- Added a bounded iterative helper scanner with manual loops and identifier-aware matching for better mobile Safari performance.
- Added support for standalone `$alias` expansion, so `$glassCard` can resolve registered aliases while `$brand` still resolves theme tokens in values.
- Added raw property escape syntax with `#property: value`, enabling `#box-shadow: outlineGlow($brand)` without alias ambiguity.
- Added `bleed`, `bleedX`, `bleedY` spacing aliases for negative spacing ergonomics.
- Added built-in `glassCard` alias for the `$glassCard` example shape.
- Added regression tests for comments, optional semicolons, helpers, x blocks and alias expansion.

## Styled integration pass

- Added `styled` as a public alias for Cipó's callable styled factory (`cipo`).
- Documented Fábrica component-tag rendering for Cipó styled DOM factories.
- Added integration tests proving styled components can render through Fábrica, receive events and update dynamic signal props.

## Audit hardening pass

- Added `validateCss()` for linear debug validation of generated stylesheets.
- Added regression coverage for duplicate `!important` and unclosed stylesheet structures.
- Documented validation alongside `explain()` and `inspect()`.

## Source diagnostics pass

- Added `explainCss()` to inspect raw Cipó input, transformed CSS, generated CSS text, warnings and validation issues.
- Added tests for stylesheet diagnostics and validation-friendly output.

## Staff-level stylesheet utilities

- Added `sheet.css.scoped(selector)` for scoped stylesheet compilation.
- Added `sheet.css.layer(name)` for cascade layer wrapping.
- Added `sheet.css.debug`, `explainDetailed()`, and `benchmark()`.
- Added focused tests for scoped sheets, layers and diagnostics.

## Runtime DSL

- Added runtime token object flattening: `$dock(radius: 14px)` → `--prefix-dock-radius`.
- Added derived `$$customProperty` math with safe `calc(...)` output.
- Added runtime mixins and simple equality macro blocks for stylesheet mode.
- Added generated OKLCH color utilities: `color-amber-245`, `bg-sky-200`, and interpolated mixin forms such as `bg-*tone-235`.
- Added focused runtime DSL tests and benchmark coverage.

## Custom property engine

- Added first-class CSS Properties and Values API support.
- Added `property(name, definition)` and `properties(map)` JS APIs with deduped runtime injection.
- Added `typed(...)` and typed helpers such as `typed.angle()`, `typed.number()`, `typed.length()`, `typed.percent()` and `typed.color()`.
- Added `@property $$token { ... }` support in `sheet.css`, including `initial` → `initial-value` normalization.
- Added typed theme token integration so `theme({ knob: { angle: typed.angle('0deg') } })` emits both `@property` and token custom properties.
- Added runtime `$$token: typed(...)` declarations that register typed properties and keep stylesheet declarations ergonomic.
- Added `validateCss()` checks for malformed `@property` blocks.
- Added focused custom property unit tests covering stylesheet, JS, theme and runtime DSL usage.

## Smart shorthand expansion pass

- Added declaration-level smart helpers for `h(...)`, `w(...)`, `pos(...)`, `grid-template(...)`, `grid-flow(...)`, `stack(...)`, `cluster(...)`, `center(...)`, `cover(...)`, `sidebar(...)`, `scroll(...)`, `scrollbar(...)`, `snap(...)`, `snap-item(...)`, `overscroll(...)`, `tap(...)`, `select(...)`, `drag(...)`, `focus-ring(...)`, `transition(...)` and `animate(...)`.
- Added border inference aliases `bor`, `bor-x`, `bor-y`, `bor-t`, `bor-r`, `bor-b` and `bor-l`, including implicit `1px solid` output when only a color is supplied.
- Added modern background value support for `image(...)` and expanded `gradient(...)` to include repeating linear, radial and conic gradients.
- Added deterministic OKLCH utility values for `color-{name}-{shade}` and `bg-{name}-{shade}` in normal declarations.
- Added stylesheet wrapper blocks for `supports(...)`, `layer(...)`, `container(...)`, `x:cq(...)` and `reduce-motion`.
- Added logical property aliases such as `pis`, `pie`, `mis` and `mie`, plus scrollbar and overflow-wrap aliases.
- Added focused Vitest coverage in `cipo.smart-shorthands.test.ts` instead of growing the kitchen sink.


## Modern runtime design features

- Added runtime-safe reactive CSS value helpers: `signal(name)`, `when(dark, truthy, falsy)` and `consume(name)`.
- Added declaration-level context variables through `provide(name: value)`, emitted as prefixed custom properties.
- Added runtime stylesheet variants: `variant(size) { sm { ... } }` compiles to data-attribute and class selectors without requiring new JS APIs.
- Added compound variant blocks: `compound(size: lg, tone: danger) { ... }` for multi-prop styling.
- Added slot styling blocks: `slot(icon) { ... }` targets `[data-slot="icon"]` under the current selector.
- Added `dark { ... }` shorthand for the existing configured dark selector pipeline.
- Added `palette(name, color)` to generate deterministic OKLCH token palettes at runtime.
- Added color-system helper support for `color(amber-245)`, `color(brand/45%)`, `color(brand+12)`, and native `color(display-p3 ...)` preservation.
- Added smart shadow helpers for `shadow(elevation(n))`, `shadow(glow(color))`, `shadow(glass)` and direct `glow(color)`.
- Added focused Vitest coverage in `cipo.modern-runtime-features.test.ts`.

## CSS-first configuration pass

- Added `configure.css` and `setup.css` tagged-template APIs for Tailwind-like CSS-first configuration.
- Added `configureFromCss()`, `setupFromCss()` and `configSheet()` string APIs that share the same parser.
- Added `@cipo`, `@theme`, `@tokens`, `@breakpoints`, `@alias`, `@helper`, `@property`, `@layer`, `@preset` and `@plugin` directives.
- Added `registerPreset()` for reusable CSS-first presets backed by CSS strings, config objects or functions.
- Added `registerConfigPlugin()` with a small plugin API for registering aliases, themes, custom properties and raw CSS.
- Added focused Vitest coverage for CSS-first config, presets, plugins, breakpoints, aliases and typed custom properties.

## Typed theme schema and compiler safety pass

- Added CSS-first semantic annotations such as `radius<length>` and `shadow<shadow>`.
- Added inherited group typing so one annotation validates every scalar leaf in a nested token map.
- Added `strict`, `warn` and `off` theme validation modes plus deferred browser-value handling for `var()`, `env()` and `attr()`.
- Added native-compatible type metadata and selective automatic `@property` generation with safe syntax and initial values.
- Added semantic-only validators for shadows, easing functions, borders, transitions, fonts and z-index values without emitting invalid browser registrations.
- Added `typedTheme()`, `typedProperty()`, `defineThemeType()`, `getThemeType()`, `listThemeTypes()` and `validateThemeValue()` APIs.
- Added annotation options for registration, inheritance, initial values and per-token validation overrides.
- Fixed CSS-first object parsing so comma-separated font stacks and transition lists remain intact inside typed maps.
- Moved slash protection, compact-block normalization, selector-list safety and native property guards into the primary compiler entry points.
- Added a large typed-theme application stylesheet covering complex selectors, nested states, containers, media queries, dialogs, tables, forms, dashboards and design-system utilities.

## Performance observatory integration

- Unified Cipó's Vitest benchmark-mode output with the root branch baseline and PR comparison reporter.
- Persisted warm and cold compiler measurements in `bench/cipo.json` for commit-to-commit regression tracking.

## Named Fabrica registry integration

- Added named styled syntax through `styled.button('Button').css``...```, direct `styled.button('Button')``...``` invocation and `component(name, options)`.
- Enabled automatic registration of explicitly named Cipó components in an available Fabrica registry while keeping anonymous styled factories unchanged.
- Added polling-free delayed-load queuing for Cipó-before-Fabrica bundle order.
- Added explicit `connectFabrica`, `disconnectFabrica`, `configureFabricaRegistry`, `flushFabricaRegistry` and `pendingFabricaComponents` exports.
- Added component metadata, polymorphic `as`, attrs resolvers, collision policies, focused integration tests and benchmark cases.
