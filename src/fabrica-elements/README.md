# Fabrica Elements 🌿🧩

Shared element/component factory layer used by Cipó and Fábrica.

## Responsibility

`fabrica-elements` owns the repeated element work that does not belong inside either CSS or HTML reactivity:

- DOM element creation;
- adapter abstraction for DOM, React, Preact, Solid and payload output;
- `class`/`className` merging;
- props, events, refs and children;
- static element factories;
- styled factories that accept an external style compiler.

## Why this package exists

Cipó had a styled-components-like API (`cipo.div.css``...`` `), but element creation is not CSS ownership. Fábrica also needs element factories for its HTML/runtime work. This package is the bridge:

| Package | Owns |
|---|---|
| Cipó | CSS, tokens, aliases, helpers, atomic classes |
| Fábrica | reactivity, templates, rendering, directives |
| Fabrica Elements | element/component factories and adapters |

## Static elements

```ts
import { elements } from './src/fabrica-elements'

const button = elements.button({
  class: 'primary',
  children: 'Save',
  onClick: () => console.log('save'),
})
```

DOM output:

```html
<button class="primary">Save</button>
```

## Styled factory

```ts
import { createStyledFactory } from './src/fabrica-elements'

const styled = createStyledFactory({
  createStyle(strings, values) {
    const artifact = css(strings, ...values)
    if (artifact.kind !== 'cipo.css') throw new Error('Expected atomic CSS')
    return { artifact, className: artifact.className }
  },
})

const Button = styled.button.css`
  px: 4
  bg: $brand
`
```

## Adapter output

DOM adapter:

```ts
const Button = styled.button.css`color:red`
Button({ children: 'Save' })
// HTMLButtonElement
```

React/Preact adapter:

```ts
const Button = createStyledFactory({ adapter: 'react', createStyle }).button.css`color:red`
Button({ children: 'Save' })
// { tag: 'button', props: { className: '...', children: 'Save' } }
```

Solid adapter:

```ts
const Button = createStyledFactory({ adapter: 'solid', createStyle }).button.css`color:red`
Button({ children: 'Save' })
// { tag: 'button', props: { class: '...', children: 'Save' } }
```

## Design notes

- It is style-runtime agnostic. It only needs a `className` from the compiler.
- It does not import Cipó or Fábrica.
- It keeps userscript output predictable and small.
- It exists to prevent duplicate prop/class/event/children logic across packages.

## Composition helpers

Fabrica Elements now includes small composition helpers shared by Cipo and Fabrica.

```ts
import { cx, createRef, composeRefs, childrenToArray } from './fabrica-elements'

const className = cx('button', active && 'active', ['rounded'])
const localRef = createRef<HTMLButtonElement>()
const ref = composeRefs(localRef, props.ref)
const children = childrenToArray(props.children)
```

These helpers keep element/component utilities out of both the CSS runtime and the
HTML renderer.
