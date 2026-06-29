# Fábrica

Fábrica is the HTML/UI runtime of the Rod browser ecosystem. It owns template parsing, DOM parts, rendering, directives, components, lifecycle hooks, composition and hydration-oriented UI work.

Reactivity lives in **Broto**. Fábrica consumes Broto internally and accepts Broto signals in render values, but state primitives are not owned by Fábrica.

## Package boundaries

```txt
Broto
 ├── signal
 ├── computed
 ├── effect
 ├── batch
 ├── store
 ├── graph
 ├── scheduler
 ├── async
 └── resources

Fabrica
 ├── html
 ├── template parser
 ├── renderer
 ├── directives
 ├── DOM parts
 ├── components
 ├── component tags
 ├── context
 ├── lifecycle
 ├── error boundaries
 └── hydration
```

## Runtime performance model

Fábrica now uses a more aggressive compiled runtime plan while keeping the public API stable. The main rule is simple: work that can be discovered once during template compilation should not be repeated during render.

### What is compiled once

- Template DOM shape and dynamic part paths.
- Component placeholder metadata.
- Static component props.
- Captured component children parts.
- Ordered child part plans for component slots.

This means component tags such as the following keep their ergonomic API while avoiding repeated slot compilation on every render:

```ts
const Button = component("Button", (props, ctx) => ctx.html`
  <button class=${props.className}>${props.children}</button>
`);

render(root, html`
  <${Button} className="primary">
    Save
  </${Button}>
`);
```

### Hot paths optimized

- Fresh root renders of `DocumentFragment` values mount directly instead of paying for a generic child range controller.
- Direct root renders collect cleanup owners during materialization, so disposal runs exact listener/effect cleanups instead of recursively walking static descendants. Fully static fragments skip cleanup collection and dispose with a plain host clear.
- Static attribute, property, boolean and conditional class bindings write directly without allocating effect/update closures.
- String `class` and `style` bindings use `className` and `style.cssText` for the browser's fastest common path.
- Slotless component tags reuse static props directly and skip child-fragment cloning.
- Stateless components no longer schedule an empty mount microtask.
- Repeated `rawHtml()` strings use a bounded template cache and clone trusted content.
- Inherited registry lookups are cached behind the local registry fast path.
- `getOrCreateFabrica()` keeps a realm-local map reference for repeated named instance reuse.

The goal is not to change how authors write Fábrica. The goal is to make the engine do less work after the template has already told us what the page looks like.



### Direct root cleanup collector

`html` still returns a real `DocumentFragment`, but the fragment now carries private metadata when it was created by the Fabrica compiler. That metadata records whether the fragment has dynamic work and which nodes actually own cleanup callbacks. The direct root renderer uses that list on disposal:

```txt
static template   -> replaceChildren() only
dynamic template  -> dispose collected cleanup nodes, then clear host
legacy value      -> fallback tree walk
```

This keeps event listeners, effects and owners safe while avoiding a full DOM traversal for large static shells, docs pages and benchmark cases that mount and immediately dispose.

### Lazy repeat context signals

`repeat()` continues to pass `item`, `index` and `key` as signal-shaped callables. Internally those signals are now lazy. If a row template never reads `index()` or `key()`, reorders update only the stored primitive value and do not allocate or notify unused Broto signals. This is especially useful for keyed table/list updates where most rows depend only on `item()`.

## Runtime v2 execution plan

Fabrica's public API still returns real `DocumentFragment` values from `html` and `jsx.html`. That compatibility is intentional: userscripts, DOM bags, adapters and test fixtures can continue appending or inspecting fragments directly. Runtime v2 therefore focuses on removing repeated work that can be removed without changing that contract.

### Compile-time work

The template compiler now owns more of the hot-path planning:

- Component placeholders know their static props.
- Component placeholders know their dynamic prop parts.
- Dynamic component attributes and spreads are marked as component-owned parts, so normal DOM binding skips them directly.
- Component children are compiled once into ordered child-part plans.
- Part ordering is stored on the compiled template, so render never sorts parts.

This turns component tags from a runtime discovery problem into a precompiled execution problem. A template like this:

```ts
html`
  <${Button}
    className="action action-${tone}"
    @click=${save}
    ...${buttonProps}
  >
    ${label}
  </${Button}>
`;
```

compiles a component prop plan equivalent to:

```txt
component Button
  static props: none
  dynamic props:
    className -> compound attribute value
    onClick -> raw event function
    spread -> raw object merge
  children:
    ordered child parts
```

The render pass no longer builds a `Set` of component paths or a `Map` of prop parts to rediscover this relationship.

### Registry hot path

Named component lookups now have separate hot paths for shared and forked registries:

1. Local/shared registries use a one-entry L1 cache and otherwise fall through to a single local `Map.get()`.
2. Forked registries check the local map first and cache inherited hits and misses against the parent registry epoch.
3. The public `version` getter still reflects parent changes, but `resolve()` no longer recomputes the combined version for every local lookup.

Every mutation invalidates the local and inherited caches by bumping the registry version. Forked and shared registries keep copy-on-write behavior, but hot lookups avoid the previous parent-version bookkeeping regression that made inherited registries slower than the manual `own.get(name) ?? parent.get(name)` control.

### Keyed repeat diff

`repeat()` keeps the same API, but the default keyed strategy now uses a Longest Increasing Subsequence pass. The algorithm keeps the longest already-correct visual subsequence in place and moves only the ranges that actually need to move. When the LIS says most rows moved, such as full reversals and table sorts, Fábrica switches to a single `DocumentFragment` range reorder so the browser receives one batched insertion instead of dozens of tiny moves.

That matters for real UI patterns:

- table sorting
- drag reorder
- filter restoration
- virtual windows
- timeline insertion

The dedicated `append-only` and `indexed` strategies remain available for workloads that can skip keyed reordering entirely.

### What remains intentionally API-compatible

The current API returns materialized `DocumentFragment` objects. A more radical Lit-style lazy `TemplateResult` would allow even more update reuse, but it would change observable behavior for code that expects `html``...`` instanceof DocumentFragment`. Runtime v2 therefore keeps compatibility and targets the biggest safe wins first: component planning, registry caching, raw HTML caching, ordered parts and minimal keyed moves.


### Root render fast path

`html()` still returns a real `DocumentFragment`, but `render()` now recognizes that common shape:

```ts
const dispose = render(root, html`<section>${title}</section>`);
```

On a fresh root, Fábrica mounts the fragment directly. That avoids creating an extra render marker, a `ChildPart`, two range markers and one generic value classification pass. The returned dispose function still calls `disposeTree(root)` before clearing the container, so events, owners and reactive effects installed inside the fragment are released.

Repeated renders into the same root remain compatible. If the root was previously mounted through the direct path and receives another fragment, the old tree is disposed and the new fragment is installed directly. If the root receives a directive, primitive, array or other dynamic value, Fábrica falls back to the stable `ChildPart` reconciliation path.

### Static binding instructions

The renderer now splits static and reactive bindings before creating an effect. Static bindings are the majority case in benchmark fixtures and generated documentation pages:

```ts
html`<button class="button-${tone}" .disabled=${false}>Save</button>`
```

For values that are not Broto signals/functions, Fábrica writes the DOM immediately:

- `class` -> `element.className`
- `style` -> `HTMLElement.style.cssText`
- `.property` -> direct property assignment
- `?boolean` -> direct set/remove
- normal attributes -> `setAttribute()`

Reactive values keep the previous owned-effect model, including previous-value guards and `classMap()` / `styleMap()` diff state.

## Basic fine-grained rendering

Input:

```ts
import { signal } from "../broto";
import { html, render } from "../fabrica";

const count = signal(0);

render(
  document.body,
  html`
    <button @click=${() => count.update((value) => value + 1)}>
      Count: ${count}
    </button>
  `,
);
```

Output:

```html
<button>Count: 0</button>
```

When `count.set(1)` runs, only the text node is updated.

## Component direct composition

Input:

```ts
const Button = component("Button", function Button(props) {
  return html`
    <button type=${props.type ?? "button"} class=${props.class}>
      ${props.children}
    </button>
  `;
});

render(
  document.body,
  html`${Button({ class: "primary", children: "Save" })}`,
);
```

Output:

```html
<button type="button" class="primary">Save</button>
```

## Component tag composition

Component tags are now enabled. The template compiler turns component tags into hidden template placeholders and passes their content as `props.children`.

Input:

```ts
render(
  document.body,
  html`
    <${Button} class="primary" type="submit">
      Save
    </${Button}>
  `,
);
```

Output:

```html
<button type="submit" class="primary">Save</button>
```

Self-closing interpolated component tags support any number of static and dynamic props without nesting or swallowing following siblings:

```ts
render(document.body, html`
  <nav>
    <${ToolbarButton} icon=${refreshIcon} label="Refresh" onClick=${refresh} />
    <${ToolbarButton} icon=${pickerIcon} label="Pick" onClick=${startPicker} />
  </nav>
`);
```

Dynamic component prop spelling is preserved exactly, including camelCase names such as `onClick`, `onPointerDown`, `selectedElement`, and `showCodePanel`. A self-closing component receives no `children` prop; paired tags receive a `DocumentFragment` containing their actual children.

Compound attributes and component props can contain multiple interpolations. Fabrica compiles them as one reactive binding, preserving all static text between values:

```ts
const tone = signal("neutral");
const label = signal("Elements");

render(document.body, html`
  <button
    class="ra-button ra-button-${tone}"
    title="Open ${label} panel"
  >
    ${label}
  </button>
`);
```

For component tags, exact single-interpolation props remain raw. Objects, event functions, signals and renderable icon fragments are therefore passed by identity instead of being stringified. Compound props are intentionally composed as strings:

```ts
html`
  <${ToolbarButton}
    icon=${refreshIcon}
    label="Refresh"
    className="ra-button ra-button-${tone}"
  />
`;
```

Whitespace, internal boundary comments and false conditional children do not create a `children` prop. This prevents phantom `DocumentFragment` values from reaching button labels, titles or ARIA fallbacks.

## React-like conditional component rendering

Falsy booleans and nullish values render nothing, so component requests can use the familiar boolean-and form without a full ternary:

```ts
render(document.body, html`
  ${showDetails && DetailsPanel({ selected })}
  ${showEmptyPanel && EmptyPanel}
`);
```

Reactive conditions use a function so Broto can track the read and mount or dispose the component range automatically:

```ts
const open = signal(false);

render(document.body, html`
  ${() => open() && CodePanel({ selected, zen: true })}
`);

open.set(true);
```

Ternaries remain valid, including branches that return nested templates with self-closing component tags:

```ts
html`${codeZen ? html`<${CodePanel} selected=${selected} zen=${true} />` : ""}`;
```

## Component events and spread props

Component event attributes are normalized to `onX` props before the component factory runs. This keeps component authoring ergonomic while preserving Fabrica's DOM event syntax.

Input:

```ts
const Button = component("Button", function Button({ children, ...props }) {
  return html`<button ...${props}>${children}</button>`;
});

render(
  document.body,
  html`
    <${Button} @click=${save} title="Save item">
      Save
    </${Button}>
  `,
);
```

Runtime props received by `Button`:

```ts
{
  onClick: save,
  title: "Save item",
  children: DocumentFragment
}
```

Output:

```html
<button title="Save item">Save</button>
```

DOM spread syntax is supported on real elements too. Spread props support `class`, `className`, `style`, `attrs`, `dataset`, `ref`, `on`, `onClick`, normal DOM properties and plain attributes. Reactive spread objects are diffed, so stale event listeners are removed instead of stacking duplicates.

Input:

```ts
const props = signal({
  class: "primary",
  onClick: save,
  dataset: { action: "save" },
});

render(document.body, html`<button ...${props}>Save</button>`);

props.set({
  class: "danger",
  onClick: remove,
});
```

Output after update:

```html
<button class="danger">Save</button>
```

## Micro-JSX string component tags

`html.jsx` enables uppercase component tags inside template strings without Babel, TSX, or a virtual DOM. Components are resolved from the current Fabrica instance registry. The primary API is explicit and minifier-safe:

Input:

```ts
const Dock = component("Dock", (props, ctx) => {
  return ctx.html`<button type="button">${props.label}</button>`;
});

render(
  document.body,
  html.jsx`
    <Dock label="Open" />
  `,
);
```

Output:

```html
<button type="button">Open</button>
```

Dynamic props work through normal Fabrica attribute parts:

```ts
const label = signal("Open");

render(document.body, html.jsx`<Dock label=${label} />`);
label.set("Close");
```

For fully parser-safe templates, use the explicit fallback element:

```ts
render(document.body, html.jsx`
  <f-component name="Dock" label="Open" />
`);
```

If a component cannot be resolved, Fabrica renders a visible error element instead of stringifying the component function:

```html
<fabrica-component-error data-fabrica-error="missing-component">
  [Fabrica] Missing component: MissingDock
</fabrica-component-error>
```

Portable aliases use `defineComponent()` plus `instance.use()`:

```ts
const TinyDock = defineComponent("TinyDock", (_props, ctx) => {
  return ctx.html`<button>Dock</button>`;
});

const app = Fabrica.create({ name: "docs" });
app.use(TinyDock);
app.render(document.body, app.html`<TinyDock />`);
```

> ⚠️ `registerComponent(name, component)` and implicit
> `component(function Name(){})` registration are deprecated compatibility
> paths. They still work and emit one migration warning per realm. Prefer
> `component("Name", factory)`, `defineComponent()` plus `instance.use()`, or
> `instance.registry.register()`.

## Dynamic children inside component tags

Input:

```ts
const label = signal("Save");

render(
  document.body,
  html`
    <${Button} class="primary">
      ${label}
    </${Button}>
  `,
);

label.set("Saved");
```

Output before update:

```html
<button class="primary">Save</button>
```

Output after update:

```html
<button class="primary">Saved</button>
```

## Component lifecycle

Input:

```ts
const Clock = component("Clock", function Clock(_props, ctx) {
  const now = ctx.signal(Date.now());

  ctx.onMount(() => {
    const id = setInterval(() => now.set(Date.now()), 1000);
    return () => clearInterval(id);
  });

  ctx.onUnmount(() => console.log("clock removed"));

  return html`<time>${now}</time>`;
});
```

Output:

```html
<time>1710000000000</time>
```

When the component range is removed, interval cleanup and unmount cleanup run.

## Owned resources

Input:

```ts
const Profile = component("Profile", function Profile(props, ctx) {
  const profile = ctx.resource(
    (abort, id) => fetch(`/users/${id}`, { signal: abort }).then((response) => response.json()),
    { source: () => props.id, cacheKey: (id) => `user:${id}`, retries: 1 },
  );

  return html`${() => {
    const state = profile();
    if (state.loading) return "Loading";
    if (state.error) return "Failed";
    return state.value?.name;
  }}`;
});
```

Output while loading:

```html
Loading
```

Output after success:

```html
Rod
```

When the component unmounts, the request is aborted.

## Context

Input:

```ts
const Theme = createContext("dark", "Theme");

const Provider = component("Provider", function Provider(props, ctx) {
  ctx.provide(Theme, "forest");
  return html`${props.children}`;
});

const Consumer = component("Consumer", function Consumer(_props, ctx) {
  const theme = ctx.useContext(Theme);
  return html`<p>${theme}</p>`;
});

render(document.body, html`
  <${Provider}>
    <${Consumer}></${Consumer}>
  </${Provider}>
`);
```

Output:

```html
<p>forest</p>
```

## Error boundary

Input:

```ts
const Risky = component("Risky", function Risky() {
  throw new Error("boom");
});

render(document.body, html`${boundary({
  children: () => html`<${Risky}></${Risky}>`,
  fallback: (error, retry) => html`<button @click=${retry}>Retry</button>`,
})}`);
```

Output:

```html
<button>Retry</button>
```

Boundaries catch synchronous render errors plus Broto owner errors from effects, lifecycle callbacks and resources.

## Refs

Input:

```ts
const FocusInput = component("FocusInput", function FocusInput(_props, ctx) {
  return html`<input ${ctx.ref((node) => (node as HTMLInputElement).focus())}>`;
});
```

Output:

```html
<input>
```

The input receives focus on mount.

## Directives

### `when`

Input:

```ts
html`${when(isOpen, () => html`<p>Open</p>`, () => html`<p>Closed</p>`)}`
```

Output:

```html
<p>Open</p>
```

### `repeat`

Input:

```ts
html`${repeat(items, (item) => item.id, ({ item }) => html`<li>${() => item().label}</li>`)}`
```

Output:

```html
<li>First</li>
<li>Second</li>
```

### `virtualRepeat`

Input:

```ts
html`${virtualRepeat(bigList, (item) => item.id, ({ item }) => html`<div>${() => item().name}</div>`, {
  height: 360,
  itemHeight: 32,
  overscan: 8,
})}`
```

Output shape:

```html
<div style="overflow: auto; max-height: 360px; contain: content;">
  <!-- visible window only -->
</div>
```

## Public API

```ts
html`...`
render(target, value)
mount(target, value)
component("Name", factory)
defineComponent("Name", factory)
create({ name?, registry?, isolated? })
getOrCreate(key, options?)
createRegistry(options?)
createComponentPack(name, components)
boundary(options)
createContext(defaultValue, description?)
provide(context, value)
useContext(context)
when(condition, truthy, falsy?)
repeat(items, key, render)
virtualRepeat(items, key, render, options)
ref(callback)
classMap(record)
styleMap(record)
css`...`
elements.div(...)
defineElement(...)
$ bag API
```

## Why components instead of direct DOM?

Use direct DOM for static one-off nodes. Use components when you need:

- composition
- cleanup ownership
- async cancellation
- error boundaries
- context propagation
- lifecycle hooks
- refs
- fine-grained bindings
- reusable UI contracts

## Preferred micro-JSX entrypoint

`jsx.html` is now the recommended component-template syntax because editors tend to highlight it better than `html.jsx`. The old API stays available.

```ts
const Button = component("Button", function Button(props) {
  return html`<button class=${props.tone}>${props.children}</button>`;
});

render(root, jsx.html`
  <Button tone="primary">Save</Button>
`);
```

Dynamic component props preserve their original runtime value:

```ts
const TabButton = component("TabButton", function TabButton(props) {
  const plugin = props.plugin;
  return html`<button>${() => plugin().title}</button>`;
});

jsx.html`<TabButton plugin=${item} />`;
```

`html.jsx` remains an alias for existing code.

## Composition helpers: portal, suspense, hydrate and repeat strategies

Fábrica includes small composition primitives for app-scale UI:

```ts
html`${portal(document.body, Modal())}`;
html`${suspense(resourceState, View, Spinner, ErrorView)}`;
hydrate(root, App());
repeat(records, (record) => record.id, Row, { strategy: 'append-only' });
```

`append-only` repeat is optimized for console logs, timelines and inspector surfaces where most updates add records at the end.

## Fabrica Elements and Cipó styled integration

Fábrica can render plain DOM nodes, Fabrica Elements payloads and Cipó styled factories through the same render pipeline.

```ts
import { html, render } from '../fabrica'
import { styled } from '../cipo'
import { signal } from '../broto'

const tone = signal('primary')

const Button = styled.button.css`
  px: 4
  py: 2
  bg: $brand
`

render(root, html`
  <${Button} data-tone=${tone} @click=${save}>
    Save
  </${Button}>
`)
```

Dynamic component-tag props are owned by a Broto effect. When `tone.set('danger')` runs, Fábrica re-invokes the styled factory, disposes the previous DOM range and mounts the next output. This keeps styled DOM factories ergonomic while preserving Fábrica's cleanup model.

Fabrica Elements payload adapter output is also renderable:

```ts
import { createElementFactory } from '../fabrica-elements'

const payloadElements = createElementFactory({ adapter: 'payload' })

render(root, html`
  ${payloadElements.section({
    class: 'card',
    dataset: { source: 'payload' },
    children: payloadElements.button({ children: 'Save' }),
  })}
`)
```

Supported renderable shapes now include:

- `Node` and `DocumentFragment`;
- Fabrica components and component render requests;
- Fabrica Elements payloads with `tag`, `props`, `attrs`, `dataset`, events, refs and children;
- Cipó styled DOM factories returned by `styled.button.css``...`` `;
- arrays containing any combination of the above.

## Composition diagnostics

Fábrica continues to render components, spreads, portals and suspense through the same public API. For deeper package integrations, use Broto's `inspectGraph()` and Fabrica Elements composition helpers:

```ts
import { inspectGraph, getOwner } from '../broto'
import { composeProps, polymorphic } from '../fabrica-elements'

console.log(inspectGraph(getOwner()))

const ButtonProps = composeProps(baseProps, userProps)
```

These additions are incremental and do not change existing component, directive or render contracts.

## Package-level lifecycle helpers

In addition to component-context lifecycle methods, Fabrica now exports package-level helpers that bind to the active Broto owner:

```ts
onMount(() => {
  const cleanup = startFeature()
  return cleanup
})

onDispose(() => stopFeature())
onError((error) => true)
```

## New non-breaking UI helpers

```ts
const name = signal('Rod')
html`<input .value=${bind(name)} />`
```

```ts
html`<button @click=${eventOptions(onClick, { once: true })}>Save</button>`
```

```ts
html`${keyed(userId, () => UserCard({ id: userId() }))}`
```

These helpers are additive and do not change the existing `html`, component, directive, or DOM bag APIs.

## Rendering Broto stores directly

Fabrica treats Broto signals and computed values as live bindings. A Broto store leaf can be rendered directly:

```ts
const state = store({ user: { name: 'Rod' } })

render(root, html`<span>${state.user.name}</span>`)
state.user.name.set('Cipó')
// DOM becomes: <span>Cipó</span>
```

For property-chain readability, Broto stores expose `state.view`, where each path is a computed signal:

```ts
render(root, html`<span>${state.view.user.name}</span>`)
state.setPath(['user', 'name'], 'Fabrica')
```

Avoid `${state.user.name()}` when you expect a DOM update, because JavaScript evaluates it to a plain string before Fabrica receives the template value. Use the signal itself, a store view path, or a function binding:

```ts
html`${state.user.name}`
html`${state.view.user.name}`
html`${() => state.user.name()}`
```

## Instances, registries and portable components

Fabrica now separates the renderer instance from the component registry. This
lets userscripts share one complete runtime, share only a design-system
registry, inherit components with local overrides, or stay completely isolated.

### Reuse exactly one instance across scripts

```ts
const app = Fabrica.getOrCreate("@rod/alerta", {
  name: "Alerta",
});
```

Every script that calls the same key receives the same realm-wide instance:

```ts
const storageApp = Fabrica.getOrCreate("@rod/alerta");

storageApp === app;
// true
```

The shared instance includes its registry, template/runtime bindings and
instance-bound `html`, `render`, `component` and lifecycle context.

### Create a new isolated instance

```ts
const sandbox = Fabrica.create({
  name: "sandbox",
});

sandbox.component("Button", (_props, ctx) => {
  return ctx.html`<button>Sandbox</button>`;
});
```

A component with the same name in the default instance does not collide with
`sandbox`. Passing `isolated: true` always creates a fresh empty registry, even
when a `registry` option is also present.

### Different renderers, one live registry

```ts
const registry = Fabrica.createRegistry({
  name: "alerta-ui",
});

const shell = Fabrica.create({
  name: "shell",
  registry,
});

const storage = Fabrica.create({
  name: "storage",
  registry,
});

shell.component("Button", (props, ctx) => {
  return ctx.html`<button>${props.children}</button>`;
});

storage.html`<Button>Save</Button>`;
```

The hot path is one `Map.get()`. Shared registries do not clone component
functions or template caches.

### Fork modes

```ts
const reference = shell.fork({
  name: "reference",
  registry: "reference",
});

const snapshot = shell.fork({
  name: "snapshot",
  registry: "snapshot",
});

const plugin = shell.fork({
  name: "storage-plugin",
  registry: "fork",
});

const isolated = shell.fork({
  name: "isolated",
  registry: "isolated",
});
```

| Mode | Behavior |
| --- | --- |
| `reference` | Uses the exact same live registry object. |
| `snapshot` | Copies the currently visible entries once. |
| `fork` | Copy-on-write overlay. Reads inherit from the parent; local registrations override without mutating it. |
| `isolated` | Starts with an empty registry. |

### Portable component definitions

Use `defineComponent()` when a component will be installed into more than one
instance. The factory receives the materializing instance through `ctx`:

```ts
const Button = Fabrica.defineComponent(
  "Button",
  (props, ctx) => ctx.html`
    <button @click=${props.onClick}>
      ${props.children}
    </button>
  `,
);

shell.use(Button);
sandbox.use(Button);
```

Portable factories should prefer:

```ts
ctx.html;
ctx.jsx;
ctx.component;
ctx.registry;
ctx.instance;
```

This avoids accidentally closing over another instance's `html` or registry.

### Component packs

```ts
const AlertaUI = Fabrica.createComponentPack("AlertaUI", {
  Button,
  Modal,
  Input,
});

storage.use(AlertaUI);

sandbox.use(AlertaUI, {
  namespace: "Sandbox",
  include: ["Button", "Input"],
});
```

The namespace example installs `SandboxButton` and `SandboxInput` without
wrapping or cloning the underlying functions.

### Cipó styled per Fabrica instance

The default `Cipo.styled` factory can still connect to the default Fabrica. For
multiple isolated registries, create one styled bridge per instance:

```ts
const shellStyled = Cipo.createStyled({
  fabrica: shell,
});

const sandboxStyled = Cipo.createStyled({
  fabrica: sandbox,
});

const ShellButton = shellStyled.button("Button")`
  inline-flex
  px: 3
`;

const SandboxButton = sandboxStyled.button("Button")`
  grid
  place-items: center
`;
```

Both components can use the registry name `Button` because each styled factory
is attached to a different Fabrica registry.

### Deprecated compatibility APIs

The following forms remain functional for migration only:

```ts
registerComponent("Button", Button);
component(function Button() {});
registry.registerComponent("Button", Button);
```

Each deprecated registration path emits a deduplicated `console.warn`. New code
should use:

```ts
component("Button", factory);
instance.use(definition);
instance.registry.register("Button", component);
```

## Performance benchmark matrix

Fabrica ships a Vitest/Tinybench kitchen-sink matrix at
`tests/fabrica.bench.ts`. Rendering cases are paired with semantically matched
manual DOM controls, while registry and instance microbenchmarks use explicit
manual control paths.

```bash
pnpm bench:fabrica
```

The reliable branch workflow does not compare two unrelated GitHub runners. It
checks out the previous benchmark-relevant commit into a worktree and runs both
revisions on the same machine in alternating order:

```txt
round 1: baseline → current
round 2: current → baseline
round 3: baseline → current
```

Results are aggregated by median. Each row records Tinybench RME, cross-round
median absolute deviation, sample counts and every individual round. For
Fabrica adapters, the primary delta is normalized against the paired manual
control from the same revision. Raw throughput remains available separately.

The adapter contract in `tests/fabrica.bench-cases.ts` uses stable case IDs. A
future React, Preact, Solid or other adapter only needs to implement
`FabricaBenchmarkAdapter.run(caseId)` and join the adapter list. The integrity
test executes every case/adapter pair once outside benchmark mode so broken
fixtures fail in ordinary CI.

## Named styled components in the registry

Fabrica's installer now announces its component registry to independently
bundled styled factories. A named Cipó/Fabrica Elements component can therefore
be rendered by name without passing the component function into the template:

```ts
const Button = styled.button('ToolbarButton').css`
  inline-flex
  px: 3
`

render(root, html`
  <ToolbarButton onClick=${refresh}>Refresh</ToolbarButton>
`)
```

Normal `html` only activates registered uppercase component parsing when a
static template chunk contains an uppercase tag. `jsx.html` remains the explicit
micro-JSX namespace and behaves identically for named components.

Registry collision behavior is owned by the styled factory. New integrations
should connect Cipó to `instance.registry` or use `Cipo.createStyled({ fabrica:
instance })`. The legacy `registerComponent()` surface remains available with a
deduplicated deprecation warning.
