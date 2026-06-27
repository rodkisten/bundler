# Changelog

## Unreleased - Fabrica instances and portable components

### Added

- Added named reusable Fabrica instances through `Fabrica.getOrCreate(key)` and fully isolated instances through `Fabrica.create()`.
- Added shared, snapshot, copy-on-write fork and isolated component registry modes.
- Added portable `defineComponent()` definitions, `instance.use()`, component packs, namespaces and instance-aware component context helpers.
- Added `Cipo.createStyled({ fabrica })` for instance-scoped named styled components.
- Added regression tests and benchmark coverage for instance-local named rendering, shared registry lookup, component-pack installation, forked lookup, preferred named-component registration and realm-wide instance reuse.
- Added the `⚡ Performance Observatory` branch workflow, which creates missing baselines, commits updated root `bench/` snapshots and maintains one visual PR comparison comment.

### Deprecated

- Deprecated explicit `registerComponent(name, component)`, registry `registerComponent()` and implicit function-name component registration. All remain operational with one deduplicated migration warning.

### Performance

- Kept the normal registry resolution path to one local `Map.get()`; fork registries add at most one parent lookup.
- Shared registries reuse component functions and global template compilation caches instead of cloning definitions or compiler state.


## Unreleased - readable atomic names and polymorphic styled artifacts

### Added

- Added deterministic, declaration-shaped Cipó atomic class names in debug mode, including optional breakpoint/pseudo/context labels, configurable truncation and privacy redaction.
- Added polymorphic styled inputs for Cipó/Fabrica Elements: precompiled `css` artifacts, nested arrays, conditional branches and prop-driven resolver functions.
- Added artifact-kind routing so atomic results merge classes, inline results compose into `style`, and stylesheet results inject once.
- Added focused unit coverage and benchmark cases for compact/readable atomic naming and styled artifact rendering/composition.

### Changed

- Cipó keeps compact `prefix-a-hash` classes outside debug mode while debug labels retain the same stable rule hash instead of introducing random UUIDs.
- The Performance Observatory now tracks readable-name overhead and artifact-driven styled rendering in the committed Cipó/Fabrica benchmark baselines.

## Unreleased - named styled registry bridge

### Added

- Added enterprise-grade named styled component registration across Cipó, Fabrica Elements and Fabrica without introducing a runtime import cycle.
- Added load-order-safe pending registration, explicit registry connection APIs, collision policies, component metadata, attrs resolvers and polymorphic `as`.
- Added normal `Fabrica.html` support for registered uppercase component tags while preserving the ordinary-template fast path.
- Added focused registry/integration tests and manual `document.createElement` benchmark cases for named rendering and registration overhead.

### Changed

- Fabrica installation now publishes a shared registry-ready handshake used by independently bundled tools.
- Styled factory HTML tag properties are strongly typed and anonymous styled APIs remain backwards compatible.

## Unreleased - Performance observatory

### Added

- Added a Vitest/Tinybench Fabrica kitchen-sink benchmark matrix covering static rendering, complex interpolations, nested components, reactive updates, conditional components, spread props/events, keyed and virtual lists, portals, raw HTML and two-way bindings.
- Added equivalent manual `document.createElement` baselines and a framework-neutral adapter contract for future React, Preact, Solid or other comparisons.
- Added normalized root-level benchmark snapshots in `bench/cipo.json` and `bench/fabrica.json`, plus visual Markdown comparison reports.
- Added a branch-push GitHub Actions workflow that refreshes benchmark baselines, commits them to the PR branch, uploads artifacts and maintains a single emoji-rich PR performance comment.

### Changed

- Unified Cipó and Fabrica benchmark execution behind `pnpm bench` / `pnpm bench:ci`.
- Browser bundle builds now publish committed benchmark JSON and Markdown files as pipeline documentation instead of rerunning benchmarks inside the build command.


## 1.0.0

- Added root-entry multi-build pipeline.
- Added IIFE normal and minified output for each root source file.
- Added ESM normal and minified output for each root source file.
- Added generated landing page with fancy typography, gradients, syntax highlighting, and tool metadata cards.
- Added GitHub Actions workflow using Node 24 and pnpm 11.5.1.
- Added optional Gist publishing.
- Added JSX/TSX support through esbuild.

## Unreleased

### Added

- Added focused Fabrica component-render tests for self-closing interpolated tags, camelCase prop preservation, React-like boolean component branches, and reactive conditional mounting.

- Refactored the real Cipó compiler implementation into focused modules for detection, atomic compilation, stylesheet compilation, inline compilation, declaration expansion, selector/context wrapping, at-rule collection and important handling.
- Added focused unit tests for every new Cipó compiler module so the extracted implementation is covered independently from the kitchen sink tests.

- Refactored Fabrica DOM internals into specialized directive and spread modules, with focused unit coverage for each extraction.
- Refactored Cipó polymorphic `css` mode detection into a dedicated scanner module with isolated unit tests.

- Broto deep-store branch nodes are now callable, so `store.plugins.filters()` and any nested object branch return a tracked plain snapshot while `peek()`/`snapshot()` stay non-tracked.
- Added `draft(mutator, meta?)` as an alias for `update()` and exported `createDeepStore` as an explicit alias for `store()`.

- Broto store now supports batched `patch(partial | updater)`, `update(mutator)`, root `set(nextState)`, `setPath(path, value)`, `peek()`, `toJSON()` and `subscribe(listener)` with patch metadata/cause diagnostics.
- Broto store tests now cover deep merge patches, sibling signal preservation, draft updates, root replacement, dynamic path writes and subscriber events.

- Added Cipó native CSS function registry and `registerNativeFunction()` so platform functions like `max()`, `env()`, `light-dark()`, gradients, filters, transforms, shape functions and future browser functions are preserved instead of being treated as custom helpers.
- Added Cipó tests covering modern CSS functions, nested native functions, multiline declaration values, theme token resolution inside native functions and future native function registration.

- Added Fabrica `html.jsx` micro-JSX syntax for uppercase registered components without Babel or a virtual DOM.
- Added Fabrica component registry APIs and explicit `<f-component name="...">` fallback composition.
- Added missing component fallback UI so unresolved micro-JSX tags fail visibly and safely.
- Re-exposed Broto signal/effect/computed/batch/resource primitives through `window.Fabrica` for userscript ergonomics.

- Fabrica now includes configurable signal equality and scheduler configuration for microtask, animation-frame, and idle flushing.
- Added effect flush loop protection to fail loudly on recursive signal write loops instead of silently locking the page.
- Added `virtualRepeat()` for viewport-windowed keyed rendering of large lists.
- Added `html.sanitized()`, `html.trusted()`, and `html.unsafe()` alongside `html.raw()`.
- The generated landing page now extracts `@example` blocks from every source file under each tool package, not just root entry files.

### Changed

- Fabrica template attributes now compile all interpolations in a quoted or unquoted value as one binding. Compound DOM attributes and component props preserve prefixes, separators and suffixes while exact single-value props remain raw.
- Fabrica component tags now ignore whitespace/comment-only child ranges, preventing phantom `DocumentFragment` children and `[object DocumentFragment]` text in nested button APIs.

- Fabrica now normalizes self-closing interpolated component placeholders before browser parsing, preserves dynamic prop spelling, omits empty `children` fragments, and renders bare component references as zero-prop component requests.

- `src/cipo/src/compiler.ts` is now a compatibility barrel over `src/cipo/src/compiler/*`; existing imports keep working while the implementation lives in smaller production modules.
- `src/cipo/src/inline.ts` now delegates inline compilation to `compiler/inline-compile.ts`, reducing duplicated compiler responsibilities.

- Broto object branches now share the same callable mental model as primitive signal leaves, reducing `is not a function` errors in deeply nested UI stores.

- Broto root `set(nextState)` now performs a true replacement: missing root and nested keys are removed while existing compatible signal/store nodes are reused where possible.
- Broto store mutations are batched by default to avoid effect storms during deep patches and settings imports.

- Cipó declaration parsing now keeps multiline property values together, preventing warning storms and invalid CSS when authoring safe-area styles such as `right: max(0.5rem, env(...))`.
- Cipó helper resolution now only executes registered custom helpers and explicitly skips registered native CSS functions, keeping the hot path linear and avoiding recursive parsing traps.

- `render()` now keeps a persistent root part per container and reconciles future renders instead of always calling `replaceChildren()`.
- Delegated events now use the element root and `event.composedPath()` so Shadow DOM delegation behaves correctly.
- `classMap()` and `styleMap()` now diff values as well as keys to reduce redundant DOM writes.
- CSS declaration parsing now handles quotes, nested functions, `calc()`, gradients, and optional semicolon edge cases more safely.
- Landing page code blocks now preserve code formatting without forcing long source lines to break badly.

### Security

- Added built-in sanitized HTML entry points and made raw/trusted/unsafe HTML intent clearer.

### Validation

- `npx tsc --noEmit` passed after installing project dependencies.
- `npx vitest run` passed all 274 tests, including focused Fabrica compound-attribute and nested-component regression coverage.
- `npm run build` passed and emitted updated IIFE/ESM bundles plus runtime benchmark output.

## Fabrica Elements bridge

- Added `src/fabrica-elements` as the shared element/component factory layer used by Cipó and Fábrica.
- Added a new root bundle entry: `src/fabrica-elements.ts`, producing `fabrica-elements.*` outputs with the existing build pipeline.
- Refactored Cipó's styled-component-compatible API to delegate DOM/component creation to `fabrica-elements`.
- Added Fábrica `elements` and `defineElement()` exports backed by `fabrica-elements`.
- Preserved existing public APIs: `cipo.div.css`, `cipo(Component).css`, `cipo(element).css`, `Fabrica.html`, `Fabrica.component`, and all current build entrypoints.

## 1.1.0 - Ownership runtime, component boundaries and composition

### Added

- Added Broto owner graph primitives: `createRoot`, `createOwner`, `disposeOwner`, `cleanupOwner`, `getOwner`, `runWithOwner`, `onOwnerCleanup`, and `inspectOwnerGraph`.
- Added Broto context primitives: `createContext`, `provide`, and `useContext`.
- Added scheduler utilities: `scheduleTask()` and `flushSync()`.
- Upgraded `resource()` with AbortController ownership, stale state, `.abort()` and automatic disposal when the current owner is disposed.
- Upgraded Fabrica `component()` so every component creates a Broto ownership boundary.
- Added component-owned lifecycle APIs: `onMount`, `onUnmount`, `onDispose`, owned `resource`, owned `effect`, context `provide/useContext`, and ref cleanup.
- Added Fabrica `boundary()` for synchronous render error recovery.
- Added Fabrica public context helpers: `createContext`, `provide`, `useContext`.
- Added Fabrica Elements composition helpers: `cx`, `createRef`, `composeRefs`, and `childrenToArray`.

### Changed

- Effects are now attached to the current Broto owner and dispose nested effects/resources created during previous runs.
- Components now dispose local effects, resources, refs, lifecycle callbacks and async work when their DOM boundary is removed.
- Fabrica remains focused on HTML/UI while Broto owns reactive lifecycle and scheduling.

### Compatibility

- Existing APIs remain available: `signal`, `effect`, `computed`, `resource`, `component`, `html`, `render`, `mount`, `ref`, `repeat`, `virtualRepeat`, `cipo`, and `css`.
- Existing component factories still work. The new context/lifecycle fields are additive.

## Unreleased - Fabrica UI runtime polish

### Added

- Added `Fabrica.jsx.html` as the preferred micro-JSX template entrypoint for editor syntax highlighting. `Fabrica.html.jsx` remains supported.
- Added `component(name, factory)` for minifier-safe components while keeping `component(factory)` fully compatible.

### Fixed

- Dynamic props on component tags now preserve the raw value instead of being converted into HTML attributes. This enables patterns such as `jsx.html`\`<TabButton plugin=${item} />\`` where `plugin` can be a signal, object, function, node or any render-time value.
- Fixed escaped whitespace in the micro-JSX component-tag compiler.
- Fixed duplicate property binding state declaration in the DOM renderer.

## Audit implementation pass

- Added Broto `inspectGraph()` alias and descendant counts for owner diagnostics.
- Added Broto resource `retry()` and `refreshInterval()` controls.
- Added Fabrica Elements `composeProps`, `composeEvents`, `slot` and `polymorphic` helpers while preserving existing factories.
- Added Cipó `validateCss()` for fast generated CSS diagnostics.
- Added tests covering the new non-breaking audit improvements.

## Staff-level audit implementation pass

- Added Broto runtime diagnostics with `inspectRuntime()`, `flattenOwnerGraph()`, `inspectSignals()`, `inspectEffects()` and `inspectScheduler()`.
- Added owner root tracking and creation timestamps for leak hunting and devtools panels without changing existing owner APIs.
- Added package-level Fabrica lifecycle helpers: `onMount`, `onUnmount`, `onDispose` and `onError`.
- Added renderer-neutral Fabrica Elements `recipeProps()` for Panda-like prop recipes with variants and compound variants.
- Added Cipó `explainCss()` source diagnostics for helper/token/alias/nesting debugging.
- Expanded tests to cover diagnostics, lifecycle, recipe composition and Cipó source explanations.

## Staff-level runtime hardening pass

- Added Broto debug configuration, effect scopes, leak inspection, resource mutation/polling aliases, and tracked store path selection.
- Added Fabrica fine-grained UI helpers without breaking existing APIs: two-way `bind`/`model`, keyed child remounting, explicit event listener options, fragments, child array helpers, slot reads, and memoized view factories.
- Exposed Broto reactive primitives through the Fabrica public API for standalone browser globals and userscripts.
- Added Fabrica Elements composition helpers for recipes, standalone variants, and as-child payloads.
- Added Cipó stylesheet utilities for scoped sheets, cascade layers, sheet debug output, detailed explanations, and compile benchmarks.
- Added feature-focused tests per package instead of expanding the kitchen sink suite.

## Runtime DSL and benchmark pipeline

- Added bounded Cipó runtime token objects with `$name(...)` flattening into prefixed CSS custom properties.
- Added runtime mixins with positional parameters and simple equality macro blocks.
- Added derived CSS-variable math that emits `calc(...)` while preserving browser-native CSS variables.
- Added Tailwind-like generated OKLCH color utilities such as `color-amber-245` and `bg-amber-235`.
- Split Fabrica payload materialization out of the large DOM renderer into `src/fabrica/dom-payload.ts`.
- Added `pnpm bench` and CI benchmark artifacts/summary output.

## Cipó smart shorthands

- Added modern Cipó shorthand helpers for layout, sizing, position, scrolling, snap, interaction, motion, borders, gradients and images.
- Added focused tests for the new runtime-safe shorthand compiler path.


## Cipó modern runtime design features

- Added runtime-safe design-system features selected for Cipó: reactive CSS variable helpers, context variables, variants, compound variants, slots, dark blocks, smart shadows, color system helpers, and OKLCH palette generation.
- Added focused unit coverage for the new runtime features without expanding kitchen-sink tests.

## Cipó CSS-first configuration

- Added CSS-first configuration directives and tests for the Cipó package.
