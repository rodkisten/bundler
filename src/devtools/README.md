# RodEruda Devtools

A modern TypeScript reimplementation of the RodEruda mobile browser developer tools. The package is a standalone root bundler entry and imports only the local **Cipo** stylesheet runtime and **Fábrica** renderer.

## Runtime dependency policy

- No Luna packages.
- No Licia or Eustia utilities.
- No Chobitsu runtime.
- No remote plugins, dynamic CDN imports, or hidden vendored bundles.
- Cipo owns stylesheet compilation/injection.
- Fábrica owns the root component render.
- Browser platform APIs implement the remaining functionality.

## Panels

- **Console:** early console interception, guarded console patching, global errors, promises, groups, timers, counts, filtering, CodeMirror-backed expression execution, `$`/`$$` helpers and persistent history.
- **Elements:** DOM tree, picker, highlighter, history, breadcrumbs, live mutation updates, double-click open, mobile long-press/context actions, attributes, inline and matched CSS, computed styles, box model and event listeners.
- **Network:** fetch, XMLHttpRequest, WebSocket and Performance Resource Timing capture, request/response details, preview, headers, timing and cURL export.
- **Resources:** localStorage, sessionStorage, cookies, storage capability discovery, JSON formatting/editing, scripts, stylesheets, frames and images, including editing and source navigation.
- **Sources:** HTML, CSS, JavaScript, JSON, text, objects, images and frames with formatting, CodeMirror syntax highlighting, source index, copy and download.
- **Info:** page, browser, device, connection, navigation, memory and document diagnostics.
- **Snippets:** the RodEruda snippet set implemented locally, plus user-defined JavaScript snippets.
- **Settings:** theme, transparency, display size, active panels, panel order and panel-specific configuration.

## API

```ts
import devtools from "./src/devtools";

devtools.init();
devtools.show("elements");
devtools.get("console")?.log("hello");
devtools.position({ x: 12, y: 80 });
devtools.scale(1);
```

The default export also exposes the compatibility aliases `eruda`, `chobitsu`, all tool constructors, `Tool`, `DevTools`, `EntryBtn`, themes, and utilities.

## Bundler output

The implementation lives in `src/devtools/`. The thin `src/devtools.ts` root entry follows the same pattern as Cipo, Fábrica and Broto, allowing the existing discovery pipeline to emit the `devtools` IIFE and ESM artifacts.
