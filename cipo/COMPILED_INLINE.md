# Cipó Compiled Inline Mode

Compiled inline mode keeps Cipó/Fábrica authoring syntax while moving static CSS parsing out of the rendering hot path. The source compiler analyzes JavaScript and TypeScript with the TypeScript AST, identifies real Cipó/Fábrica styled-template bindings, and rewrites only statically provable templates into explicit compiled artifacts.

## What it does

- reuses Cipó's parser, transformer, helpers, aliases, theme resolution, and inline emitter;
- analyzes source with TypeScript AST and lexical bindings instead of regex-scanning JavaScript;
- discovers nested styled templates inside template interpolations;
- ignores shadowed lookalike identifiers and text that merely resembles code inside strings/comments;
- injects imports by exact module/imported-name/local-binding semantics;
- emits `cipo.inline-css` artifacts without requiring a generated CSS asset;
- keeps runtime fallback behavior for userscripts and non-Vite builds;
- reports static compiler failures as structured `CipoCompileError` diagnostics.

## Use with Vite

```ts
import { defineConfig } from 'vite'
import { cipoVite } from '@rodkisten/cipo/vite'

export default defineConfig({
  plugins: [
    cipoVite({
      mode: 'inline',
      compileFabrica: true,
    }),
  ],
})
```

Authoring remains unchanged:

```ts
import { styled } from '@rodkisten/cipo'

export const Panel = styled.div('Panel').css`
  px(3)
  py(2)
  color: white;
  background: #111827;
`
```

Conceptually, the source transform lowers the static template to a compiler artifact rather than asking the browser runtime to parse the DSL again:

```ts
import { compiledInlineCss } from '@rodkisten/cipo/compiler'
import { styled } from '@rodkisten/cipo'

export const Panel = styled.div('Panel')(compiledInlineCss`
  px(3)
  py(2)
  color: white;
  background: #111827;
`)
```

The exact generated form is an implementation detail of the compiler. Consumers should import compiler APIs only through `@rodkisten/cipo/compiler`.

## Use without the Vite transform

The compiler entrypoint can be called directly by build tooling:

```ts
import { createCompiledStyled } from '@rodkisten/cipo/compiler'
import { createFabrica } from '@rodkisten/fabrica'

const fabrica = createFabrica({ name: 'app', isolated: true })
const styled = createCompiledStyled({ fabrica })

export const Button = styled.button('Button').css`
  px(4)
  py(2)
  border-radius: 12px;
`
```

The compiler entrypoint is intentionally separate from `@rodkisten/cipo`. Importing the normal runtime does not load TypeScript, the source compiler, or the Vite integration.

## Boundary with whole-build mode

Inline mode intentionally keeps declarations attached to inline artifacts and does not require CSS-file output. For cross-component declaration reuse, atomic promotion, scoped fallbacks, global class finalization, and one consolidated stylesheet, use `cipoVite({ mode: 'build' })`; see [`COMPILED_BUILD.md`](./COMPILED_BUILD.md).
