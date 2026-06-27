/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import Fabrica, {
  clearComponents,
  createComponentPack,
  createFabrica,
  createRegistry,
  defineComponent,
  getOrCreateFabrica,
  registerComponent,
} from '../index'
import { resetDeprecationWarnings } from '../deprecations'

beforeEach(() => {
  document.body.replaceChildren()
  clearComponents()
  resetDeprecationWarnings()
})

describe('Fabrica instances and portable components', () => {
  it('uses component(name, factory) as the minifier-safe primary API', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const local = createFabrica({ name: 'primary-api' })

    const Badge = local.component('Badge', (props, ctx) => ctx.html`<strong>${props.children}</strong>`)
    const host = document.createElement('div')
    local.render(host, local.html`<Badge>Ready</Badge>`)

    expect(local.resolveComponent('Badge')).toBe(Badge)
    expect(host.textContent).toBe('Ready')
    expect(warning).not.toHaveBeenCalled()
    warning.mockRestore()
  })

  it('isolates identical component names between instances', () => {
    const red = createFabrica({ name: 'red' })
    const blue = createFabrica({ name: 'blue' })

    red.component('Badge', (_props, ctx) => ctx.html`<span data-runtime="red">Red</span>`)
    blue.component('Badge', (_props, ctx) => ctx.html`<span data-runtime="blue">Blue</span>`)

    const redHost = document.createElement('div')
    const blueHost = document.createElement('div')
    red.render(redHost, red.html`<Badge />`)
    blue.render(blueHost, blue.html`<Badge />`)

    expect(redHost.querySelector('span')?.dataset.runtime).toBe('red')
    expect(blueHost.querySelector('span')?.dataset.runtime).toBe('blue')
  })

  it('avoids duplicate fork entries for the same inherited definition', () => {
    const parent = createRegistry({ name: 'dedupe-parent' })
    const child = parent.fork('dedupe-child')
    const Shared = defineComponent('Shared', (_props, ctx) => ctx.html`<span></span>`)

    parent.register('Shared', Shared)
    const versionBefore = child.version
    child.register('Shared', Shared)

    expect(child.has('Shared', true)).toBe(false)
    expect(child.resolve('Shared')).toBe(Shared)
    expect(child.version).toBe(versionBefore)
  })

  it('rejects cyclic registry parent graphs', () => {
    const first = createRegistry({ name: 'cycle-first' })
    const second = createRegistry({ name: 'cycle-second', parent: first })

    expect(() => first.setParent(second)).toThrow(/cycles/)
  })

  it('shares one live registry across independent renderers', () => {
    const registry = createRegistry({ name: 'shared-ui' })
    const shell = createFabrica({ name: 'shell', registry })
    const storage = createFabrica({ name: 'storage', registry })

    shell.component('Button', (props, ctx) => ctx.html`<button>${props.children}</button>`)

    const host = document.createElement('div')
    storage.render(host, storage.html`<Button>Save</Button>`)

    expect(storage.resolveComponent('Button')).toBe(shell.resolveComponent('Button'))
    expect(host.querySelector('button')?.textContent).toBe('Save')
  })

  it('honors isolated mode even when a shared registry is supplied', () => {
    const shared = createRegistry({ name: 'shared-but-ignored' })
    const source = createFabrica({ name: 'source', registry: shared })
    source.component('SharedOnly', (_props, ctx) => ctx.html`<span>shared</span>`)

    const isolated = createFabrica({
      name: 'explicit-isolated',
      registry: shared,
      isolated: true,
    })

    expect(isolated.registry).not.toBe(shared)
    expect(isolated.resolveComponent('SharedOnly')).toBeUndefined()
  })

  it('returns the same realm-wide instance for getOrCreate', () => {
    const first = getOrCreateFabrica('@tests/shared-instance', { name: 'first-name' })
    const second = Fabrica.getOrCreate('@tests/shared-instance', { name: 'ignored-name' })

    expect(second).toBe(first)
    expect(second.id).toBe(first.id)
  })

  it('supports reference, snapshot, fork and isolated registry modes', () => {
    const parent = createFabrica({ name: 'parent' })
    parent.component('Base', (_props, ctx) => ctx.html`<span>base</span>`)

    const reference = parent.fork({ name: 'reference', registry: 'reference' })
    const snapshot = parent.fork({ name: 'snapshot', registry: 'snapshot' })
    const forked = parent.fork({ name: 'forked', registry: 'fork' })
    const isolated = parent.fork({ name: 'isolated', registry: 'isolated' })

    parent.component('Later', (_props, ctx) => ctx.html`<span>later</span>`)

    expect(reference.resolveComponent('Later')).toBeDefined()
    expect(snapshot.resolveComponent('Later')).toBeUndefined()
    expect(forked.resolveComponent('Later')).toBeDefined()
    expect(isolated.resolveComponent('Base')).toBeUndefined()

    forked.component('Base', (_props, ctx) => ctx.html`<span>override</span>`)
    expect(forked.resolveComponent('Base')).not.toBe(parent.resolveComponent('Base'))
    expect(parent.resolveComponent('Base')).toBe(reference.resolveComponent('Base'))
  })

  it('installs one portable definition into multiple isolated instances', () => {
    const PortableCard = defineComponent<{ label: string }>('PortableCard', (props, ctx) => {
      return ctx.html`<article data-instance=${(ctx.instance as { name: string }).name}>${props.label}</article>`
    })
    const first = createFabrica({ name: 'portable-a' })
    const second = createFabrica({ name: 'portable-b' })

    first.use(PortableCard)
    second.use(PortableCard)

    const firstHost = document.createElement('div')
    const secondHost = document.createElement('div')
    first.render(firstHost, first.html`<PortableCard label="A" />`)
    second.render(secondHost, second.html`<PortableCard label="B" />`)

    expect(firstHost.querySelector('article')?.dataset.instance).toBe('portable-a')
    expect(secondHost.querySelector('article')?.dataset.instance).toBe('portable-b')
    expect(firstHost.textContent).toBe('A')
    expect(secondHost.textContent).toBe('B')
  })

  it('installs component packs with namespaces and filters', () => {
    const Button = defineComponent('Button', (_props, ctx) => ctx.html`<button>button</button>`)
    const Modal = defineComponent('Modal', (_props, ctx) => ctx.html`<dialog>modal</dialog>`)
    const UI = createComponentPack('UI', { Button, Modal })
    const local = createFabrica({ name: 'pack' })

    local.use(UI, { namespace: 'Storage', include: ['Button'] })

    expect(local.resolveComponent('StorageButton')).toBe(Button)
    expect(local.resolveComponent('StorageModal')).toBeUndefined()
  })

  it('keeps legacy registration working while warning once', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const Legacy = defineComponent('Legacy', (_props, ctx) => ctx.html`<span>legacy</span>`)

    registerComponent('LegacyAlias', Legacy)
    registerComponent('LegacyAlias', Legacy)

    const host = document.createElement('div')
    Fabrica.render(host, Fabrica.html`<LegacyAlias />`)

    expect(host.textContent).toBe('legacy')
    expect(warning).toHaveBeenCalledTimes(1)
    expect(warning.mock.calls[0]?.[0]).toContain('deprecated')
    warning.mockRestore()
  })

  it('warns for implicit function-name registration and recommends explicit names', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    Fabrica.component(function ImplicitLegacy(_props, ctx) {
      return ctx.html`<span>legacy</span>`
    })

    expect(Fabrica.resolveComponent('ImplicitLegacy')).toBeDefined()
    expect(warning).toHaveBeenCalledTimes(1)
    expect(warning.mock.calls[0]?.[0]).toContain('component("Name", factory)')
    warning.mockRestore()
  })
})
