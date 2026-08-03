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

### Browser IIFE / userscript global

The standalone bundle exposes the runtime directly at `globalThis.DevTools`:

```js
DevTools.init({ autoScale: true });
DevTools.show("console");
```

This is the canonical browser API. Compatibility paths remain available for
older launchers through `DevTools.api`, `DevTools.default`, `DevTools.devtools`,
`DevTools.eruda`, and `globalThis.__ROD_DEVTOOLS__`. The browser entry assigns
`globalThis.DevTools` explicitly so `@require` works even when a userscript
manager wraps required files in an isolated function scope.

### Public external log ingestion

`DevTools.ingestLogs()` writes directly into the Console stream, including before
`DevTools.init()` mounts the UI. Every ingested record receives a tiny `ext`
badge; `source` is kept in the badge tooltip and is also searchable by the
Console filter.

```js
// One direct record, using native console semantics.
DevTools.ingestLogs("warn", "worker is slow", { elapsed: 824 });

// Structured record with an explicit source and badge.
DevTools.ingestLogs({
  level: "info",
  args: ["socket connected", { id: 42 }],
  source: "realtime-client",
  badge: "ws",
});

// A reusable console-compatible stream.
const workerLogs = DevTools.ingestLogs({
  source: "image-worker",
  badge: "wrk",
});

workerLogs.group("decode");
workerLogs.time("frame");
workerLogs.log("started", { frame: 12 });
workerLogs.append("info", "raw append in the current group");
workerLogs.timeEnd("frame");
workerLogs.groupEnd();

// Patch an existing console-like object in place. Original methods continue
// running by default, and destroy/restore puts every descriptor back.
const stop = workerLogs.intercept(worker.console);
stop();

// Or intercept immediately while creating the stream.
const sdkLogs = DevTools.ingestLogs(sdk.console, {
  source: "vendor-sdk",
  badge: "sdk",
  passthrough: true,
});

sdkLogs.destroy();
```

`stream.append(level, ...args)` is the lowest-level append operation and keeps the
stream's current group depth. `stream.ingest(method, ...args)` applies native
console behavior explicitly.

The stream supports the native console surface: `log`, `debug`, `trace`, `info`,
`warn`, `error`, `dir`, `dirxml`, `table`, `assert`, counters, timers, groups,
`timeStamp`, profiles, `exception`, and `clear`. Groups, timers and counters are
isolated per external stream, so one source cannot corrupt another source's
state or the page's own Console state.

## Styled CSS registry

All DevTools panels keep using the shared `styled` factory from `core-runtime`.
Each component is registered automatically in `styledRegistry`, and the mount
pipeline installs `styledRegistry.cssArtifacts` in one pass. Panels no longer
maintain duplicated component arrays or per-panel `*StyleArtifacts` exports.
This also means a newly declared styled component, including shared panel UI,
participates in runtime and compiled production CSS automatically.

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

### Mobile robustness

The console capture layer now combines direct console wrapping, prototype/watchdog recovery, global error listeners, and an optional page-realm bridge for userscript sandboxes. Hidden console errors are grouped into one notification instead of flooding the screen. Scrollable panels reserve extra bottom space for Safari toolbars and safe areas, while Elements long-press menus use panel-local coordinates and suppress native text selection.


## Tweak-first configuration policy

Every user-visible behavior, timing, size, limit, spacing, capture strategy, editor preference, and performance threshold must be backed by a typed `ConfigStore` field and registered in Settings. New features should use `Settings.registerConfigGroup()` with descriptors beside the owning panel instead of introducing unexplained numeric literals. Panel-private values stay in that panel config; cross-panel visual values belong to `DevToolsConfig`.

The shell shows a compact build badge containing the seven-character commit SHA and the build date/time in GMT-3. The Info panel exposes the full SHA, ISO timestamp, GMT-3 timestamp, version, timezone, and build mode. Vite injects this metadata at build time through `__RODERUDA_BUILD__`.

## Startup visibility and captured startup errors

RodEruda initializes hidden by default. The dock opens during initialization only when the Console setting `displayIfErr` is enabled and `initialLogs` or `initialErrors` contains entries. Inline installations remain visible.

Userscripts can collect failures before initialization and hand them to the Console:

```ts
DevTools.init({
  initialLogs: capturedLogs,
  initialErrors: capturedErrors,
  config: {
    panels: {
      console: { displayIfErr: true },
    },
  },
});
```

Each bag accepts raw values, `Error` objects, or structured entries with `level`, `args`, `message`, `timestamp`, and `stack`.

## Mobile interaction rules

The DevTools surface is non-selectable by default. Inputs, textareas, code blocks, contenteditable regions, and CodeMirror explicitly restore text selection. Panel sections use pointer-based drag handles so reordering works with touch, pen, and mouse instead of relying on desktop HTML drag-and-drop.

## Mobile dock and Console parity

The floating DevTools dock is anchored to the bottom of the current `visualViewport`, including Safari toolbar and virtual-keyboard offsets. Tool content scrolls vertically by default; horizontal scrolling is reserved for explicit code/table surfaces.

Console output preserves live values and renders objects, functions, DOM nodes, errors, maps, sets, promises and long global objects as lazy expandable trees. Standard browser formatting tokens (`%s`, `%d`, `%i`, `%f`, `%o`, `%O`, `%c`, `%%`) are supported. The capture layer handles groups, collapsed groups, tables, traces, counters and timers.

REPL completion is manual on mobile to avoid iOS accepting a partial completion while typing identifiers such as `document`. `Enter` and the Run button execute code; `Shift+Enter` inserts a newline.

## Browser Laboratory landing page

The DevTools build now publishes a standalone maximalist injector at `src/devtools/dist/index.html`. It loads RodEruda from `https://rod.migos.club/bundler/devtools.iife.js` by default and can optionally inject Eruda alongside it.

The landing page provides:

- editable RodEruda and Eruda bundle URLs;
- cache-busted or reusable script loading;
- destroy-before-reinitialize behavior;
- panel selection and initial-tool selection;
- Shadow DOM, autoscale, inline, startup-error and debug controls;
- Console, Elements, Network and Sources capture/editor settings;
- live initialization-code preview;
- generated userscript, bookmarklet and JSON configuration exports;
- startup `error` and `unhandledrejection` collection for `initialLogs`;
- a live Token Lab persisted in `localStorage`.

### Landing design tokens

The page is styled entirely around public `--landing-*` CSS custom properties. The primary customization contract is:

```css
:root {
  --landing-color-background: #07060d;
  --landing-color-surface: #f4efe3;
  --landing-color-ink: #101019;
  --landing-color-accent: #c6ff00;
  --landing-color-hot: #ff2bd6;
  --landing-color-electric: #5f7cff;
  --landing-border-width: 3px;
  --landing-radius: 18px;
  --landing-shadow-offset: 10px;
  --landing-noise-opacity: 0.08;
}
```

Spacing, typography, gradients, motion, grid size and semantic surfaces are also defined as tokens near the top of `landing.css`. The build plugin bundles `landing.ts`, copies `landing.css`, rewrites the development asset paths and emits the production landing assets beside every DevTools bundle.

## Shared DevTools context

The DevTools runtime creates one `DevtoolsContext` owner before mounting the shell. Every isolated Fábrica render root, including panels mounted later, runs under that owner. The shared context exposes strongly typed signals for the controller, shell refs, settings, active panel and visibility.

Panel-specific contexts are intentionally deferred to the next migration phase. This keeps the global context focused on cross-panel services and avoids a single oversized store.

### Panel-local view contexts

Every DevTools panel now mounts its visual root under a required Fábrica context provider. Components resolve their ViewModel with `ctx.useRequiredContext(...)` instead of receiving a `view` prop. The provider preserves the exact ViewModel/store reference, while Broto signals remain responsible for fine-grained DOM updates. This keeps panel instances isolated and removes ViewModel prop drilling across Console, Settings, Elements, Info, Network, Resources, Snippets, and Sources.

### Runtime Cipó configuration with production lowering

RodEruda keeps one readable `devtoolsCipoConfigCss` sheet as the source of truth for `@cipo`, `@theme`, and `@breakpoints`. In development and direct runtime execution, `bootstrapDevtoolsCipo()` applies that sheet through `configureFromCss()`, so runtime resets and dynamic mounts keep the normal Cipó semantics.

During a production Vite build, the Cipó plugin lowers that same `configureFromCss(config)` call to a compact `configureCompiledCssConfig()` payload. The payload contains parsed config/theme operations rather than the source DSL, so the final browser bundle keeps runtime theme application while tree shaking the CSS-first parser and the raw `@theme` text. There is no hand-maintained second theme stylesheet.

### Alias-driven Vite configuration

The standalone DevTools Vite build resolves `@rodkisten/*` imports from `tsconfig.base.json` through Vite 8's native `resolve.tsconfigPaths: true`; it does not duplicate those mappings in `resolve.alias`. Because `vite.config.ts` itself imports Cipó through an alias, the CLI is launched with Node's `tsx` loader and `--configLoader native`, allowing the TypeScript runtime to resolve config-time aliases before Vite resolves the application module graph natively.
