# Fábrica

Fábrica is the HTML/UI runtime of the Rod browser ecosystem. It owns template parsing, DOM parts, rendering, directives, components, lifecycle hooks and hydration-oriented UI work.

Reactivity now lives in **Broto**. Fábrica consumes Broto internally and accepts Broto signals in render values, but it no longer owns or exports the reactive primitives from its public API.

## Package boundaries

```txt
Broto
 ├── signal
 ├── computed
 ├── effect
 ├── batch
 ├── store
 ├── graph
 ├── scheduler
 ├── async
 └── resources

Fabrica
 ├── html
 ├── template parser
 ├── renderer
 ├── directives
 ├── DOM parts
 ├── components
 └── hydration
```

## Basic usage

```ts
import { signal } from "../broto";
import { html, render } from "../fabrica";

const count = signal(0);

render(
  document.body,
  html`
    <button @click=${() => count.update((value) => value + 1)}>
      Count: ${count}
    </button>
  `,
);
```

## Public API

```ts
html`...`
render(target, value)
mount(target, value)
component(factory)
when(condition, truthy, falsy?)
repeat(items, key, render)
virtualRepeat(items, key, render, options)
ref(callback)
classMap(record)
styleMap(record)
css`...`
elements.div(...)
defineElement(...)
$ bag API
```

## Why signals moved out

Keeping Broto separate makes both packages smaller and clearer:

- Broto can run in DOM-free environments.
- Fábrica can focus on rendering and UI.
- Tests for reactivity no longer need DOM concerns.
- Future renderers can consume the same reactive runtime.

## Compatibility note

Component context still exposes Broto helpers for ergonomics:

```ts
const Counter = component((_props, ctx) => {
  const count = ctx.signal(0);

  return html`${count}`;
});
```

This is pass-through from Broto, not Fábrica-owned state.
