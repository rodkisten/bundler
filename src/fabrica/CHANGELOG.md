# Fábrica Changelog


## Next

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
