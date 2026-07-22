# Máquina ⌨️

Máquina is a small, dependency-free browser code editor built with **Fábrica**, **Cipó**, and **Broto**. It is designed for embedded tools, mobile Safari, userscripts, inspectors, playgrounds and production dashboards.

## Highlights

- Real `16px` editing surface with layout zoom to keep the native iOS caret aligned.
- JavaScript, JSON, HTML, CSS and plain-text highlighting.
- Completion providers with suggestions while typing.
- Keyboard and touch friendly completion list.
- Theme switching at runtime.
- Read-only source viewer mode.
- CodeMirror-style non-selectable line numbers, optional wrapping, tabs, run command and change events.
- No CodeMirror, Monaco, React or virtual DOM dependency.

## Basic usage

```ts
import { mountMaquina } from "./maquina";

const editor = mountMaquina({
  parent: document.querySelector("#editor")!,
  value: "const greeting = 'Olá';",
  language: "javascript",
  theme: "obsidian",
  fontSize: 13,
  lineWrapping: true,
  lineNumbers: true,
  onChange(value) {
    console.log(value);
  },
  onRun() {
    console.log(editor.getValue());
  },
});
```

## Suggestions

```ts
mountMaquina({
  parent,
  value: "doc",
  language: "javascript",
  completions(context) {
    const word = context.matchBefore(/[$\w.]+$/);
    if (!word) return null;
    return {
      from: word.from,
      options: [
        { label: "document", type: "global" },
        { label: "window", type: "global" },
      ],
    };
  },
});
```

## Themes

Built-in themes: `obsidian`, `midnight`, `forest`, and `paper`.

```ts
editor.setTheme("forest");
```

## Safari font scaling

The editable control always keeps an actual `16px` font size. `fontSize` uses CSS layout zoom rather than a transform, so the native WebKit caret and the highlighted text share the same coordinate space while compact editors still avoid Safari input zoom.

## CSS-first atomic production build

Máquina keeps authoring normal named `styled` components, but its Vite build uses Cipó's whole-build atomic compiler. Styling policy lives in `maquina/cipo-config.ts`:

```css
@cipo {
  prefix: maq;
  debug: false;
  minify: true;
  atomic-min-uses: 2;
}
```

Static component declarations are analyzed together. A declaration used by at least two components becomes one shared atomic class, while one-off declarations remain under a compact component scope. The final production bundle injects one consolidated stylesheet instead of embedding one CSS string for every `Maquina*` styled component.

When Máquina is imported by another Cipó Vite build, such as RodEruda DevTools, the parent compiler follows the complete reachable workspace graph. This allows Máquina declarations to share atoms with the parent bundle instead of leaking uncompiled `.css\`...\`` templates into the final JavaScript.

## Vite path aliases

The development and production Vite commands resolve `@rodkisten/*` imports from the root TypeScript path mappings with Vite 8's native `resolve.tsconfigPaths: true`. The Vite config is loaded through `tsx` and Vite's native config loader so aliased Cipó imports also work while the config itself is being evaluated.
## Landing page runtime

The checked-in `maquina/index.html` supports both development and published builds without mounting the editor twice:

- On localhost, the page imports `./index.ts` through Vite so edits are reflected immediately.
- In published output, it loads the sibling `maquina.iife.js` bundle and reads `globalThis.Maquina`.
- Runtime loading and editor initialization errors are rendered inside the main editor card for visible diagnostics.

The root publication pipeline also builds Máquina through Cipó's Vite compiler, matching the dedicated `build:maquina` atomic CSS path.

