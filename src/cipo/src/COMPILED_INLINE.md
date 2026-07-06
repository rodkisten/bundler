# Cipó Compiled Inline Mode

Compiled inline mode is the first production-safe compiler surface for Cipó and
Fábrica. It keeps the current authoring model, but makes the compiled artifact
explicit before runtime rendering.

## What it does today

- uses the existing Cipó compiler and parser;
- compiles to `cipo.inline-css` by default;
- does not emit a generated CSS file yet;
- works with Fábrica styled components;
- exposes a Vite plugin for DevTools/playground builds;
- keeps runtime fallback behavior for userscripts and non-Vite builds.

## Use with Vite

```ts
import { defineConfig } from 'vite'
import { cipoVite } from './src/cipo/src/vite'

export default defineConfig({
  plugins: [
    cipoVite(),
  ],
})
```

You keep writing components the same way:

```ts
import { styled } from './runtime'

export const Panel = styled.div('Panel').css`
  px(3)
  py(2)
  color: white;
  background: #111827;
`
```

The plugin rewrites that to an explicit inline artifact call:

```ts
import { compiledInlineCss } from '../cipo/src/compiler/compiled-inline'
import { styled } from './runtime'

export const Panel = styled.div('Panel')(compiledInlineCss`
  px(3)
  py(2)
  color: white;
  background: #111827;
`)
```

That means DevTools can inspect the compiled artifact, while the DOM still gets
plain inline declarations through Fábrica.

## Use without Vite

Use the compiled styled factory directly:

```ts
import { createCompiledStyled } from './src/cipo'
import { createFabrica } from './src/fabrica'

const fabrica = createFabrica({ name: 'app', isolated: true })
const styled = createCompiledStyled({ fabrica })

export const Button = styled.button('Button').css`
  px(4)
  py(2)
  border-radius: 12px;
`
```

## DevTools build

The root `pnpm build` now builds the `src/devtools.ts` entry through Vite with
`cipoVite()`. Other root entries still use the existing esbuild path. This makes
DevTools the playground for compiled mode without forcing the rest of the bundle
to move to Vite at once.

## Current boundary

This mode intentionally avoids CSS file output. The next compiler step can add
atomic/scoped CSS emission, but inline mode gives a small, testable base first.
