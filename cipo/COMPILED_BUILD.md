# Cipó + Fábrica compiled build mode

Compiled build mode keeps the authoring model exactly the same and moves expensive parsing and global CSS reuse analysis out of the browser hot path:

- Cipó `styled.*(...).css\`...\`` blocks become class-only compiled artifacts.
- Fábrica Elements components created through Cipó's `styled` bridge participate in the same compilation automatically.
- Atomic promotion is enabled by default with a two-use threshold.
- Declarations reused by at least `atomic-min-uses` components become one shared atomic class.
- Declarations used fewer times remain under a component scope class.
- The complete build emits one consolidated stylesheet instead of embedding one CSS string in every styled component.
- `cssDelivery: 'style-tag'` injects that single compiled stylesheet through Cipó's runtime sink.
- `cssDelivery: 'asset'` emits the same stylesheet as a physical CSS asset.
- Fábrica `html\`...\`` templates are compiled independently by the Fábrica compiler.

The important design point is that this is **not a second CSS engine**. Whole-build mode reuses Cipó's transformer, parser, alias/helper/theme resolution, selector compiler and stylesheet emitter. The extra build phase only owns global declaration counting, promotion, final class assignment and output consolidation.


## Compiler isolation and diagnostics

Build compilation runs inside a fresh `CompilerContext` backed by its own `RuntimeState`. The compiler never borrows the live application's atomic cache, generated stylesheet buffer, configuration-application cache, or generated-name collision registry. As a result, compiling A then B is deterministic with respect to compiling B then A, and a previously configured runtime cannot cause build configuration to be skipped.

Static source analysis uses the TypeScript AST and lexical bindings rather than regex-based JavaScript scanning. Tagged templates inside `${...}` expressions are discovered correctly, shadowed identifiers are ignored, and generated imports are matched by module, imported symbol, and local binding.

Compilation failures are fatal by default. Invalid static templates produce `CipoCompileError` diagnostics with filename, source location, diagnostic code, and the original cause instead of falling back to an empty stylesheet. Vite transforms also return source maps so transformed modules remain debuggable.

## CSS-first configuration

Styling policy belongs in the Cipó configuration sheet, not in Vite options:

```ts
export const appCipoConfigCss = `
  @cipo {
    prefix: app;
    debug: false;
    minify: true;
    layers: false;
    atomic-min-uses: 2;
    rem: 16px;
  }

  @theme {
    colors<color>: (
      background: var(--background),
      primary: var(--primary)
    );
  }
`
```

The same sheet controls runtime and production lowering:

- `atomic-min-uses: 2` promotes a declaration after two component uses.
- `debug: true` keeps semantic/readable generated class names.
- `debug: false` allows compact production classes such as `a1f4k` and `s9pq2`.
- `minify: true` minifies the final consolidated stylesheet.
- `prefix`, theme tokens, aliases, breakpoints, REM policy and the remaining Cipó behavior stay in CSS-first configuration.

## Vite usage

```ts
import { defineConfig } from 'vite'
import { cipoVite } from '@rodkisten/cipo/vite'
import { appCipoConfigCss } from './cipo-config'

export default defineConfig({
  plugins: [
    cipoVite({
      mode: 'build',
      cssDelivery: 'style-tag',
      compileFabrica: true,
      transformCssTag: true,
      configCss: appCipoConfigCss,
    }),
  ],
})
```

Do not narrow `include` to only the entry package when styled components can be imported from other workspace packages. The compiler must see the complete reachable module graph to count declaration reuse correctly. `node_modules` remains excluded by default.

To emit a physical CSS asset instead:

```ts
cipoVite({
  mode: 'build',
  cssDelivery: 'asset',
  cssFileName: 'app.compiled.css',
  configCss: appCipoConfigCss,
})
```

## Styled input

```ts
const Header = styled.header('Header').css`
  display: flex;
  align-items: center;
  color: $primary;
`

const Toolbar = styled.div('Toolbar').css`
  display: flex;
  gap: 8px;
`
```

With `atomic-min-uses: 2`, `display:flex` is shared while the unique declarations remain scoped.

Conceptual production output:

```ts
const Header = attachCompiledClass(styled.header('Header'), 's8q1 a2fz')
const Toolbar = attachCompiledClass(styled.div('Toolbar'), 's3md a2fz')
```

One stylesheet is emitted:

```css
.a2fz{display:flex}
.s8q1{align-items:center;color:var(--app-colors-primary)}
.s3md{gap:.5rem}
```

The exact hashes are deterministic. In readable mode the shared atom can instead use a semantic name derived from the resolved declaration.

## Why class-only compiled artifacts

The older build path emitted this shape for every styled component:

```ts
attachCompiledCss(styled.div('Card'), 'c123', '.c123{display:flex;color:red}')
```

That duplicated CSS payloads throughout the JavaScript bundle and prevented reuse analysis across modules.

Whole-build mode emits only a temporary class token during source transformation. After Vite has transformed the entire graph, Cipó:

1. parses every collected static component style;
2. counts unique declaration/context identities per component;
3. promotes identities meeting `atomic-min-uses`;
4. keeps the remaining declarations scoped;
5. assigns final semantic or compact class names;
6. rewrites only compiler-owned JavaScript string literals that contain temporary class tokens;
7. injects or emits one final stylesheet.

This also means imported Maquina, DevTools and shared Fábrica Elements styled components can share the same atoms when they are part of the same final bundle.


## Static configuration lowering

The Vite integration only lowers `configureFromCss(...)` when the argument can be proven statically. String/template literals are compiled from their exact source value. Identifier arguments are lowered only when they are explicitly listed in `configRuntimeBindings` (the default contract includes `appConfigCss`). Unknown tenant, feature, or runtime-provided identifiers stay on the runtime parser path rather than being replaced with unrelated plugin configuration.

This conservative rule prevents build optimization from changing configuration semantics.

## Runtime behavior

The runtime follows the same threshold policy. Atomic mode defaults to two uses:

```ts
runtime.config.atomic.minUses // 2
```

A first runtime-only declaration can remain scoped. Once the same declaration/context is seen enough times, later runtime artifacts use the shared atom. Build mode has a stronger guarantee because it sees the whole graph before output and can rewrite every participant, including earlier components.

An explicit CSS-first configuration remains authoritative for production bundles.

## Full stylesheet mode

Selector-first `sheet.css` remains a full stylesheet by design:

```ts
const styles = sheet.css`
  .editor .cm-content {
    padding: 8px;
  }
`
```

These rules are consolidated into the same final delivery stylesheet, but they are not blindly split into atomic classes because selector structure and cascade semantics must be preserved.

## Fábrica build output

Fábrica compilation stays separate from CSS atomization:

```ts
const view = html`<button class="save" @click=${save}>Salvar</button>`
```

can become compiled Fábrica instructions or a direct static element fast path. Styled component class lists are already finalized by the Cipó whole-build pass and are consumed like ordinary component classes.

## DevTools build

RodEruda uses one CSS-first `devtoolsCipoConfigCss` source of truth:

```css
@cipo {
  prefix: rd;
  debug: false;
  minify: true;
  atomic-min-uses: 2;
}
```

The Vite transform follows the complete reachable workspace graph rather than only `devtools/**`. This is required because RodEruda imports Maquina and shared component modules. Their static styled declarations therefore participate in the same reuse counts and final stylesheet.

The default build emits:

```txt
dist/devtools.iife.js
dist/devtools.iife.min.js
dist/cipo.compiled.manifest.json
```

No separate CSS file is required with `cssDelivery: 'style-tag'`: one compiled stylesheet is injected through Cipó's runtime style sink. Use `cssDelivery: 'asset'` when a physical CSS asset is explicitly desired.
