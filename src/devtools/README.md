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
- **Elements:** lazily mounted DOM tree, picker, highlighter, history, breadcrumbs, live mutation updates while active, double-click open, mobile long-press/context actions, attributes, inline and matched CSS, computed styles, box model and event listeners. Collapsed branches are not traversed or rendered.
- **Network:** fetch, XMLHttpRequest, WebSocket and Performance Resource Timing capture, request/response details, preview, headers, timing and cURL export.
- **Resources:** lazy localStorage, sessionStorage, cookies and resource discovery, JSON formatting/editing, scripts, stylesheets, frames and images, including editing and source navigation. Expensive page scans and observers run only while the panel is active.
- **Sources:** HTML, CSS, JavaScript, JSON, text, objects, images and frames with formatting, CodeMirror syntax highlighting, source index, copy and download. External text resources are resolved from the current DOM/CSSOM, captured Network bodies, Cache Storage, browser fetch or userscript cross-origin APIs, in that order.
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

## Initialization options

`devtools.init(options)` accepts every runtime-level option and can also patch DevTools and panel configs before panels mount.

```ts
devtools.init({
  container: document.querySelector("#debug-root") ?? undefined,
  tool: ["console", "elements", "network", "resources"],
  autoScale: true,
  useShadowDom: true,
  inline: false,
  defaults: {
    transparency: 0.95,
    displaySize: 80,
    theme: "System preference",
  },
  config: {
    devtools: {
      transparency: 0.95,
      displaySize: 80,
      theme: "AMOLED",
      panelOrder: ["console", "elements", "network"],
      disabledPanels: [],
    },
    panels: {
      console: {
        asyncRender: true,
        jsExecution: true,
        catchGlobalErr: true,
        overrideConsole: true,
        displayExtraInfo: false,
        displayUnenumerable: true,
        displayGetterVal: false,
        lazyEvaluation: true,
        displayIfErr: true,
        maxLogNum: "250",
      },
      elements: {
        overrideEventTarget: true,
        observeElement: true,
        showWhitespace: false,
      },
      network: {
        preserveLog: true,
        captureResponseBody: true,
        filter: "",
      },
      resources: {
        hideDevtoolsSetting: true,
        observeElement: true,
      },
      sources: {
        showLineNum: true,
        formatCode: true,
        indentSize: "2",
        wrapLines: false,
      },
    },
  },
  debug: {
    enabled: false,
    level: "info",
  },
});
```

### Option reference

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `container` | `HTMLElement` | created fixed host | Mount target. When omitted, RodEruda owns and watchdogs `#roderuda`. |
| `tool` | `string \| readonly string[]` | all default panels | Panel or panels to add on boot. `settings` is always mounted internally. |
| `autoScale` | `boolean` | `true` | On mobile, compensates for viewport scale. |
| `useShadowDom` | `boolean` | `true` | Mounts inside an open shadow root when available. |
| `inline` | `boolean` | `false` | Renders as an inline panel instead of the fixed overlay. |
| `defaults` | `DevtoolsDefaults` | see runtime defaults | Initial DevTools defaults for theme, opacity and dock size. |
| `config.devtools` | object | `{}` | Patches root DevTools config before panels are added. |
| `config.panels` | object | `{}` | Patches individual panel `ConfigStore`s before `init()`. |
| `debug` | `boolean \| DevtoolsDebugOptions` | `false` | Enables runtime debug logs. |

The floating entry button is rendered outside the panel dock stacking context and keeps the highest RodEruda z-index so it remains reachable above the shell and every panel.
