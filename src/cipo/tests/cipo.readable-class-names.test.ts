import { beforeEach, describe, expect, it } from 'vitest'
import { css, reset, setup } from '../src/index'

beforeEach(() => {
  reset()
  setup({
    prefix: 'debug',
    debug: true,
    minify: true,
    layers: false,
    theme: { colors: { brand: '#38bdf8' }, spacing: '0.25rem' },
  })
})

describe('Cipó readable atomic class names', () => {
  it('uses property and resolved value labels in debug mode', () => {
    const artifact = css`background-attachment: fixed;`
    expect(String(artifact)).toMatch(/^debug-background-attachment-fixed-[a-z0-9]+$/)
  })

  it('includes useful responsive, pseudo and dark context labels', () => {
    const artifact = css`
      x:hover { color: red }
      x:md { display: grid }
      x:dark { background: $brand }
    `

    expect(String(artifact)).toContain('debug-hover-color-red-')
    expect(String(artifact)).toContain('debug-md-display-grid-')
    expect(String(artifact)).toContain('debug-dark-background-var-debug-colors-brand-')
  })

  it('keeps the hash deterministic for cache, snapshots and hydration', () => {
    const first = String(css`display:flex;`)
    const second = String(css`display:flex;`)
    expect(second).toBe(first)
  })

  it('redacts URLs and quoted content from readable labels', () => {
    const artifact = css`
      background-image: url("https://private.example/token/image.png")
      content: "private customer label"
    `
    const className = String(artifact)

    expect(className).toContain('background-image-url-')
    expect(className).toContain('content-string-')
    expect(className).not.toContain('private')
    expect(className).not.toContain('token')
  })

  it('respects label length and optional context controls', () => {
    setup({
      debug: {
        enabled: true,
        readableClassNames: true,
        maxClassLabelLength: 32,
        includeContext: false,
      },
    })
    const atom = css`grid-template-columns: repeat(12, minmax(0, 1fr));`
    const className = String(atom)
    const withoutPrefixAndHash = className.replace(/^debug-/, '').replace(/-[a-z0-9]+$/, '')

    expect(withoutPrefixAndHash.length).toBeLessThanOrEqual(32)
    expect(className).not.toContain('media-')
  })

  it('preserves compact production names when debug is disabled', () => {
    setup({ debug: false })
    expect(String(css`background-attachment:fixed;`)).toMatch(/^debug-a-[a-z0-9]+$/)
  })

  it('allows diagnostics with readable names explicitly disabled', () => {
    setup({ debug: { enabled: true, readableClassNames: false } })
    expect(String(css`display:grid;`)).toMatch(/^debug-a-[a-z0-9]+$/)
  })
})
