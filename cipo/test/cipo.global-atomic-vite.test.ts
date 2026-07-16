import { describe, expect, it } from 'vitest'
import { cipoVite } from '@rodkisten/cipo/vite-compiled-inline'

const CONFIG = `
  @cipo {
    prefix: test;
    debug: false;
    layers: false;
    minify: true;
    atomic-min-uses: 2;
  }
`

describe('Cipó Vite whole-build atomic output', () => {
  it('collects styled CSS across modules and renders one consolidated stylesheet', async () => {
    const plugin = cipoVite({
      root: '/project',
      mode: 'build',
      configCss: CONFIG,
      compileFabrica: false,
      transformCssTag: true,
      cssDelivery: 'style-tag',
    })
    const transform = plugin.transform as unknown as (
      this: unknown,
      code: string,
      id: string,
    ) => Promise<{ code: string } | null> | { code: string } | null
    const renderChunk = plugin.renderChunk as unknown as (
      this: unknown,
      code: string,
    ) => Promise<{ code: string } | null> | { code: string } | null

    const first = await transform.call({}, `
      const First = styled.div('First').css\`
        display: flex;
        color: red;
      \`
    `, '/project/first.ts')
    const second = await transform.call({}, `
      const Second = styled.div('Second').css\`
        display: flex;
        color: blue;
      \`
    `, '/project/second.ts')

    expect(first?.code).toContain('attachCompiledClass')
    expect(second?.code).toContain('attachCompiledClass')
    expect(first?.code).not.toContain('display:flex')
    expect(second?.code).not.toContain('display:flex')

    const chunk = [
      first?.code ?? '',
      second?.code ?? '',
      `insertCss("__CIPO_COMPILED_GLOBAL_STYLESHEET__")`,
    ].join('\n')
    const rendered = await renderChunk.call({}, chunk)
    const code = rendered?.code ?? chunk

    expect(code).not.toContain('__CIPO_COMPILED_GLOBAL_STYLESHEET__')
    expect(code).not.toContain('.css`')
    expect(code.match(/display:flex/g)).toHaveLength(1)
    expect(code.match(/color:red/g)).toHaveLength(1)
    expect(code.match(/color:blue/g)).toHaveLength(1)
    expect(code).toMatch(/a[a-z0-9]+/)
    expect(code).toMatch(/s[a-z0-9]+/)
  })
})
