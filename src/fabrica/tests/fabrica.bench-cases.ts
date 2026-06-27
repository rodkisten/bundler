/** @vitest-environment jsdom */

import { flushSync, signal } from '../../broto'
import {
  bind,
  classMap,
  component,
  html,
  portal,
  rawHtml,
  render,
  repeat,
  styleMap,
  virtualRepeat,
} from '../index'
import type { RenderValue } from '../types'
import { assertAtomicCssArtifact, css as cipoCss, reset as resetCipo, setup as setupCipo, styled as cipoStyled } from '../../cipo/src/index'
import type { StyledTagFactory } from '../../fabrica-elements'

export type FabricaBenchmarkAdapter = {
  /** Stable identifier used in JSON reports and cross-framework comparisons. */
  readonly id: string
  /** Human-readable framework/runtime name. */
  readonly label: string
  /** Runs one supported benchmark case. */
  run(caseId: FabricaBenchmarkCaseId): void
}

export type FabricaBenchmarkCase = {
  readonly id: FabricaBenchmarkCaseId
  readonly label: string
  readonly description: string
}

export type FabricaBenchmarkCaseId =
  | 'static-tree'
  | 'complex-attributes'
  | 'nested-components'
  | 'reactive-text'
  | 'reactive-class-style'
  | 'conditional-component'
  | 'spread-props-events'
  | 'keyed-list-update'
  | 'virtual-list-window'
  | 'portal-mount'
  | 'raw-html'
  | 'two-way-bind'
  | 'named-styled-registry'
  | 'styled-component-registration'
  | 'styled-artifact-render'
  | 'styled-artifact-composition'

export const FABRICA_BENCHMARK_CASES: readonly FabricaBenchmarkCase[] = Object.freeze([
  {
    id: 'static-tree',
    label: 'Static tree creation',
    description: 'Creates a representative article tree with text, attributes and a button.',
  },
  {
    id: 'complex-attributes',
    label: 'Complex attribute interpolation',
    description: 'Exercises composite class/title/ARIA attributes, property bindings and inline styles.',
  },
  {
    id: 'nested-components',
    label: 'Nested component composition',
    description: 'Renders consecutive self-closing components with fragments, props and event handlers.',
  },
  {
    id: 'reactive-text',
    label: 'Fine-grained text updates',
    description: 'Performs repeated signal-driven text updates without replacing the surrounding tree.',
  },
  {
    id: 'reactive-class-style',
    label: 'Reactive class/style diffing',
    description: 'Toggles classMap/styleMap values and compares them with direct DOM setters.',
  },
  {
    id: 'conditional-component',
    label: 'Conditional component branch',
    description: 'Toggles a component using the React-like condition && component authoring path.',
  },
  {
    id: 'spread-props-events',
    label: 'Spread props and events',
    description: 'Diffs classes, dataset, booleans and event listeners from one reactive spread object.',
  },
  {
    id: 'keyed-list-update',
    label: 'Keyed list reorder/update',
    description: 'Renders and reverses a keyed list while updating a subset of item labels.',
  },
  {
    id: 'virtual-list-window',
    label: 'Virtual list window',
    description: 'Creates a windowed list from one thousand records instead of mounting every row.',
  },
  {
    id: 'portal-mount',
    label: 'Portal mount and cleanup',
    description: 'Mounts content into an external target and releases both ownership ranges.',
  },
  {
    id: 'raw-html',
    label: 'Trusted raw HTML insertion',
    description: 'Parses and inserts a compact trusted HTML fragment.',
  },
  {
    id: 'two-way-bind',
    label: 'Two-way input binding',
    description: 'Synchronizes an input event into a writable signal and reflects a subsequent update.',
  },
  {
    id: 'named-styled-registry',
    label: 'Named styled registry render',
    description: 'Resolves a Cipó styled component by registry name and renders it without passing the function.',
  },
  {
    id: 'styled-component-registration',
    label: 'Styled component registration',
    description: 'Compiles a warm styled template, decorates metadata, registers and unregisters a named component.',
  },
  {
    id: 'styled-artifact-render',
    label: 'Precompiled styled artifact render',
    description: 'Renders a named styled component created from a precompiled polymorphic css artifact.',
  },
  {
    id: 'styled-artifact-composition',
    label: 'Styled artifact array/function composition',
    description: 'Composes static artifacts with a prop-driven conditional artifact and creates the resulting element.',
  },
])

const ToolbarButton = component<{
  icon: RenderValue
  label: string
  tone: string
  onClick: () => void
}>('BenchmarkToolbarButton', (props) => html`
  <button
    class="bench-button bench-button-${props.tone}"
    title="Open ${props.label} panel"
    aria-label="Toolbar ${props.label}"
    @click=${props.onClick}
  >
    <span class="bench-icon">${props.icon}</span>
    <span class="bench-label">${props.label}</span>
  </button>
`)

const ConditionalPanel = component<{ label: string }>('BenchmarkConditionalPanel', (props) => html`
  <aside class="bench-panel"><strong>${props.label}</strong><p>Ready</p></aside>
`)

resetCipo()
setupCipo({
  prefix: 'bench-registry',
  minify: true,
  layers: false,
  theme: { colors: { brand: '#38bdf8' }, spacing: '0.25rem' },
})

const cipoStyledButton = cipoStyled.button as StyledTagFactory

const RegistryStyledButton = cipoStyledButton('BenchmarkRegistryButton', { collision: 'replace' }).css`
  px: 2
  py: 1
  bg: $brand
`
const manualNamedRegistry = new Map<string, (props: Record<string, unknown>) => Element>()
const artifactBase = assertAtomicCssArtifact(cipoCss`display:inline-flex;align-items:center;gap:8px;`)
const artifactDanger = assertAtomicCssArtifact(cipoCss`color:$brand;`)
const ArtifactStyledButton = cipoStyled.button('BenchmarkArtifactButton', { collision: 'replace' })(artifactBase)
const ArtifactComposedButton = cipoStyled.button('BenchmarkArtifactComposed', { collision: 'replace' })([
  artifactBase,
  (props) => Boolean(props.danger) && artifactDanger,
])
let styledRegistrationId = 0

export const manualCreateElementAdapter: FabricaBenchmarkAdapter = {
  id: 'manual.createElement',
  label: 'Manual document.createElement',
  run: runManualCase,
}

export const fabricaHtmlAdapter: FabricaBenchmarkAdapter = {
  id: 'fabrica.html',
  label: 'Fabrica html/render',
  run: runFabricaCase,
}

/**
 * Built-in adapters. Add another adapter here, or spread this array in
 * `fabrica.bench.ts`, to compare React, Preact, Solid or another renderer later.
 */
export const FABRICA_BENCHMARK_ADAPTERS: readonly FabricaBenchmarkAdapter[] = Object.freeze([
  manualCreateElementAdapter,
  fabricaHtmlAdapter,
])

function runManualCase(caseId: FabricaBenchmarkCaseId): void {
  switch (caseId) {
    case 'static-tree': return manualStaticTree()
    case 'complex-attributes': return manualComplexAttributes()
    case 'nested-components': return manualNestedComponents()
    case 'reactive-text': return manualReactiveText()
    case 'reactive-class-style': return manualReactiveClassStyle()
    case 'conditional-component': return manualConditionalComponent()
    case 'spread-props-events': return manualSpreadPropsEvents()
    case 'keyed-list-update': return manualKeyedListUpdate()
    case 'virtual-list-window': return manualVirtualListWindow()
    case 'portal-mount': return manualPortalMount()
    case 'raw-html': return manualRawHtml()
    case 'two-way-bind': return manualTwoWayBind()
    case 'named-styled-registry': return manualNamedStyledRegistry()
    case 'styled-component-registration': return manualStyledComponentRegistration()
    case 'styled-artifact-render': return manualStyledArtifactRender()
    case 'styled-artifact-composition': return manualStyledArtifactComposition()
  }
}

function runFabricaCase(caseId: FabricaBenchmarkCaseId): void {
  switch (caseId) {
    case 'static-tree': return fabricaStaticTree()
    case 'complex-attributes': return fabricaComplexAttributes()
    case 'nested-components': return fabricaNestedComponents()
    case 'reactive-text': return fabricaReactiveText()
    case 'reactive-class-style': return fabricaReactiveClassStyle()
    case 'conditional-component': return fabricaConditionalComponent()
    case 'spread-props-events': return fabricaSpreadPropsEvents()
    case 'keyed-list-update': return fabricaKeyedListUpdate()
    case 'virtual-list-window': return fabricaVirtualListWindow()
    case 'portal-mount': return fabricaPortalMount()
    case 'raw-html': return fabricaRawHtml()
    case 'two-way-bind': return fabricaTwoWayBind()
    case 'named-styled-registry': return fabricaNamedStyledRegistry()
    case 'styled-component-registration': return fabricaStyledComponentRegistration()
    case 'styled-artifact-render': return fabricaStyledArtifactRender()
    case 'styled-artifact-composition': return fabricaStyledArtifactComposition()
  }
}

function createHost(): HTMLDivElement {
  return document.createElement('div')
}

function manualStaticTree(): void {
  const host = createHost()
  const article = document.createElement('article')
  article.className = 'bench-card'
  article.dataset.kind = 'static'
  const header = document.createElement('header')
  const title = document.createElement('h2')
  title.textContent = 'Fabrica benchmark'
  const subtitle = document.createElement('p')
  subtitle.textContent = 'Browser-first fine-grained DOM runtime'
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = 'Open'
  header.append(title, subtitle)
  article.append(header, button)
  host.append(article)
  host.replaceChildren()
}

function fabricaStaticTree(): void {
  const host = createHost()
  const dispose = render(host, html`
    <article class="bench-card" data-kind="static">
      <header>
        <h2>Fabrica benchmark</h2>
        <p>Browser-first fine-grained DOM runtime</p>
      </header>
      <button type="button">Open</button>
    </article>
  `)
  dispose()
}

function manualComplexAttributes(): void {
  const host = createHost()
  const tone = 'danger'
  const label = 'Inspector'
  const button = document.createElement('button')
  button.className = `ra-button ra-button-${tone}`
  button.title = `Open ${label} panel`
  button.setAttribute('aria-label', `Toolbar ${label}`)
  button.dataset.command = 'inspect'
  button.disabled = false
  button.style.setProperty('--tone', tone)
  button.style.opacity = '0.92'
  button.textContent = label
  host.append(button)
  host.replaceChildren()
}

function fabricaComplexAttributes(): void {
  const host = createHost()
  const tone = 'danger'
  const label = 'Inspector'
  const dispose = render(host, html`
    <button
      class="ra-button ra-button-${tone}"
      title="Open ${label} panel"
      aria-label="Toolbar ${label}"
      data-command=${'inspect'}
      .disabled=${false}
      style="--tone:${tone};opacity:${0.92}"
    >${label}</button>
  `)
  dispose()
}

function manualNestedComponents(): void {
  const host = createHost()
  const nav = document.createElement('nav')
  nav.append(
    createManualToolbarButton('Refresh', 'neutral', '↻'),
    createManualToolbarButton('Pick', 'accent', '⌖'),
    createManualToolbarButton('Wrap', 'neutral', '↩'),
  )
  host.append(nav)
  host.replaceChildren()
}

function fabricaNestedComponents(): void {
  const host = createHost()
  const noop = (): void => undefined
  const dispose = render(host, html`
    <nav>
      <${ToolbarButton} icon=${html`<i>↻</i>`} label="Refresh" tone="neutral" onClick=${noop} />
      <${ToolbarButton} icon=${html`<i>⌖</i>`} label="Pick" tone="accent" onClick=${noop} />
      <${ToolbarButton} icon=${html`<i>↩</i>`} label="Wrap" tone="neutral" onClick=${noop} />
    </nav>
  `)
  dispose()
}

function createManualToolbarButton(label: string, tone: string, iconText: string): HTMLButtonElement {
  const button = document.createElement('button')
  button.className = `bench-button bench-button-${tone}`
  button.title = `Open ${label} panel`
  button.setAttribute('aria-label', `Toolbar ${label}`)
  const icon = document.createElement('span')
  icon.className = 'bench-icon'
  icon.textContent = iconText
  const text = document.createElement('span')
  text.className = 'bench-label'
  text.textContent = label
  button.append(icon, text)
  return button
}

function manualReactiveText(): void {
  const host = createHost()
  const span = document.createElement('span')
  const text = document.createTextNode('0')
  span.append(text)
  host.append(span)
  for (let index = 1; index <= 12; index += 1) text.data = String(index)
  host.replaceChildren()
}

function fabricaReactiveText(): void {
  const host = createHost()
  const count = signal(0)
  const dispose = render(host, html`<span>${count}</span>`)
  for (let index = 1; index <= 12; index += 1) {
    count.set(index)
    flushSync()
  }
  dispose()
}

function manualReactiveClassStyle(): void {
  const host = createHost()
  const element = document.createElement('div')
  host.append(element)
  for (let index = 0; index < 10; index += 1) {
    const active = index % 2 === 0
    element.className = active ? 'active shared' : 'inactive shared'
    element.style.opacity = active ? '1' : '0.5'
    element.style.transform = `translateX(${active ? 1 : 0}px)`
  }
  host.replaceChildren()
}

function fabricaReactiveClassStyle(): void {
  const host = createHost()
  const active = signal(true)
  const dispose = render(host, html`
    <div
      class=${() => classMap({ active: active(), inactive: !active(), shared: true })}
      style=${() => styleMap({ opacity: active() ? '1' : '0.5', transform: `translateX(${active() ? 1 : 0}px)` })}
    ></div>
  `)
  for (let index = 0; index < 10; index += 1) {
    active.set(index % 2 === 0)
    flushSync()
  }
  dispose()
}

function manualConditionalComponent(): void {
  const host = createHost()
  let panel: HTMLElement | null = createManualPanel('Elements')
  host.append(panel)
  for (let index = 0; index < 8; index += 1) {
    if (panel) {
      panel.remove()
      panel = null
    } else {
      panel = createManualPanel('Elements')
      host.append(panel)
    }
  }
  host.replaceChildren()
}

function fabricaConditionalComponent(): void {
  const host = createHost()
  const visible = signal(true)
  const dispose = render(host, html`${() => visible() && ConditionalPanel({ label: 'Elements' })}`)
  for (let index = 0; index < 8; index += 1) {
    visible.update((value) => !value)
    flushSync()
  }
  dispose()
}

function createManualPanel(label: string): HTMLElement {
  const panel = document.createElement('aside')
  panel.className = 'bench-panel'
  const strong = document.createElement('strong')
  strong.textContent = label
  const paragraph = document.createElement('p')
  paragraph.textContent = 'Ready'
  panel.append(strong, paragraph)
  return panel
}

function manualSpreadPropsEvents(): void {
  const host = createHost()
  const button = document.createElement('button')
  const first = (): void => undefined
  const second = (): void => undefined
  button.className = 'first'
  button.dataset.mode = 'one'
  button.addEventListener('click', first)
  host.append(button)
  button.className = 'second'
  delete button.dataset.mode
  button.disabled = true
  button.removeEventListener('click', first)
  button.addEventListener('click', second)
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  button.removeEventListener('click', second)
  host.replaceChildren()
}

function fabricaSpreadPropsEvents(): void {
  const host = createHost()
  const first = (): void => undefined
  const second = (): void => undefined
  const props = signal<Record<string, unknown>>({
    class: 'first',
    disabled: false,
    dataset: { mode: 'one' },
    onClick: first,
  })
  const dispose = render(host, html`<button ...${props}>Spread</button>`)
  props.set({ class: 'second', disabled: true, onClick: second })
  flushSync()
  host.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  dispose()
}

function createRows(count: number): Array<{ id: number; label: string }> {
  const rows = new Array<{ id: number; label: string }>(count)
  for (let index = 0; index < count; index += 1) rows[index] = { id: index, label: `Row ${index}` }
  return rows
}

function manualKeyedListUpdate(): void {
  const host = createHost()
  const list = document.createElement('ul')
  host.append(list)
  const rows = createRows(60)
  list.replaceChildren(...rows.map(createManualRow))
  const next = rows.map((row) => row.id % 11 === 0 ? { ...row, label: `${row.label}!` } : row).reverse()
  list.replaceChildren(...next.map(createManualRow))
  host.replaceChildren()
}

function fabricaKeyedListUpdate(): void {
  const host = createHost()
  const initial = createRows(60)
  const rows = signal(initial)
  const dispose = render(host, html`
    <ul>${repeat(rows, (row) => row.id, ({ item }) => html`<li data-id=${() => item().id}>${() => item().label}</li>`)}</ul>
  `)
  rows.set(initial.map((row) => row.id % 11 === 0 ? { ...row, label: `${row.label}!` } : row).reverse())
  flushSync()
  dispose()
}

function createManualRow(row: { id: number; label: string }): HTMLLIElement {
  const item = document.createElement('li')
  item.dataset.id = String(row.id)
  item.textContent = row.label
  return item
}

function manualVirtualListWindow(): void {
  const host = createHost()
  const scroller = document.createElement('div')
  scroller.style.overflow = 'auto'
  scroller.style.maxHeight = '240px'
  const rows = createRows(1000)
  for (let index = 0; index < 24; index += 1) scroller.append(createManualRow(rows[index]!))
  host.append(scroller)
  host.replaceChildren()
}

function fabricaVirtualListWindow(): void {
  const host = createHost()
  const rows = createRows(1000)
  const dispose = render(host, html`${virtualRepeat(rows, (row) => row.id, ({ item }) => html`<div>${() => item().label}</div>`, {
    itemHeight: 20,
    overscan: 4,
    height: 240,
  })}`)
  dispose()
}

function manualPortalMount(): void {
  const host = createHost()
  const target = createHost()
  const marker = document.createComment('portal-owner')
  const dialog = document.createElement('div')
  dialog.setAttribute('role', 'dialog')
  dialog.textContent = 'Inspector'
  host.append(marker)
  target.append(dialog)
  dialog.remove()
  marker.remove()
}

function fabricaPortalMount(): void {
  const host = createHost()
  const target = createHost()
  const dispose = render(host, html`${portal(target, html`<div role="dialog">Inspector</div>`)}`)
  dispose()
}

const RAW_MARKUP = '<section class="raw"><strong>Fast</strong><span data-value="42">HTML</span></section>'

function manualRawHtml(): void {
  const host = createHost()
  const template = document.createElement('template')
  template.innerHTML = RAW_MARKUP
  host.append(template.content)
  host.replaceChildren()
}

function fabricaRawHtml(): void {
  const host = createHost()
  const dispose = render(host, html`${rawHtml(RAW_MARKUP)}`)
  dispose()
}

function manualTwoWayBind(): void {
  const host = createHost()
  const input = document.createElement('input')
  let value = 'Rod'
  input.value = value
  const listener = (): void => { value = input.value }
  input.addEventListener('input', listener)
  host.append(input)
  input.value = 'Cipó'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  value = 'Fabrica'
  input.value = value
  input.removeEventListener('input', listener)
  host.replaceChildren()
}

function fabricaTwoWayBind(): void {
  const host = createHost()
  const value = signal('Rod')
  const dispose = render(host, html`<input .value=${bind(value)} />`)
  const input = host.querySelector('input') as HTMLInputElement
  input.value = 'Cipó'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  value.set('Fabrica')
  flushSync()
  dispose()
}


function manualNamedStyledRegistry(): void {
  const host = createHost()
  manualNamedRegistry.set('BenchmarkRegistryButton', (props) => {
    const button = document.createElement('button')
    button.type = props.type === 'submit' || props.type === 'reset' ? props.type : 'button'
    button.className = 'bench-registry-button'
    button.textContent = String(props.children || '')
    return button
  })
  const factory = manualNamedRegistry.get('BenchmarkRegistryButton')!
  host.append(factory({ type: 'button', children: 'Save' }))
  host.replaceChildren()
}

function fabricaNamedStyledRegistry(): void {
  const host = createHost()
  const dispose = render(host, html`<BenchmarkRegistryButton type="button">Save</BenchmarkRegistryButton>`)
  dispose()
}

function manualStyledComponentRegistration(): void {
  const name = `ManualStyled${++styledRegistrationId}`
  const className = 'bench-registry-class'
  const component = (props: Record<string, unknown> = {}) => {
    const button = document.createElement('button')
    button.className = className
    button.textContent = String(props.children || '')
    return button
  }
  manualNamedRegistry.set(name, component)
  manualNamedRegistry.delete(name)
}

function fabricaStyledComponentRegistration(): void {
  const name = `FabricaStyled${++styledRegistrationId}`
  const Styled = cipoStyledButton(name, { collision: 'replace' }).css`
    px: 2
    bg: $brand
  `
  Styled.unregister()
}



function manualStyledArtifactRender(): void {
  const button = document.createElement('button')
  button.className = artifactBase.className
  button.textContent = 'Brand'
  button.remove()
}

function fabricaStyledArtifactRender(): void {
  const button = ArtifactStyledButton({ children: 'Brand' }) as Element
  button.remove()
}

function manualStyledArtifactComposition(): void {
  const button = document.createElement('button')
  button.className = `${artifactBase.className} ${artifactDanger.className}`
  button.textContent = 'Delete'
  button.remove()
}

function fabricaStyledArtifactComposition(): void {
  const button = ArtifactComposedButton({ danger: true, children: 'Delete' }) as Element
  button.remove()
}

void RegistryStyledButton
