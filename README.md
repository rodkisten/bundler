# Rod Browser Toolbox
[see online](https://rodkisten.github.io/bundler)

[![📦 Publish browser bundle](https://github.com/rodkisten/bundler/actions/workflows/publish-browser-bundle.yml/badge.svg)](https://github.com/rodkisten/bundler/actions/workflows/publish-browser-bundle.yml)

Browser-first build system for the Rod ecosystem. The project emits one browser global per root entrypoint, plus ESM/IIFE builds, extracted examples, and a generated landing page.

## Packages

| Root entry | Browser global | Ownership |
|---|---:|---|
| `src/broto.ts` | `window.Broto` | reactive runtime: signal, computed, effect, batch, store, graph, scheduler, async resources |
| `src/fabrica.ts` | `window.Fabrica` | HTML/UI runtime: templates, parser, renderer, directives, DOM parts, components and hydration |
| `src/fabrica-elements.ts` | `window.FabricaElements` | element/component factories: createElement, adapters, props, refs, children, wrappers |
| `src/cipo.ts` | `window.Cipo` | CSS runtime: aliases, tokens, atomic engine, stylesheet compiler |
| `src/index.ts` | `window.Rod` | umbrella namespace exporting Broto, Fabrica, FabricaElements and Cipo |

## Architecture

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
 └── hydration

Fabrica Elements
 ├── createElement
 ├── adapters
 ├── props
 ├── refs
 ├── children
 └── component wrappers

Cipo
 ├── css runtime
 ├── aliases
 ├── tokens
 ├── atomic engine
 └── stylesheet compiler
```

## Build outputs

```txt
src/broto.ts              -> dist/broto.iife.js              -> window.Broto
src/fabrica.ts            -> dist/fabrica.iife.js            -> window.Fabrica
src/fabrica-elements.ts   -> dist/fabrica-elements.iife.js   -> window.FabricaElements
src/cipo.ts               -> dist/cipo.iife.js               -> window.Cipo
src/index.ts              -> dist/index.iife.js              -> window.Rod
```

Every entry also gets `.iife.min.js`, `.esm.js`, `.esm.min.js`, source maps and build metadata when enabled.

## Commands

```bash
pnpm typecheck
pnpm build
pnpm verify
```

## Example extraction

The builder extracts `@example` blocks from TSDoc. When a single TSDoc comment has multiple examples, the shared summary/remarks text is rendered once for the group instead of being duplicated for every example.

## Landing page

`dist/index.html` uses a responsive forest/mata visual theme with layered gradients, noise, glass panels, modern CSS filters and mobile-safe layouts.


## Cipó native CSS functions and stylesheet authoring

Cipó now separates platform CSS functions from custom helpers. Native CSS such as
`max()`, `min()`, `clamp()`, `calc()`, `env()`, `var()`, `light-dark()`,
`color-mix()`, `oklch()`, gradients, filters, transforms, shapes and grid helpers
passes through untouched while Cipó-only helpers such as `alpha()` and
`outlineGlow()` are resolved by the helper registry.

Input:

```ts
const styleText = Cipo.sheet.css`
  .panel {
    right: max(0.5rem, env(safe-area-inset-right))
    bottom:
      max(1.125rem, env(safe-area-inset-bottom))
    background: linear-gradient(180deg, color-mix(in oklch, $panel 88%, transparent), light-dark(#fff, #000))
    color: oklch(from $brand l c h)
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr))
  }
`;
```

Output:

```css
.panel {
  right: max(0.5rem, env(safe-area-inset-right));
  bottom: max(1.125rem, env(safe-area-inset-bottom));
  background: linear-gradient(180deg, color-mix(in oklch, var(--cipo-colors-panel) 88%, transparent), light-dark(#fff, #000));
  color: oklch(from var(--cipo-colors-brand) l c h);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
}
```

Future browser functions can be registered without creating custom helpers:

```ts
Cipo.registerNativeFunction('anchor-size');

Cipo.sheet.css`
  .popover {
    width: anchor-size(width)
  }
`;
```

The declaration tokenizer also supports multi-line values where the property and
value are split across lines, which is useful for mobile-first safe-area CSS.

## Fábrica component runtime upgrade

Fábrica now supports deep component composition and ownership-aware rendering.

Input:

```ts
const Button = Fabrica.component("Button", function Button(props) {
  return Fabrica.html`
    <button class=${props.class}>
      ${props.children}
    </button>
  `;
});

Fabrica.render(document.body, Fabrica.html`
  <${Button} class="primary">
    Save
  </${Button}>
`);
```

Output:

```html
<button class="primary">Save</button>
```

The runtime now links DOM ranges to Broto owners, so effects, resources, context, refs, event listeners and lifecycle cleanup are disposed together.

## Fábrica micro-JSX

Fábrica now has a tiny JSX-like syntax inside template strings. It is still browser-native: no Babel, no AST transform, no virtual DOM.

Input:

```ts
const Dock = Fabrica.component("Dock", function Dock() {
  return Fabrica.html`<button>Open</button>`;
});

Fabrica.render(document.body, Fabrica.html.jsx`
  <Dock />
`);
```

Output:

```html
<button>Open</button>
```

For explicit parser-safe composition:

```ts
Fabrica.render(document.body, Fabrica.html.jsx`
  <f-component name="Dock" />
`);
```

Unregistered components render a visible `<fabrica-component-error>` fallback, which makes broken names obvious during userscript debugging.

## Error boundaries and owned async resources

Input:

```ts
const Profile = Fabrica.component("Profile", function Profile(props, ctx) {
  const profile = ctx.resource(
    (abort, id) => fetch(`/users/${id}`, { signal: abort }).then((r) => r.json()),
    { source: () => props.id, cacheKey: (id) => `user:${id}`, retries: 1 },
  );

  return Fabrica.html`${() => profile().loading ? "Loading" : profile().value?.name}`;
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

## Fabrica micro-JSX, preferred syntax

Use `Fabrica.jsx.html` for component templates. It keeps the runtime browser-native and usually gives better syntax highlighting than `html.jsx`.

```ts
const Panel = Fabrica.component("Panel", function Panel(props) {
  return Fabrica.html`<section>${props.children}</section>`;
});

Fabrica.render(document.body, Fabrica.jsx.html`
  <Panel>Inspector</Panel>
`);
```

`Fabrica.html.jsx` still works. Dynamic props on component tags are passed as raw values, so objects, signals and functions are not stringified.

## Staff-level additive APIs

This pass keeps existing APIs intact and adds diagnostics/composition helpers for larger apps and userscripts.

### Broto diagnostics

```ts
import { inspectRuntime, inspectSignals, inspectEffects, inspectScheduler } from './src/broto'

const snapshot = inspectRuntime()
console.table(snapshot.signals)
console.table(snapshot.effects)
console.log(snapshot.scheduler)
```

Use this to find effect leaks, owner trees that were not disposed, resources still polling, and large reactive graphs.

### Fabrica lifecycle helpers

```ts
import { onMount, onDispose, onError } from './src/fabrica'

onMount(() => {
  const controller = new AbortController()
  window.addEventListener('resize', sync, { signal: controller.signal })
  return () => controller.abort()
})

onDispose(() => console.log('owner disposed'))
onError((error) => {
  console.error(error)
  return true
})
```

These helpers are additive. Component context lifecycle APIs continue working as before.

### Fabrica Elements recipes

```ts
import { recipeProps } from './src/fabrica-elements'

const button = recipeProps({
  base: { class: 'btn', type: 'button' },
  variants: {
    tone: { primary: { class: 'btn-primary' }, danger: { class: 'btn-danger' } },
    size: { sm: { class: 'btn-sm' }, lg: { class: 'btn-lg' } },
  },
  defaults: { tone: 'primary', size: 'sm' },
  compound: [{ tone: 'danger', size: 'lg', props: { class: 'btn-danger-lg' } }],
})

button({ tone: 'danger', size: 'lg', class: 'extra' })
// { class: 'btn btn-danger btn-lg btn-danger-lg extra', type: 'button', ... }
```

### Cipó source explanations

```ts
import { explainCss } from './src/cipo/src'

const report = explainCss('.card { bg: alpha($brand / 20%) }', 'stylesheet')
console.log(report.transformedCss)
console.log(report.cssText)
console.log(report.validation)
```

## Staff-level feature pass

This build keeps all existing public APIs intact while adding focused production APIs across the packages:

- **Broto**: `configureDebug`, `effectScope`, `inspectLeaks`, `resource.mutate`, `resource.poll`, and `store.select`.
- **Fabrica**: `bind`, `model`, `keyed`, `eventOptions`, `fragment`, `childrenToArray`, `slot`, and `memoView`.
- **Fabrica Elements**: `recipe`, `variant`, and `asChild` composition helpers.
- **Cipó**: `sheet.css.scoped`, `sheet.css.layer`, `sheet.css.debug`, `explainDetailed`, and `benchmark`.

The new tests are split by feature so future regressions fail close to the package that owns the behavior.

## Runtime benchmarks

The build pipeline now runs `pnpm bench` after browser bundles are emitted and uploads the generated benchmark artifacts. The same output is copied into `dist/pipeline/benchmarks.md` and `dist/pipeline/benchmarks.json` so the generated docs can show the latest local runtime profile.

Current benchmark fixture shape:

| Benchmark | Purpose |
| --- | --- |
| `cipo.atomic.basic` | Hot path for atomic declarations, aliases, theme tokens and generated OKLCH color utilities. |
| `cipo.sheet.nested` | Full stylesheet parser with nesting, runtime `x:*` blocks and helpers. |
| `cipo.sheet.runtime-dsl` | Runtime token objects, derived CSS variables, mixins and Tailwind-like color utilities. |

Run locally:

```bash
pnpm bench
```

Example output:

```txt
## ⚡ Runtime Benchmarks

| Benchmark | Iterations | Total ms | Avg ms |
| --- | ---: | ---: | ---: |
| cipo.atomic.basic | 250 | varies | varies |
| cipo.sheet.nested | 150 | varies | varies |
| cipo.sheet.runtime-dsl | 120 | varies | varies |
```

## ⚡ Reliable Performance Observatory

The repository keeps versioned benchmark evidence in the root `bench/`
directory:

```txt
bench/
├── cipo.json
├── fabrica.json
├── runner.json
├── README.md
└── COMPARISON.md
```

### Local commands

```bash
# Fast local smoke run, one revision and one round
pnpm bench

# Three-round local median, useful before pushing
pnpm bench:reliable

# One package only
pnpm bench:cipo
pnpm bench:fabrica
```

The branch workflow uses a stricter same-runner A/B protocol:

1. finds the previous benchmark-relevant source commit, skipping benchmark-only bot commits;
2. creates a detached Git worktree for that baseline;
3. installs baseline and current dependencies with the same Node and pnpm versions;
4. runs baseline/current in alternating order for three rounds by default;
5. aggregates every case by median and stores cross-round MAD variation;
6. normalizes Fabrica results against the matching manual control in both revisions;
7. records Node, V8, Vitest, pnpm, kernel, CPU, memory and GitHub runner metadata;
8. writes `bench/*.json` and the visual Markdown comparison;
9. commits those files back to the PR branch and updates one PR comment.

The generated commit cannot create an infinite loop. The workflow does not
listen to `bench/**`, generated commits carry a dedicated marker, and a final
bot-author guard refuses to benchmark that marker commit.

### Reliable interpretation

`bench/fabrica.json` stores both raw throughput change and normalized change.
For a case such as `static-tree`, normalized change is calculated from:

```txt
(current Fabrica / current manual) / (baseline Fabrica / baseline manual) - 1
```

This removes much of the host-speed drift that previously made manual and
Fabrica cases appear to improve together. Manual controls and Cipó's
`baseline:` microbenchmarks are excluded from package-wide geometric means.
Measurements with excessive Tinybench RME or cross-round variation are marked
`unstable` instead of being presented as a regression or improvement.

Fabrica's adapter contract remains framework-neutral. React, Preact, Solid or
another renderer can be added to `src/fabrica/tests/fabrica.bench-cases.ts`
without changing historical case identifiers.

## 🌿 Named Cipó + Fabrica components

Named Cipó styled components now bridge automatically into Fabrica's registry:

```ts
const Button = Cipo.styled.button('Button').css`
  px: 4
  bg: $brand
`

Fabrica.render(root, Fabrica.html`
  <Button onClick=${save}>Save</Button>
`)
```

The bridge is load-order safe, polling-free, collision-configurable and exposed
through the reusable Fabrica Elements styled factory.

## 🔎 Readable Cipó atomic classes in debug mode

Cipó can expose declaration-shaped atomic class names while debugging without
changing atomic identity or cache behavior:

```ts
Cipo.setup({
  debug: {
    enabled: true,
    readableClassNames: true,
    maxClassLabelLength: 72,
    includeContext: true,
  },
})

Cipo.css`
  background-attachment: fixed;
  align-items: center;
`
```

Development output is deterministic and readable:

```txt
cipo-background-attachment-fixed-<stable-hash>
cipo-align-items-center-<stable-hash>
```

Production or explicit compact mode keeps the historical shape:

```ts
Cipo.setup({ debug: false })
// cipo-a-<stable-hash>
```

The suffix deliberately uses Cipó's stable rule hash rather than a random UUID.
That preserves deduplication, snapshots, reproducible diagnostics and cache
identity. URLs, data/blob payloads and quoted strings are redacted from the
readable label before it reaches the DOM.

## 🧬 Polymorphic `css` artifacts in the styled API

Named styled builders accept the same Cipó artifact returned by the polymorphic
`css` entrypoint:

```ts
const brandStyles = css`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`

const Brand = styled.div('Brand')(brandStyles)
```

Both authoring forms remain equivalent:

```ts
const DirectBrand = styled.div('DirectBrand')`
  display: flex;
`

const ArtifactBrand = styled.div('ArtifactBrand')(css`
  display: flex;
`)
```

The resolver also accepts arrays, false/null branches and prop functions:

```ts
const base = css`display:inline-flex; align-items:center;`
const danger = css`color:$danger;`

const Button = styled.button('Button')((props) => [
  base,
  props.danger && danger,
  props.compact && css`padding:4px;`,
])
```

Atomic artifacts contribute classes, inline artifacts compose into `style`, and
stylesheet artifacts are injected once. Named components keep Fabrica registry
metadata and remain usable as `<Button>` without passing the function to
`html`.

## 🏭 Fabrica instances and portable component registries

Fabrica supports isolated renderers, realm-wide reusable instances, shared live
registries, copy-on-write forks and portable component packs:

```ts
const alerta = Fabrica.getOrCreate('@rod/alerta')
const registry = Fabrica.createRegistry({ name: 'alerta-ui' })
const shell = Fabrica.create({ name: 'shell', registry })
const storage = Fabrica.create({ name: 'storage', registry })

const Button = Fabrica.defineComponent('Button', (props, ctx) =>
  ctx.html`<button>${props.children}</button>`,
)

shell.use(Button)
storage.html`<Button>Save</Button>`
```

The preferred component API is `component("Name", factory)`. Legacy explicit
`registerComponent()` and implicit `component(function Name(){})` registration
still work, emit one migration warning, and are documented as deprecated.

Use `Cipo.createStyled({ fabrica: instance })` when each Fabrica instance needs
its own named styled-component registry.

## 🌿 Cipó + Broto enterprise ergonomics

This build adds the next layer of the design-system engine:

- `!property: value` adds one safe `!important` priority without producing duplicate `!important !important` output.
- `atomic: { minUses: 2 }` keeps first-use declarations scoped to the component and promotes only reused declarations into shared atomic classes.
- `scope: { strategy: "where", selector: ".app" }` wraps generated selectors as `:where(.app) ...`, keeping specificity low while isolating styles.
- Container-query authoring works in Cipó syntax via `container: card / inline-size` and `x:cq(md) { ... }`.
- Tailwind-like helpers stay CSS-first: use `sr-only`, `space-y: 2`, `ring: glow`, `bg: color-sky-240`, `text(nowrap)` and friends inside declarations instead of className strings.
- `getDebugOverlayStats()` and `installDebugOverlay()` expose atom reuse, promotion and CSS byte statistics for mobile debug panels.
- Broto stores now accept middleware and devtools listeners: `store(initial, { middleware, devtools })`, plus runtime `state.use()` and `state.subscribeDevtools()`.

