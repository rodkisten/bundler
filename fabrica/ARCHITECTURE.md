# Fábrica Architecture

This document defines the post-refactor module boundaries and the invariants that
must remain true as Fábrica evolves.

## Design goals

Fábrica is a fine-grained DOM runtime, not a virtual-DOM renderer. The runtime is
built around stable DOM ownership, compiled template parts, Broto reactive owners,
and deterministic cleanup.

The architecture prioritizes six properties:

1. One observable DOM semantics for interpreted and compiled templates.
2. Explicit runtime/compiler package boundaries.
3. Ownership-based cleanup with no hidden strong global retention.
4. Focused modules with one-way runtime dependency flow.
5. Conservative compiler deoptimization instead of silent semantic changes.
6. A small public package surface that keeps internal modules refactorable.

## Layer map

```txt
api/
  factory.ts             instance construction and default runtime facade
  types.ts               public API contract
  instance-store.ts      realm-local named instance storage
  packs.ts               component pack composition
  dollar.ts              legacy `$` compatibility bridge

core/
  constants.ts           shared runtime constants
  runtime-context.ts     active runtime scoping
  value.ts               value predicates shared by render paths

bindings/
  attribute.ts           reactive native attribute bindings
  component-props.ts     component prop normalization
  interpolation.ts       interpolated attribute/value assembly
  maps.ts                class/style map reconciliation
  property-or-attribute.ts
  props.ts               stateful object-prop patching
  ref.ts                 canonical ref lifecycle
  serialize.ts           DOM value serialization helpers
  special.ts             `$css`, `$style`, and data bindings
  spread.ts              stateful spread reconciliation

render/
  root.ts                root render and owned mount APIs
  value.ts               RenderValue and child-range materialization
  template-runtime.ts    interpreted template materialization
  component-part.ts      component placeholder materialization
  html-result.ts         HtmlResult metadata and artifact contract
  deferred.ts            deferred child activation
  payload.ts             payload materialization
  cleanup.ts             node/range cleanup ownership
  dom.ts                 thin compatibility facade

template/
  cache.ts               template callsite cache
  source.ts              source assembly and micro-JSX normalization
  parts.ts               DOM part planning
  index.ts               focused internal barrel

directives/
  runtime.ts             small directive dispatcher
  host.ts                injected renderer capabilities
  model.ts               direct two-way form bindings
  repeat.ts              keyed reconciliation and LIS implementation
  controllers/
    when.ts
    keyed.ts
    repeat.ts
    virtual-repeat.ts
    portal.ts
    suspense.ts

compiler/
  transform.ts           source-transform orchestration
  ast.ts                 TypeScript SourceFile/compiler host setup
  bindings.ts            import resolution and lexical visibility
  imports.ts             collision-free helper import management
  serialize.ts           compiled IR source serialization
  html-parser.ts         quote-aware compact template parser
  constants.ts
  utils.ts
  runtime/
    index.ts             compiled-template cache and public helpers
    element.ts           compiled element materialization
    materialize.ts       compiled fragment/component materialization
    entities.ts          compact entity decoding
    types.ts             browser-safe compiled IR contracts

types/
  render.ts
  components.ts
  directives.ts
  template.ts
  events.ts
  debug.ts
  dom.ts
```

Top-level modules such as `public-api.ts`, `types.ts`, `render/dom.ts`, and
`compiler-runtime.ts` are intentionally thin facades. New implementation code
should prefer the focused modules above.

## Runtime dependency direction

Runtime dependencies must flow inward toward small primitives:

```txt
public entrypoints
       |
       v
      api
       |
       +----------> component/context/lifecycle
       |
       v
     render <---------- directives controllers
       |                       ^
       v                       |
    bindings <---------- directive host injection
       |
       v
      core
```

The runtime import graph is acyclic after this refactor. The domain type graph
contains one intentional type-only recursive component around `RenderValue`,
components, directives, and `DomBag`. That recursion models the value algebra and
does not emit a JavaScript dependency cycle.

## Runtime never depends on source compilers

Runtime Fábrica may depend on Broto runtime APIs, Fábrica Elements runtime
bridges, and Cipó runtime-safe APIs. It must not import:

- `@rodkisten/fabrica/compiler`;
- `@rodkisten/cipo/compiler`;
- Vite integration code;
- TypeScript compiler services.

`@rodkisten/cipo/runtime-inline` exists specifically to keep `$css` and `$style`
out of the build-compiler dependency graph.

## Compiler output targets compiler-runtime

The source transformer may depend on TypeScript. Generated application code must
not. Compiler helpers are emitted from:

```txt
@rodkisten/fabrica/compiler-runtime
```

That entrypoint contains only browser-safe materialization helpers.

## One DOM binding semantics

Interpreted templates, compiled templates, object props, payloads, and spreads
must converge on the same binding primitives:

```txt
interpreted template ----+
compiled template -------+----> bindings/* ----> DOM
object props ------------+
payloads ----------------+
spreads -----------------+
```

No compiled-runtime module should grow a parallel implementation of:

- event semantics;
- ref lifecycle;
- property assignment;
- boolean attributes;
- conditional classes;
- spread reconciliation;
- special attributes;
- cleanup ownership.

When a new template feature is added, define its DOM behavior in `bindings/`
first. Template planners and compiler phases should only describe how to reach
that behavior.

## Ownership and cleanup

Dynamic child parts own comment-delimited ranges. Broto owners, event cleanup,
ref cleanup, and directive controllers register against nodes inside those
ranges. Removing a range disposes owned work before removing the DOM nodes.

Fresh `HtmlResult` root renders use a direct fast path. Materialization records
the exact nodes that own cleanup callbacks so disposal can avoid recursively
walking fully static DOM trees.

Object refs reset to `null` on disposal. Callback refs may return a cleanup
function. The same `bindRef()` primitive is used by interpreted templates,
compiled templates, payloads, and spreads.

## Directives and renderer injection

Directive controllers do not import the renderer facade. The renderer installs a
minimal host containing only the capabilities controllers require, such as
appending a `RenderValue` or mounting an owned range.

This inversion keeps directive algorithms testable and prevents the historical
`dom -> directives -> component -> dom` runtime cycle from returning.

The keyed repeat reconciler and longest-increasing-subsequence implementation are
kept outside the dispatcher so they can be benchmarked and tested independently.

## Root rendering versus hydration

Fábrica currently exposes:

- `render(container, value)`: replace or reconcile root content;
- `mount(container, value)`: append one owned range;
- `mountPreservingChildren(container, value)`: append an owned range while
  preserving existing children.

Fábrica does **not** currently claim SSR hydration. Real hydration requires a
server marker protocol plus identity-preserving attachment of child parts,
events, refs, and effects. The previous `hydrate()` API only appended client DOM
and was removed rather than preserving a misleading contract.

## Compiler invariants

The compiler is an optimization layer. For every supported template:

```txt
observable(runtime(template)) == observable(compiled(template))
```

Observable behavior includes:

- initial DOM;
- signal-driven updates;
- event behavior;
- ref lifecycle;
- spread removal;
- component prop semantics;
- cleanup and disposal.

Unsupported static shapes may deopt to the canonical runtime path. Unexpected
compiler-runtime exceptions must propagate; they are bugs, not deoptimization
signals.

## Package surface

Public exports are explicit:

```txt
@rodkisten/fabrica
@rodkisten/fabrica/runtime
@rodkisten/fabrica/browser
@rodkisten/fabrica/compiler
@rodkisten/fabrica/compiler-runtime
```

The root and runtime entrypoints are side-effect free. `/browser` is the only
entrypoint that installs legacy globals automatically.

Wildcard package exports are intentionally forbidden. Internal file layout must
remain refactorable without creating accidental semver obligations.

## Installation lifecycle

Global installation captures previous values at installation time, not module
load time. Each installation owns exactly the aliases it wrote and restores them
in LIFO order only while those globals are still owned by that installation.

This prevents `noConflict()` from overwriting a global that another library took
over later. Runtime install options are reset from defaults for each installation
instead of leaking mutable singleton configuration across installs.

## Cache policy

Caches must be bounded or weakly owned:

- template callsites use `WeakMap` where identity is available;
- raw HTML parsing uses a bounded cache;
- dynamic compiled-template string caches are bounded;
- per-element prop, spread, and event bookkeeping uses `WeakMap`.

Unbounded process-lifetime `Map` caches require explicit architectural review.

## Review checklist for new runtime features

A production feature is not complete until all applicable items are true:

1. The canonical DOM semantics live in `bindings/` or another shared primitive.
2. Interpreted and compiled paths have parity tests.
3. Signal updates and disposal are tested, not only initial HTML.
4. New caches are weak or bounded.
5. Runtime code does not import compiler-only modules.
6. New public imports are added intentionally to `package.json` exports.
7. Cleanup ownership is explicit and deterministic.
8. The runtime import graph remains acyclic.
