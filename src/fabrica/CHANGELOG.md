# Fábrica Changelog


## Unreleased - Runtime v2 root and attribute instruction pass

### Performance

- Added a direct root-render fast path for materialized `DocumentFragment` values. `render(host, html`...`)` now mounts the compiled fragment directly on fresh or previously-direct roots instead of routing through the generic `ChildPart` range controller. Disposal still walks the mounted tree, runs registered cleanups and clears the host.
- Added static attribute/property/boolean/class fast paths. Non-reactive bindings now write directly without allocating an update closure, previous-value sentinel or effect wrapper. Reactive bindings keep the existing fine-grained effect path.
- Specialized `class` and `style` string writes to `className` and `style.cssText` for hot complex-attribute templates. Directive-based `classMap()` and `styleMap()` continue to use their diffing helpers.
- Added component child presence metadata at template compile time so component invocation avoids cloning and scanning empty slots. Static props can now be reused directly for slotless components.

### Documentation

- Documented the Runtime v2 root-render fast path, static binding instructions and remaining compatibility boundary around `html()` returning real `DocumentFragment` objects.

## Unreleased - forked registry and repeat hot-path repair

### Fixed

- Restored the forked registry fast path after the first Runtime v2 cache pass made inherited lookups pay the combined parent-version cost on every resolution.
- Split registry lookup caching into local/shared and inherited/forked paths so local component hits remain one `Map.get()` while inherited hits and misses are cached against the parent epoch.

### Performance

- Batched large keyed repeat reshuffles through one `DocumentFragment` move when the LIS shows that most ranges changed position. This keeps the public `repeat()` API unchanged while reducing DOM mutation storms for reversals, table sorts and drag-reorder style workloads.
- Kept the existing LIS path for small shuffles, append-only updates and mostly-stable lists so ordinary keyed updates still avoid unnecessary full-range moves.

### Documentation

- Documented the separated registry cache paths and the batched keyed-repeat fallback in the Fabrica README.


## Next - Runtime v2 execution plan

- Added a precompiled component dynamic-prop plan. Attributes and spreads that belong to component placeholders are now detected during template compilation, marked as component-owned parts, and passed directly to the component binder. The hot render path no longer builds a component path `Set`, no longer allocates a prop `Map`, and no longer reclassifies placeholder attributes every render.
- Added a registry L1 lookup cache for repeated named component resolution. Local registry hits, inherited hits and misses now remember the last normalized name together with the registry version, while all mutation APIs still invalidate the cache safely.
- Replaced the generic keyed repeat reorder pass with an LIS-based diff. Stable rows stay in place, new rows are inserted once, stale rows are removed once, and only non-LIS ranges are moved. This targets the keyed-list and virtual-list benchmarks without changing `repeat()` or `virtualRepeat()` APIs.
- Added per-record visual order metadata used by the keyed diff, append-only strategy and indexed strategy.
- Kept the public `html`, `jsx.html`, `render`, `repeat`, component registry and directive APIs unchanged.
- Documented the Runtime v2 performance model, including which work is now compile-time and which architectural targets remain future-safe without breaking the current DocumentFragment-returning API.

## Next - Runtime turbo pass

- Added a compiled component slot plan. Component placeholders now precompile their captured child parts, ordered child parts and static props during template compilation instead of recompiling and rereading attributes on every render.
- Skipped lifecycle microtask scheduling for components that do not register `onMount()`, removing one queued job from the common stateless component path.
- Added bounded trusted raw HTML template caching so repeated `rawHtml()` payloads clone cached template content instead of reparsing the same string each render.
- Added an inherited-registry lookup cache that only participates when a lookup misses the local registry and needs a parent registry. Local component resolution keeps the original one-`Map.get()` hot path.
- Added realm-local instance map caching for `getOrCreateFabrica()` so repeated named instance reuse avoids repeated symbol/global property lookups.
- Preserved all public APIs and existing component, directive, registry and render semantics.
- Verified with `tsc --noEmit`, the full Vitest suite, Fabrica-focused tests and the docs build in the local sandbox.

## Next - Instance registries and portable components

- Added `Fabrica.create()`, `Fabrica.getOrCreate()`, `Fabrica.createRegistry()` and instance-bound `html`, `render`, `mount`, `hydrate` and `component` APIs.
- Added live shared registries, isolated registries, snapshots and copy-on-write fork registries with a one-`Map.get()` common resolution path.
- Added `defineComponent()` for portable unregistered definitions, `instance.use()` for components/packs, and `createComponentPack()` with namespaces and include/exclude filters.
- Added component context access to `ctx.html`, `ctx.jsx`, `ctx.component`, `ctx.registry`, `ctx.instance` and the stable component name.
- Deprecated explicit `registerComponent(name, component)`, registry `registerComponent()` and implicit `component(function Name(){})` registration. Compatibility behavior remains and warnings are deduplicated per realm.
- Captured Fabrica runtime context inside reactive child parts and component-tag effects so delayed updates keep resolving against the instance that mounted them.
- Added instance, shared-registry, fork, pack, portability and deprecation tests plus benchmark cases for hot registry resolution and instance-local named rendering.



## Next

- Optimized component-name normalization and inherited-definition registration on hot registry paths, with cycle-safe parent graphs and zero duplicate overlay entries for identical inherited definitions.
- Fixed compound attribute interpolation on DOM and component tags. Values such as `class="${base} ${tone}"` and `title="Open ${label}"` now retain every static and dynamic segment instead of dropping later values or leaking internal marker text into the DOM.
- Component placeholders now distinguish exact raw props from compound string props, preserving objects, functions, signals, nodes and icon fragments only when the whole prop is a single interpolation.
- Marker-only and whitespace-only component bodies no longer become phantom `DocumentFragment` children, preventing self-closing and false conditional branches from leaking fragments into label/title fallbacks.
- Added focused template-compiler and nested toolbar-render tests covering reactive compound attributes, raw props, self-closing component boundaries, conditional children and marker leakage.

- Fixed self-closing interpolated component tags with props, so `<${Button} label=${label} />` emits an explicit template boundary instead of swallowing following siblings.
- Preserved author-provided camelCase dynamic component prop names such as `onClick`, `onPointerDown`, `selectedElement`, and `showCodePanel` through HTML template parsing.
- Self-closing components now receive `children: undefined` instead of an empty `DocumentFragment`; paired component tags still receive their real fragment children.
- Added React-like boolean rendering for component requests and bare component references: `${condition && Panel({ ...props })}` and `${condition && Panel}`.
- Added focused renderer tests covering consecutive toolbar components, ternary component fragments, reactive boolean branches, prop casing, events, and child semantics.

- Split DOM directive controllers into `dom-directives.ts` and spread prop diffing into `dom-spread.ts` to reduce `dom.ts` hot-spot complexity without changing public APIs.
- Added focused unit tests for directive controllers and spread prop diffing.
- Added template spread props syntax for DOM and component placeholder nodes: `html`<button ...${props}>Save</button>``.
- Added component event prop normalization so `<${Button} @click=${save}>` reaches the component as `props.onClick`.
- Fixed delegated events so root-level delegation no longer double-fires when a direct fallback is also needed for jsdom or isolated userscript worlds.
- Added kitchen-sink tests covering component event props, spread props and stale spread event listener cleanup.
- Added `html.jsx` micro-JSX syntax for registered string component tags: `html.jsx`<Dock />``.
- Added component registry APIs: `registerComponent`, `unregisterComponent`, `resolveComponent`, `listComponents`, and `clearComponents`.
- Added explicit parser-safe component fallback tag support with `<f-component name="Dock">...</f-component>`.
- Added missing-component fallback rendering as `<fabrica-component-error>` instead of silently stringifying or dropping unknown components.
- Added self-closing support for interpolation component tags: `html`<${Button} />``.
- Re-exposed Broto runtime primitives on the public Fabrica API: `signal`, `effect`, `computed`, `memo`, `batch`, `untrack`, `resource`, `configureScheduler`, `flushSync`, and `scheduleTask`.

- Added official component tag composition: `html`<${Button}>Save</${Button}>``.
- Changed `component()` to return lazy component render requests so context is captured at mount time.
- Added component materialization with ownership boundaries, lifecycle cleanup and child propagation.
- Added component placeholder compilation through `<template data-fabrica-component>`.
- Added dynamic child support inside component tags.
- Added Broto owner error propagation and boundary integration for effects, resources and lifecycle callbacks.
- Upgraded Broto resources with reactive source support, cache keys, retries, timeouts and owner error propagation.
- Added owner-scoped child part effects so fine-grained bindings can be disposed by DOM range lifecycle.

- Extracted reactivity ownership into Broto.
- Kept Fábrica focused on HTML, rendering, directives, DOM parts, components and hydration-oriented UI.
- Updated internal imports to consume Broto for renderer bindings and component context ergonomics.
- Removed public signal/effect/computed/batch exports from Fábrica's singleton API.

## 1.1.0

- Added component ownership boundaries powered by Broto.
- Added owned effects, resources, cleanup stack, mount/unmount lifecycle, context and refs.
- Added `boundary()` for render error recovery.
- Added public context helpers: `createContext`, `provide`, `useContext`.

## Unreleased

### Added

- Added the preferred `jsx.html` micro-JSX namespace for syntax highlighting friendly component templates while preserving `html.jsx` as a compatibility alias.
- Added `component(name, factory)` as a minifier-safe component definition form. The existing `component(factory)` API is unchanged.

### Fixed

- Fixed micro-JSX closing/self-closing component tag regex escaping so compiled bundles keep `\s` matching instead of degrading to literal `s`.
- Fixed dynamic component props in micro-JSX/component placeholders so values like `<TabButton plugin=${item} />` reach the component as the original runtime value instead of stringifying to `[object Object]`.
- Fixed a duplicated local declaration in property binding.

## Integration pass

- Added reactive component-tag invocation for dynamic props and spreads. Component tags such as `<${Button} tone=${tone}>` now re-run the component or styled factory when Broto signals used as props change.
- Improved adapter payload materialization with `attrs` and `dataset` support so Fabrica Elements payload output renders through Fábrica without losing data attributes.
- Added kitchen-sink coverage for Fabrica Elements payloads and Cipó styled components rendered through Fábrica component tags.

## Audit hardening pass

- Added integration coverage for Broto owner diagnostics and Fabrica Elements composition helpers.
- Documented non-breaking composition diagnostics for package-level audits.

## Staff-level composition helpers

- Added `bind`/`model` for two-way form bindings.
- Added `eventOptions` for explicit `addEventListener` options.
- Added `keyed`, `fragment`, `childrenToArray`, `slot`, and `memoView` helpers.
- Re-exported Broto primitives from the Fabrica package and browser API.
- Added focused feature tests for directives and event options.

## Unreleased - benchmark observatory

### Added

- Added a Vitest benchmark-mode kitchen sink with manual `document.createElement` baselines for twelve major rendering paths.
- Added a framework-neutral benchmark adapter contract with stable case identifiers for future renderer comparisons.
- Added branch-level JSON baselines and Markdown performance reports through the root benchmark pipeline.

## Named styled registry bridge

### Added

- Fabrica installation now announces registry readiness to independently bundled Fabrica Elements/Cipó styled factories.
- Normal `html`` ` automatically recognizes registered uppercase component tags through a bounded static-chunk scan; `jsx.html` remains available.
- Added integration tests for named Cipó styled components rendered by registry name without passing the function.

### Performance

- Added manual-versus-Fabrica benchmark cases for named styled registry rendering and styled component registration/unregistration.

## Reliable benchmark protocol

- Added same-runner baseline/current comparison with alternating order, median aggregation and per-row cross-round variation.
- Fabrica performance scoring now normalizes each adapter against its paired manual control and excludes controls from the overall score.
- Added fixture integrity coverage and semantically closer manual keyed/virtual list controls.
