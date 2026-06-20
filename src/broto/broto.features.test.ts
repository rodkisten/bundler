import { describe, expect, it, vi } from 'vitest'
import { configureDebug, createRoot, effect, effectScope, inspectLeaks, resource, signal, store } from './index'

describe('Broto feature APIs', () => {
  it('creates disposable effect scopes', () => {
    const count = signal(0)
    const spy = vi.fn()
    const [value, dispose] = effectScope(() => {
      effect(() => spy(count()))
      return 'ready'
    }, 'test-scope')

    expect(value).toBe('ready')
    expect(spy).toHaveBeenCalledWith(0)
    count.set(1)
    dispose()
    count.set(2)
    expect(spy).not.toHaveBeenCalledWith(2)
  })

  it('mutates and polls resources', async () => {
    let value = 0
    const data = resource(async () => ++value, { immediate: false })
    expect(data.mutate(10)).toBe(10)
    expect(data().value).toBe(10)
    await data.reload()
    expect(data().value).toBe(1)
    const stop = data.poll(1000)
    stop()
  })

  it('selects store values by path', () => {
    const state = store({ user: { name: 'Rod' }, count: 1 })
    expect(state.select(['user', 'name'])).toBe('Rod')
    state.setPath(['user', 'name'], 'Cipó')
    expect(state.select(['user', 'name'])).toBe('Cipó')
  })

  it('configures debug and reports leak shape', () => {
    configureDebug({ enabled: true, retainDisposed: false, maxEntries: 10 })
    const [_, dispose] = createRoot(() => 'ok', { name: 'leak-test' })
    dispose()
    const report = inspectLeaks()
    expect(Array.isArray(report.leaks)).toBe(true)
  })
})
