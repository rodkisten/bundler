# Máquina ⌨️

Máquina is a small, dependency-free browser code editor built with **Fábrica**, **Cipó**, and **Broto**. It is designed for embedded tools, mobile Safari, userscripts, inspectors, playgrounds and production dashboards.

## Highlights

- Real `16px` editing surface, optionally scaled down visually to avoid iOS Safari zoom.
- JavaScript, JSON, HTML, CSS and plain-text highlighting.
- Completion providers with suggestions while typing.
- Keyboard and touch friendly completion list.
- Theme switching at runtime.
- Read-only source viewer mode.
- Optional line wrapping, tabs, run command and change events.
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

The editable control always keeps an actual `16px` font size. `fontSize` controls a scale applied to the whole editor, so a requested `12px` editor remains visually compact without triggering Safari input zoom.

## Vite path aliases

The development and production Vite commands resolve `@rodkisten/*` imports from the root TypeScript path mappings with `vite-tsconfig-paths`. The Vite config is loaded through `tsx` and Vite's native config loader so aliased Cipó imports also work while the config itself is being evaluated.
