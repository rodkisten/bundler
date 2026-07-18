## Unreleased

### Compiler correctness

- Fixed compiled CSS optimization so only adjacent equivalent rules or adjacent equivalent grouping at-rules are merged. The optimizer never moves selectors across cascade boundaries.
- Replaced regex-only CSS normalization/minification paths with a quote/comment-aware lexical scanner. String contents, escapes, protocol-relative URLs, custom-property payloads, and punctuation inside values remain semantically intact.
- Added explicit at-rule classification for conditional groups, keyframes, declaration blocks, pages, and unknown rules. Keyframe steps such as `from`, `to`, and `50%` are never treated as ordinary selectors or scoped.
- Removed silent compiler fallbacks that returned empty CSS. Static compilation now raises structured `CipoCompileError` diagnostics with filename, location, code, and original cause.
- Added generated-name collision detection and wider deterministic hashes for compiler-owned classes. Collision registries are scoped to the active runtime/compiler session.
- Made compact whole-build class names namespace-aware so independently compiled bundles have a lower collision surface.

### Compiler architecture

- Added isolated `CompilerContext` execution backed by a session-local `RuntimeState`. Compiler configuration, generated CSS, atomic counters, caches, and collision registries no longer mutate or depend on the live application runtime.
- Made CSS configuration application caching runtime-scoped with `WeakMap`, so the same config can be independently applied to a compiler session even when it is already hot in the application runtime.
- Removed all local TypeScript import cycles from the Cipó production graph and added an architecture checker that fails on cycles, unreachable production modules, legacy compiler files, wildcard package exports, or runtime-to-toolchain boundary violations.
- Introduced a build-agnostic `engine/` layer with IR contracts for generated declarations/rules and structural emission for compiler-owned CSS. Runtime and build tooling share the engine without making the runtime depend transitively on `compiler/` or Vite.
- Split the compiler into `atomic`, `build`, `inline`, `source`, and `stylesheet` responsibilities and separated stylesheet artifact lifecycle, selector logic, at-rule emission, and formatting.
- Split configuration parsing/planning from runtime application, theme reference resolution from theme mutation, plugin registry state from recipe APIs, and large runtime DSL/value/alias/theme-type modules into cohesive primitives.

### Source compiler and Vite

- Rebuilt JavaScript/TypeScript source analysis on the TypeScript AST and lexical bindings. The compiler now handles aliases, nested templates, shadowed identifiers, type-only imports, and unrelated same-name imports without regex-based JavaScript parsing.
- Made import injection exact by source module, imported symbol, and local binding, including collision-free generated local names.
- Made `configureFromCss(...)` lowering conservative: exact literals are compiled from their own value, while identifier bindings are lowered only when explicitly contracted through `configRuntimeBindings`; unknown runtime configuration stays runtime configuration.
- Replaced whole-chunk `.split().join()` class rewriting with AST-guided JavaScript string-literal rewriting so comments and unrelated template payloads are not modified.
- Added per-build Vite state reset, lazy optional Fábrica compiler loading, package-based runtime helper imports, and transform/render source maps.
- Removed the divergent duplicate Vite implementation from `maquina/`; `@rodkisten/cipo/vite` is now the single integration surface.

### Package boundaries and maintenance

- Split public entrypoints into `@rodkisten/cipo`, `@rodkisten/cipo/browser`, `@rodkisten/cipo/compiler`, `@rodkisten/cipo/vite`, and `@rodkisten/cipo/compiled-runtime`.
- Removed compiler/Vite exports and automatic `window.Cipo` installation from the root runtime entrypoint. Browser-global installation is now explicit through `@rodkisten/cipo/browser`.
- Removed wildcard package subpath exports and workspace wildcard path aliases so internal filenames are no longer accidental public API.
- Consolidated the small `*-safety` patch modules into a shared lexical safety layer and removed deprecated/unused compiler wrappers and compatibility shims.
- Added strict unused-local/unused-parameter/fallthrough checks to the Cipó TypeScript project and a `check:architecture` CI gate.
- Added enterprise regression tests for cascade preservation, lexical CSS safety, optimizer idempotence, keyframes, compiler determinism/isolation, configuration cache isolation, generated-name collisions, TypeScript AST binding correctness, conservative config lowering, chunk rewriting, Vite lifecycle reset, source maps, and loud diagnostics.

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
