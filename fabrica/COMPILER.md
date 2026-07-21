# Fábrica Compiler

The Fábrica compiler removes template discovery and static parsing work from
production runtime execution while preserving runtime semantics.

## Entry points

Build tools import:

```ts
import {
  compileFabricaSource,
} from "@rodkisten/fabrica/compiler";
```

Generated browser code imports helpers from:

```txt
@rodkisten/fabrica/compiler-runtime
```

This split prevents TypeScript compiler services from entering application
runtime bundles.

## Module responsibilities

The compiler is intentionally a pipeline of small phases:

```txt
compiler/
  ast.ts          parse source and provide AST/compiler context
  bindings.ts     resolve recognized imports and lexical visibility
  html-parser.ts  parse compact HTML template structure
  serialize.ts    serialize compiled template IR
  imports.ts      allocate and inject collision-free helper bindings
  transform.ts    orchestrate discovery, recursion, and ordered edits
  runtime/*       browser-safe execution of compiled IR
```

`transform.ts` should remain an orchestrator. Parser rules, scope resolution,
import mutation, and IR serialization belong to their dedicated modules so each
phase can be tested independently.

## Source transform pipeline

```txt
source text
  -> TypeScript SourceFile AST
  -> tagged-template candidate discovery
  -> import/alias and lexical-shadow resolution
  -> recursively transform nested interpolation expressions
  -> compact HTML template parser
  -> compiled template IR
  -> collision-free helper references
  -> ordered non-overlapping source edits
  -> helper import insertion
  -> transformed source
```

The transformer does not identify templates with textual searches such as
`source.indexOf("html`")`. A tag is transformed only when its AST expression
resolves to a recognized Fábrica template binding or configured tag path.

## Binding resolution

The transformer handles:

- direct `html` imports;
- aliases such as `html as h`;
- configured member tag paths;
- lexical parameter and local shadowing;
- helper-name collisions;
- direct component references only when a safe visible value binding exists.

A local unrelated tag remains untouched:

```ts
const html = String.raw;
html`not Fábrica`;
```

Likewise, a Fábrica import shadowed inside a function is not transformed inside
that shadowed scope.

Direct component references deliberately use lexical AST analysis rather than
`TypeChecker.getSymbolsInScope()`. Build integrations frequently compile virtual
files with partial module resolution, and the transform must stay deterministic
in those environments.

## Source preservation

Helper imports are inserted without invalidating:

- shebangs;
- directive prologues such as `"use client"`;
- existing imports;
- local bindings named like compiler helpers.

Nested Fábrica templates inside interpolation expressions are recursively
transformed through AST ranges before their parent template is serialized.

The Cipó/Vite integration uses transform-aware source maps with line and column
anchors. Generated helper lines remain mapped conservatively while unchanged
source retains substantially better column fidelity than the previous line-only
map.

## HTML template parsing

Build-time and runtime compilation share the same compact parser rules. Tag-end
scanning is quote-aware, so attributes such as this are valid:

```html
<div title="a > b">
```

The parser emits a compact IR consumed by the browser-safe compiled runtime.
Dynamic native props eventually route through the canonical Fábrica binding
kernel, preserving:

- reactive plain attributes;
- `.property` bindings;
- `?boolean` bindings;
- `class:*` bindings;
- stateful spread diffing;
- events;
- callback and object refs;
- special attributes;
- deterministic cleanup.

## Runtime parity

The compiler may alter execution strategy but not observable semantics:

```txt
interpreted template -> shared binding kernel -> DOM
compiled template    -> shared binding kernel -> DOM
```

A compiler optimization that reads a signal once where the interpreted runtime
installs an effect is invalid, even when the initial HTML is identical.

Parity tests therefore verify:

1. initial DOM;
2. signal-driven updates;
3. event behavior where applicable;
4. stale spread removal;
5. ref cleanup and reset;
6. disposal.

## Deoptimization

Known unsupported template shapes may return the canonical runtime template.
That is a deliberate deoptimization.

Unexpected exceptions are never swallowed into a runtime fallback. Silent
catch-all fallback hides compiler bugs and creates unpredictable performance
cliffs.

A future diagnostics mode may report explicit deoptimization reasons, but it
must not turn unexpected failures into silent success.

## Cache policy

Template-literal callsites are cached in a
`WeakMap<TemplateStringsArray, ...>`. Dynamic string-based compilation uses a
bounded cache. Cache keys never depend on joining template strings with a magic
separator.

## Import policy

The source compiler can depend on TypeScript. Generated browser code cannot.
This rule is enforced by the entrypoint split:

```txt
build process  -> @rodkisten/fabrica/compiler
browser output -> @rodkisten/fabrica/compiler-runtime
```

The Fábrica runtime also cannot import `@rodkisten/cipo/compiler`. Runtime inline
CSS compilation uses the dedicated `@rodkisten/cipo/runtime-inline` boundary.

## Testing contract

Every new compiler feature should include both:

1. focused source-transform tests; and
2. interpreted-versus-compiled runtime parity tests.

Source-transform coverage should include syntax boundaries whenever relevant:

- directives and shebangs;
- aliases and lexical shadowing;
- helper collisions;
- nested template literals;
- regex and comments inside expressions;
- quoted HTML attributes;
- virtual or partially resolved source files.

A test that only snapshots generated source or compares initial `innerHTML` is
not sufficient for a reactive compiler feature.
