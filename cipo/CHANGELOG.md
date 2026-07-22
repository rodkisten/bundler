## Unreleased

### Fábrica selector interoperability

- Added Fábrica-compatible state selectors: `:name=value`, bare `:name`, and
  `?boolean` lower to native `data-*` and boolean attribute selectors.
- Preserved native pseudo-classes, pseudo-elements, selector functions, and
  attribute-selector string contents while lowering the new shorthand.
- Added `minw-full` / `min-w-full` and `minh-full` / `min-h-full` built-in
  sizing aliases used by constrained editor surfaces.
- Migrated Máquina token and active-state styling to the shared Fábrica/Cipó
  selector dialect.

### Fábrica runtime boundary and source maps

- Added the runtime-only `@rodkisten/cipo/runtime-inline` entrypoint so Fábrica
  special attributes can compile inline Cipó styles without importing the
  TypeScript/source-compiler graph into browser runtime bundles.
- Added transform-aware source-map generation with multiple column anchors on
  surviving source lines and monotonic mappings for generated lines. The
  previous line-only helper remains available for compatibility.
- Updated the Vite integration to use the transform-aware source-map generator.

## Unreleased
- Added a dedicated interactive Cipó landing page at `dist/cipo/index.html`, wired into the root build pipeline. The playground runs the real published browser runtime, supports live stylesheet and atomic compilation, exposes all built-in helpers through an insertion palette, and applies generated CSS to an interactive preview.
- Added a maximalist forest visual system with intertwined SVG vines, mobile-capped fireflies, responsive layouts, and `prefers-reduced-motion` fallbacks.
- Fixed startup when the callable styled factory already owns the read-only
  `html` tag helper. `cipo.html` remains the styled `<html>` factory, while the
  compatibility template `html` helper stays available as a named export and
  on the browser global API.
- Added order-safe compiled CSS coalescing for adjacent equivalent `@media`, `@supports`, and `@container` blocks, including nested rule-list wrappers such as `@layer` and `@scope`, without moving rules across cascade boundaries.
- Updated Vite integration coverage for Vite 8 native `resolve.tsconfigPaths: true` and removed the obsolete `vite-tsconfig-paths` dependency expectation.

- Changed atomic promotion to a two-use default. Runtime styled components keep first-use declarations scoped and promote reused declaration/context pairs, while CSS-first Vite builds now analyze the complete module graph and can rewrite every participating component.
- Added whole-build atomic stylesheet compilation for CSS-first Vite builds. Static `styled`/Fábrica Elements components now carry class-only compiled artifacts instead of one embedded CSS string per component, and production emits one consolidated stylesheet containing shared atomic classes plus scoped single-use fallbacks.
- Production class naming is now driven by CSS-first configuration: readable/debug builds keep semantic labels, while `debug: false` uses compact `a<hash>` atomic and `s<hash>` scope classes in the global build output. `atomic-min-uses` and `minify` are read from the same `@cipo` sheet.
- Added a factory-local `styled.registry` collector with cached `components`/`artifacts` snapshots and `cssArtifacts` for Cipó. Build-compiled styled components now preserve lightweight `CipoCssArtifact` metadata through compiled style helpers, keeping registry output identical across runtime and production while retaining PURE tree shaking.
- Added compiled runtime configuration payloads: Vite build mode can lower eligible `configureFromCss(config)` calls to `configureCompiledCssConfig()` without shipping raw `@theme` DSL or the parser graph. Runtime presets/plugins safely stay on the parser path.
- Restored canonical `@rodkisten/*` imports in the Cipó Vite adapter and moved workspace path resolution to `vite-tsconfig-paths`; standalone Vite configs now bootstrap through `tsx` plus the native config loader instead of requiring relative `.js` compiler imports.
- Fixed DevTools/Cipó remounts after `reset()` by making the runtime token bridge re-bootstrap idempotently through Cipó's own CSS dedupe, and aligned compact-build tests with production tuple/class-name output.

- Documented and validated the build/runtime split for compiled consumers: CSS-first configuration can remain build-only while production runtimes inject only the resolved token bridge they actually need.
 - Compact production CSS output

### Performance

- Added whole-build declaration reuse analysis so repeated styles are emitted once instead of being duplicated in every styled component CSS string.
- Added `classNameMode: 'compact'` for legacy integrations; CSS-first builds now derive naming from their `@cipo` debug/readability configuration.
- Added conservative compiled CSS minification, leading-zero compaction, safe flat-rule merging, and opt-in private custom-property mangling.
- Marked statically compiled styled factory expressions as `/*#__PURE__*/` so unused styled components can be removed by bundlers.
- Updated the Vite build path to inject a single global compiled sheet and attach only final class lists to styled component artifacts.
- Enabled compact Cipó class names and stronger Rollup/esbuild tree shaking for the DevTools production build.

### Tests

- Added coverage for two-use global atomic promotion, single-use scoped fallback rules, class-only compiled styled artifacts and semantic class-name mode.
- Added coverage for compact class names, pure annotations, minified CSS, and private-only custom-property mangling.

## Unreleased

### Added

- Added `!property: value` declaration priority syntax for Cipó with idempotent important handling.
- Added atomic promotion thresholds via `setup({ atomic: { minUses } })`, keeping single-use declarations scoped and promoting repeated declarations into shared atoms.
- Added configurable generated-selector scoping with `scope: { strategy, selector }`, including low-specificity `:where(...)` support.
- Added debug observability helpers, `getDebugOverlayStats()` and `installDebugOverlay()`, for atom reuse and generated CSS diagnostics.
- Added CSS-first coverage tests for container queries and Tailwind-like utility helpers inside declarations.
- Added Broto store middleware and devtools listener hooks through `store(initial, { middleware, devtools })`, `store.use()` and `store.subscribeDevtools()`.

### Fixed

- Preserved native `container: name / inline-size` values instead of treating the slash as arithmetic.
- Kept Fábrica root `render()` disposer identity stable across direct fragment rerenders.
## Instance-scoped styled registries

- Added `createStyled({ fabrica | registry })` for independent styled factories bound to separate Fabrica instances.
- Styled registry bridges now unwrap `instance.registry` and prefer the modern `register/resolve/unregister` path before legacy component-registry aliases.
- Added integration coverage proving identical styled component names can coexist in isolated Fabrica instances.

# Changelog

## Debug-readable atomic names and polymorphic styled inputs

- Added `debug.enabled`, `debug.readableClassNames`, `debug.maxClassLabelLength` and `debug.includeContext` configuration while preserving boolean `debug` compatibility.
- Atomic class names now use resolved property/value/context labels in debug mode and retain the existing deterministic rule hash for cache and snapshot stability.
- Added URL, data/blob and quoted-content redaction plus bounded label normalization.
- Styled builders now accept polymorphic `css` artifacts, arrays, false/null branches and props resolver functions.
- Added atomic, inline and stylesheet artifact routing through the Fabrica Elements adapter.
- Added focused tests and benchmark coverage for readable labels, compact production labels, redaction and artifact-driven styled components.

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

## Reliable benchmark protocol

- Added same-runner baseline/current comparison, alternating rounds, median aggregation and full runner metadata.
- Persisted the warm/cold benchmark measurements used by CI in `bench/cipo.json`.
- Synthetic `String.raw` controls remain visible but no longer influence Cipó's overall geometric mean.
- Noisy runs are marked unstable using Tinybench RME plus cross-round variation.
