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

## Reactive props when hosted by Fábrica

Fabrica Elements stays runtime-agnostic, but it now reads signal-like values structurally when a factory is invoked inside Fábrica's component-tag effect. This means static factories remain simple, while styled components rendered by Fábrica can receive Broto signals as props.

```ts
const label = signal('Save')
const Button = styled.button.css`px: 4`

render(root, html`
  <${Button} title=${label}>
    ${label}
  </${Button}>
`)
```

Callbacks are not invoked as values. `onClick`, `onInput`, `ref` and event maps stay as functions and are attached normally.

## Prop recipes

`recipeProps()` creates renderer-neutral prop recipes with variants, defaults and compound variants. It composes class names, refs, styles and events through the same `composeProps()` pipeline used by the rest of Fabrica Elements.

## Recipes and composition helpers

Fabrica Elements now includes tiny prop-level helpers that work across DOM, Fabrica, React-style payloads and Cipó styled APIs:

```ts
const button = recipe({
  base: { class: 'button', type: 'button' },
  variants: { tone: { primary: { class: 'primary' } } },
  defaults: { tone: 'primary' },
})
```

`variant()` resolves one variant map and `asChild()` provides an inert payload shape for adapter-level slot composition.

## Named styled components and Fabrica registry bridge

Named styled components can register themselves in any structural
Fabrica-compatible registry while anonymous components keep the original API.
The bridge does not poll and does not import Fabrica. It registers immediately
when a registry exists, or queues the component until Fabrica announces that its
bundle is ready.

```ts
const styled = createStyledFactory({
  createStyle,
  autoRegister: true,
  collision: 'warn',
})

const Button = styled.button('Button').css`
  display: inline-flex;
`
```

The direct template form is equivalent:

```ts
const Button = styled.button('Button')`
  display: inline-flex;
`
```

A named component exposes stable metadata and explicit lifecycle controls:

```ts
Button.displayName      // 'Button'
Button.className        // generated compiler class list
Button.artifact         // original compiler artifact
Button.tag              // 'button'
Button.registeredName   // 'Button'
Button.unregister()
Button.register('Button', 'replace')
```

### Delayed Fabrica loading

```ts
const Button = styled.button('Button').css`display:flex;`
styled.pendingComponents() // ['Button'] when Fabrica is not loaded yet

styled.connectRegistry(Fabrica)
styled.pendingComponents() // []
```

Fabrica's browser installer also publishes a shared readiness notification, so
separately loaded Cipó and Fabrica IIFE bundles flush the queue automatically.
The listener only exists while pending components exist, avoiding a permanent
factory retention path.

### Collision policies

```ts
styled.configureRegistry({ collision: 'replace' })
```

Supported policies:

- `warn`: preserve the existing component and emit one warning;
- `replace`: unregister and replace the existing component;
- `error`: throw immediately;
- `ignore`: preserve the existing component silently.

### Props, attrs and polymorphic `as`

```ts
const Action = styled.button('Action', {
  attrs: (props) => ({
    type: 'button',
    'aria-label': props.label,
  }),
})`
  display: inline-flex;
`

Action({ label: 'Save', children: 'Save' })
Action({ as: 'a', href: '/settings', label: 'Settings', children: 'Settings' })
```

`attrs()` remains available and accepts either an object or a props resolver.
Caller props win, while classes, styles, refs and events continue through the
shared `composeProps()` semantics.

### Styling an existing component

```ts
const ToolbarButton = styled(Button).named('ToolbarButton').css`
  min-width: 2rem;
`
```

The original prop contract is preserved and the generated class is merged
through the active adapter.

## Polymorphic style inputs and compiler artifacts

A styled factory can opt into artifact-aware resolution with `resolveStyle`.
This keeps Fabrica Elements compiler-neutral while allowing Cipó, or another
future compiler, to classify its own output:

```ts
const styled = createStyledFactory({
  createStyle(strings, values) {
    return compileTemplate(strings, values)
  },
  resolveStyle(input, props) {
    return compilerAdapter.resolve(input, props)
  },
})
```

Builders accept templates, artifacts, arrays, conditional branches and
prop-driven functions:

```ts
const Card = styled.article('Card')(compiledCardArtifact)

const Button = styled.button('Button')((props) => [
  baseArtifact,
  props.rounded && roundedArtifact,
  props.tone === 'danger' && dangerArtifact,
])
```

Style input recursion is bounded to protect against self-returning resolver
functions. Static artifacts are resolved once when the component is created;
only prop-dependent functions are revisited during rendering.

Metadata is intentionally explicit:

```ts
Button.className
Button.artifact
Button.artifacts
Button.dynamicStyles
```

`artifact` preserves the single-artifact compatibility shape. `artifacts`
contains every statically resolved artifact in insertion order, and
`dynamicStyles` tells diagnostics whether the style plan has a props-time path.
Class names, inline style values and registry metadata continue to compose with
caller props through the normal shared prop pipeline.
