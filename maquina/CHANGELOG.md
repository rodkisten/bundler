# Changelog

- Switched the Máquina Vite build to Vite 8 native `resolve.tsconfigPaths: true`, removing the redundant `vite-tsconfig-paths` plugin.

## Unreleased

- Fixed the landing page runtime bootstrap so published builds load the generated `maquina.iife.js` exactly once, local Vite development imports `index.ts`, and editor mount failures render a visible diagnostic instead of leaving an empty shell.
- Routed the root publication build for Máquina through the same Cipó Vite compiler used by its dedicated build, preserving whole-build atomic CSS and compiled stylesheet optimization in the published IIFE.

- Replaced the hand-maintained Vite alias table with `vite-tsconfig-paths` and native TypeScript config loading through `tsx`, keeping `@rodkisten/*` aliases as the single import style.

## 0.1.0

- Initial production editor runtime.
- Added JavaScript, JSON, HTML, CSS and text highlighting.
- Added runtime themes and Safari-safe font scaling.
- Added completion providers and suggestion-on-type behavior.
- Added read-only viewing, wrapping, tab sizing and run shortcuts.
- Added Fábrica/Cipó components and Broto-backed state.
- Added DevTools integration replacing CodeMirror.
