# Validation report

Validated on 2026-06-30 with the bundler repository toolchain.

## Package checks

- `tsc --noEmit`: passed with no TypeScript errors.
- `vitest run src/devtools/devtools.test.ts`: 7 of 7 tests passed.
- Existing bundler build pipeline: passed and generated both `devtools.iife.js` and `devtools.iife.min.js`.
- Generated IIFE smoke test in JSDOM: passed, including global exports, initialization, default panels, Shadow DOM mounting, panel switching and clean destruction.
- Runtime import audit: only local Devtools modules, Cipo and Fábrica are imported. No Luna, Licia, Eustia, Chobitsu package, CDN loader or remote plugin import is present.

## Full repository suite

The full repository run completed with 336 passing tests and 2 failures in `src/cipo/tests/cipo.enterprise-features.test.ts`. The same two failures reproduce in an untouched copy of the supplied bundler, so they are pre-existing and unrelated to Devtools.

## Compatibility surface covered

- Public lifecycle and plugin API: `init`, `destroy`, `get`, `add`, `remove`, `show`, `hide`, `scale`, `position`.
- Public constructors and aliases: `Tool`, `DevTools`, `EntryBtn`, all default panels, `eruda`, and the local `chobitsu` protocol facade.
- Console, Elements, Network, Resources, Sources, Info, Snippets and Settings panels.
- Async protocol commands and synchronous domain facade used by RodEruda integrations.
