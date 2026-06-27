/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest'
import { createStyledFactory } from './styled'
import { notifyFabricaRegistryReady } from './registry'
import type { ElementsComponent, ElementsComponentRegistry } from './types'

function createRegistry(initial: Record<string, ElementsComponent> = {}): ElementsComponentRegistry & { values: Map<string, ElementsComponent> } {
  const values = new Map<string, ElementsComponent>(Object.entries(initial))
  return {
    values,
    registerComponent(name, component) {
      values.set(name, component)
      return component
    },
    unregisterComponent(name) {
      return values.delete(name)
    },
    resolveComponent(name) {
      return values.get(name)
    },
  }
}

function createFactory(registry?: ElementsComponentRegistry, collision: 'warn' | 'replace' | 'error' | 'ignore' = 'warn') {
  let id = 0
  return createStyledFactory<{ id: number }>({
    adapter: 'dom',
    autoRegister: true,
    collision,
    registry,
    createStyle() {
      id += 1
      return { className: `styled-${id}`, artifact: { id } }
    },
  })
}

describe('Fabrica Elements named styled registry', () => {
  it('auto-registers named tag components and exposes production metadata', () => {
    const registry = createRegistry()
    const styled = createFactory(registry)
    const Button = styled.button('Button').css`display: inline-flex;`

    expect(registry.values.get('Button')).toBe(Button)
    expect(Button.displayName).toBe('Button')
    expect(Button.registeredName).toBe('Button')
    expect(Button.tag).toBe('button')
    expect(Button.className).toBe('styled-1')
    expect(String(Button)).toBe('styled-1')
    expect(Button.artifact).toEqual({ id: 1 })
  })

  it('supports direct styled syntax, attrs functions and polymorphic as', () => {
    const registry = createRegistry()
    const styled = createFactory(registry)
    const Action = styled.button('Action', {
      attrs: (props) => ({ type: 'button', 'aria-label': props.label }),
    })`display: inline-flex;`

    const button = Action({ label: 'Save', children: 'Save' }) as HTMLButtonElement
    expect(button.tagName).toBe('BUTTON')
    expect(button.type).toBe('button')
    expect(button.getAttribute('aria-label')).toBe('Save')
    expect(button.className).toBe('styled-1')

    const link = Action({ as: 'a', href: '/settings', label: 'Settings', children: 'Settings' }) as HTMLAnchorElement
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('/settings')
    expect(link.hasAttribute('as')).toBe(false)
  })

  it('preserves the anonymous backwards-compatible API', () => {
    const registry = createRegistry()
    const styled = createFactory(registry)
    const Anonymous = styled.button.css`display: block;`
    const DirectAnonymous = styled.div`display: grid;`

    expect(Anonymous({ children: 'A' })).toBeInstanceOf(HTMLButtonElement)
    expect(DirectAnonymous({ children: 'B' })).toBeInstanceOf(HTMLDivElement)
    expect(registry.values.size).toBe(0)
  })

  it('queues named components and flushes them when Fabrica connects later', () => {
    const styled = createFactory()
    const Panel = styled.section('DeferredPanel').css`display: grid;`

    expect(styled.pendingComponents()).toEqual(['DeferredPanel'])
    const registry = createRegistry()
    expect(styled.connectRegistry(registry)).toBe(1)
    expect(registry.values.get('DeferredPanel')).toBe(Panel)
    expect(styled.pendingComponents()).toEqual([])
  })


  it('flushes queued components through the cross-bundle registry-ready handshake', () => {
    const styled = createFactory()
    const Dialog = styled.dialog('DeferredDialog').css`display: grid;`
    const registry = createRegistry()

    notifyFabricaRegistryReady(registry)

    expect(registry.values.get('DeferredDialog')).toBe(Dialog)
    expect(styled.pendingComponents()).toEqual([])
  })

  it('implements warn, ignore, replace and error collision policies', () => {
    const Existing = (() => null) as ElementsComponent
    const warnings: string[] = []
    const registry = createRegistry({ Existing })
    const styled = createStyledFactory({
      adapter: 'dom',
      autoRegister: true,
      collision: 'warn',
      registry,
      onWarning(message) { warnings.push(message) },
      createStyle() { return { className: 'x', artifact: null } },
    })

    const Warned = styled.button('Existing').css`display:block;`
    expect(registry.values.get('Existing')).toBe(Existing)
    expect(warnings).toHaveLength(1)
    expect(Warned.register('Existing', 'ignore')).toBe('ignored')
    expect(Warned.register('Existing', 'replace')).toBe('replaced')
    expect(registry.values.get('Existing')).toBe(Warned)

    registry.values.set('Existing', Existing)
    expect(() => Warned.register('Existing', 'error')).toThrow(/collision/i)
  })

  it('styles and registers existing components without changing their prop contract', () => {
    const registry = createRegistry()
    const styled = createFactory(registry)
    const Base = vi.fn((props = {}) => ({ kind: 'base', props }))
    const Wrapped = styled(Base).named('WrappedButton').css`display:flex;`
    const output = Wrapped({ class: 'extra', value: 42 }) as { kind: string; props: Record<string, unknown> }

    expect(registry.values.get('WrappedButton')).toBe(Wrapped)
    expect(output.kind).toBe('base')
    expect(output.props.class).toBe('extra styled-1')
    expect(output.props.value).toBe(42)
  })

  it('provides an explicit component(name, { as }) facade', () => {
    const registry = createRegistry()
    const styled = createFactory(registry)
    const Card = styled.component('Card', { as: 'article', attrs: { role: 'region' } }).css`display:grid;`
    const node = Card({ children: 'Content' }) as HTMLElement

    expect(registry.values.get('Card')).toBe(Card)
    expect(node.tagName).toBe('ARTICLE')
    expect(node.getAttribute('role')).toBe('region')
  })
})

describe('Fabrica Elements polymorphic style inputs', () => {
  type Artifact = { id: string; className: string }

  function createArtifactFactory() {
    return createStyledFactory<Artifact>({
      adapter: 'dom',
      createStyle() {
        const artifact = { id: 'template', className: 'template-class' }
        return { className: artifact.className, artifact }
      },
      resolveStyle(input) {
        const artifact = input as Artifact
        return { className: artifact.className, artifact }
      },
    })
  }

  it('resolves static artifacts, arrays and prop-driven conditional artifacts', () => {
    const styled = createArtifactFactory()
    const base = { id: 'base', className: 'base-class' }
    const danger = { id: 'danger', className: 'danger-class' }
    const Button = styled.button('ArtifactButton')([
      base,
      (props) => Boolean(props.danger) && danger,
    ])

    expect(Button.className).toBe('base-class')
    expect(Button.artifact).toBe(base)
    expect(Button.artifacts).toEqual([base])
    expect(Button.dynamicStyles).toBe(true)

    const safe = Button({ children: 'Safe' }) as HTMLButtonElement
    const destructive = Button({ danger: true, children: 'Delete' }) as HTMLButtonElement
    expect(safe.className).toBe('base-class')
    expect(destructive.className).toBe('base-class danger-class')
  })

  it('styles an existing DOM element from a precompiled artifact', () => {
    const styled = createArtifactFactory()
    const element = document.createElement('div')
    const artifact = { id: 'existing', className: 'existing-class' }
    const result = styled(element)(artifact)

    expect(result.element).toBe(element)
    expect(result.className).toBe('existing-class')
    expect(result.artifact).toBe(artifact)
    expect(element.className).toBe('existing-class')
  })
})
