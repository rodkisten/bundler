import { beforeEach, describe, expect, it } from 'vitest'
import { reset } from '@rodkisten/cipo'
import { compileCipoSourceBuild } from '@rodkisten/cipo/compiler'
import { compileGlobalAtomicStyles } from '@rodkisten/cipo/compiler'
import { runtime } from '../runtime'

const MINIFIED_CONFIG = `
  @cipo {
    prefix: rd;
    debug: false;
    layers: false;
    minify: true;
    atomic-min-uses: 2;
  }
`

const SEMANTIC_CONFIG = `
  @cipo {
    prefix: rd;
    debug: true;
    layers: false;
    minify: true;
    atomic-min-uses: 2;
  }
`

beforeEach(() => {
  reset()
})

describe('Cipó whole-build atomic promotion', () => {
  it('enables atomic promotion at two uses by default', () => {
    expect(runtime.config.atomic.minUses).toBe(2)
  })

  it('promotes declarations reused by two components and keeps one-off declarations scoped', () => {
    const first = compileCipoSourceBuild(`
      export const First = styled.div('First').css\`
        display: flex;
        color: red;
      \`
    `, {
      filename: '/project/first.ts',
      configCss: MINIFIED_CONFIG,
      deferAtomicCss: true,
      injectCssImport: false,
      styledCssHelperImportPath: '@rodkisten/cipo/compiled-runtime',
    })
    const second = compileCipoSourceBuild(`
      export const Second = styled.div('Second').css\`
        display: flex;
        color: blue;
      \`
    `, {
      filename: '/project/second.ts',
      configCss: MINIFIED_CONFIG,
      deferAtomicCss: true,
      injectCssImport: false,
      styledCssHelperImportPath: '@rodkisten/cipo/compiled-runtime',
    })

    const entries = [...first.manifest, ...second.manifest]
    const result = compileGlobalAtomicStyles(entries.map((entry) => ({
      key: entry.id,
      className: entry.className,
      rawCss: entry.rawCss,
      filename: entry.filename,
      receiver: entry.receiver,
    })), { configCss: MINIFIED_CONFIG })

    const firstClassName = result.classNames.get(first.manifest[0]!.className) ?? ''
    const secondClassName = result.classNames.get(second.manifest[0]!.className) ?? ''
    const firstClasses = firstClassName.split(/\s+/)
    const secondClasses = secondClassName.split(/\s+/)
    const sharedAtoms = firstClasses.filter((className) => className.startsWith('a') && secondClasses.includes(className))

    expect(first.code).toContain('attachCompiledClass')
    expect(first.code).not.toContain('display:flex')
    expect(first.code).not.toContain('color:red')
    expect(first.css).toBe('')
    expect(second.css).toBe('')
    expect(sharedAtoms).toHaveLength(1)
    expect(firstClasses.some((className) => className.startsWith('s'))).toBe(true)
    expect(secondClasses.some((className) => className.startsWith('s'))).toBe(true)
    expect(result.css.match(/display:flex/g)).toHaveLength(1)
    expect(result.css.match(/color:red/g)).toHaveLength(1)
    expect(result.css.match(/color:blue/g)).toHaveLength(1)
  })

  it('keeps semantic atomic labels when CSS-first debug mode is enabled', () => {
    const entries = ['One', 'Two'].flatMap((name) => compileCipoSourceBuild(`
      const ${name} = styled.div('${name}').css\`display:flex;\`
    `, {
      filename: `/project/${name.toLowerCase()}.ts`,
      configCss: SEMANTIC_CONFIG,
      deferAtomicCss: true,
      injectCssImport: false,
      styledCssHelperImportPath: '@rodkisten/cipo/compiled-runtime',
    }).manifest)

    const result = compileGlobalAtomicStyles(entries.map((entry) => ({
      key: entry.id,
      className: entry.className,
      rawCss: entry.rawCss,
      filename: entry.filename,
      receiver: entry.receiver,
    })), { configCss: SEMANTIC_CONFIG })

    const className = result.classNames.get(entries[0]!.className) ?? ''
    expect(className).toMatch(/rd-display-flex-/)
    expect(result.minifiedClassNames).toBe(false)
  })
})
