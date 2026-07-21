/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { configureFromCss, getCssText, reset, setup } from '@rodkisten/cipo'
import { compileCipoSourceBuild } from '@rodkisten/cipo/compiler'
import { cipoVite } from '@rodkisten/cipo/vite'
import Fabrica from '@rodkisten/fabrica'
import { compileFabricaSource } from '@rodkisten/fabrica/compiler'
import { createCompiledElement, createCompiledTemplate } from '@rodkisten/fabrica/compiler-runtime'

describe('Cipó + Fábrica compiled build mode', () => {
  it('compiles styled Cipó templates into real scoped CSS classes', () => {
    setup({ adapter: 'dom' })
    const source = `
      import { styled } from '@rodkisten/cipo'
      export const Panel = styled.div('Panel').css\`
        display: flex;
        gap: 8px;
        &:hover { opacity: 0.9; }
      \`
    `

    const result = compileCipoSourceBuild(source, {
      filename: '/project/src/devtools/panel.ts',
      classPrefix: 'cp',
      injectCssImport: false,
    })

    expect(result.changed).toBe(true)
    expect(result.code).toContain("styled.div('Panel')(")
    expect(result.code).not.toContain('.css`')
    expect(result.css).toContain('.cp-Panel-')
    expect(result.css).toContain('display:flex')
    expect(result.css).toContain(':hover')
    expect(result.manifest[0]?.kind).toBe('styled-css')
  })

  it('leaves dynamic Cipó templates on the runtime path', () => {
    const result = compileCipoSourceBuild("const Box = styled.div('Box').css`color: ${tone};`", {
      injectCssImport: false,
    })

    expect(result.changed).toBe(false)
    expect(result.css).toBe('')
  })

  it('compiles simple Fabrica html templates to compact runtime IR', () => {
    const result = compileFabricaSource("const view = html`<button class=\"save\">Salvar</button>`", {
      filename: '/project/src/view.ts',
      importPath: '@rodkisten/fabrica/compiler-runtime',
    })

    expect(result.changed).toBe(true)
    expect(result.code).toContain('createCompiledTemplate(html, [[0,"button"')
    expect(result.code).toContain('[0,"class","save"]')
    expect(result.manifest[0]?.tag).toBe('button')
  })

  it('creates DOM recursively with props, events and children', () => {
    let clicked = 0
    const node = createCompiledElement('button', { class: 'save', onClick: () => { clicked += 1 } }, 'Salvar') as HTMLButtonElement

    expect(node.tagName).toBe('BUTTON')
    expect(node.className).toBe('save')
    expect(node.textContent).toBe('Salvar')
    node.click()
    expect(clicked).toBe(1)
  })

  it('creates dynamic DOM templates with runtime-backed @event bindings', () => {
    let clicked = 0
    const view = createCompiledTemplate(Fabrica.html, ['<button @click=', '>Save ', '</button>'] as unknown as TemplateStringsArray, () => { clicked += 1 }, 'now')
    const button = view as HTMLButtonElement

    expect(button.tagName).toBe('BUTTON')
    expect(button.textContent).toBe('Save now')
    button.click()
    expect(clicked).toBe(1)
  })

  it('hydrates dynamic template spread props without emitting invalid attribute names', () => {
    let clicked = 0
    const view = createCompiledTemplate(Fabrica.html, ['<button ...', '>Save</button>'] as unknown as TemplateStringsArray, {
      type: 'button',
      class: 'spread',
      onClick: () => { clicked += 1 },
    })
    const button = view as HTMLButtonElement

    expect(button.type).toBe('button')
    expect(button.className).toBe('spread')
    expect(button.getAttribute('...%%fabrica_value_0%%')).toBeNull()
    button.click()
    expect(clicked).toBe(1)
  })

  it('compiles same-sheet Cipó config aliases and theme tokens without leaking DSL tokens', () => {
    const result = compileCipoSourceBuild(`
      import { sheet } from '@rodkisten/cipo'
      export const styles = sheet.css\`
        @cipo { prefix: rd; minify: true; }
        @theme { colors<color>: (primary: red); }
        @alias noScrollbar {
          scrollbar-width: none
          &::-webkit-scrollbar { display: none }
        }
        .panel {
          noScrollbar
          color: $primary
        }
      \`
    `, {
      filename: '/project/src/devtools/core/style.ts',
      injectCssImport: false,
    })

    expect(result.changed).toBe(true)
    expect(result.css).toContain('scrollbar-width:none')
    expect(result.css).toContain('color:var(--rd-colors-primary)')
    expect(result.css).not.toContain('noScrollbar')
    expect(result.css).not.toContain('$primary')
    expect(result.code).not.toContain('.css`')
    expect(result.code).not.toContain('$primary')
  })

  it('Vite plugin injects compiled CSS through Cipó runtime style tag and compiles Fabrica in build mode', async () => {
    const plugin = cipoVite({ root: '/project', mode: 'build', compileFabrica: true })
    const context = { emitFile: () => 'asset' } as never
    const transformed = await plugin.transform?.call(
      context,
      "const Card = styled.div('Card').css`color: red;`; const view = html`<section class=\"x\">Ok</section>`",
      '/project/src/devtools/card.ts',
    )

    const code = transformed && 'code' in transformed ? transformed.code : ''
    expect(code).toContain('attachCompiledCss')
    expect(code).not.toContain('.css`')
    expect(code).toContain('color:red')
    expect(code).toContain('createCompiledTemplate(html, [[0,"section"')
    const runtimeModule = plugin.load?.call(context, '\0cipo:compiled-style-tag.js')
    expect(runtimeModule).toContain('insertCss')
    expect(runtimeModule).toContain('__CIPO_COMPILED_GLOBAL_STYLESHEET__')
    expect(runtimeModule).not.toContain('color:red')
  })
  it('allows root publication builds to isolate compiled manifest filenames', () => {
    const emitted: Array<{ type: string; fileName?: string; source?: unknown }> = []
    const plugin = cipoVite({
      root: '/project',
      mode: 'build',
      manifestFileName: 'maquina.cipo.compiled.manifest.json',
      compileFabrica: false,
    })
    const context = {
      emitFile(asset: { type: string; fileName?: string; source?: unknown }) {
        emitted.push(asset)
        return 'asset'
      },
    } as never

    plugin.transform?.call(
      context,
      "const Card = styled.div('Card').css`color: red;`",
      '/project/src/maquina/card.ts',
    )
    const generateBundle = plugin.generateBundle
    if (typeof generateBundle === 'function') {
      generateBundle.call(context, {} as never, {} as never, false)
    } else {
      generateBundle?.handler.call(context, {} as never, {} as never, false)
    }

    expect(emitted).toContainEqual(expect.objectContaining({
      type: 'asset',
      fileName: 'maquina.cipo.compiled.manifest.json',
    }))
  })

  it('compiles dynamic Fabrica templates to runtime instruction payloads instead of template HTML strings', () => {
    const source = `
      const RodProbe = () => null
      const view = html` + '`' + `<RodProbe @click=${'${'}onClick} class="tone ${'${'}tone}" ref=${'${'}refCallback}>
        <button .value=${'${'}value}>${'${'}label}</button>
      </RodProbe>` + '`' + `
    `

    const result = compileFabricaSource(source, {
      filename: '/project/src/devtools/console.ts',
      importPath: '@rodkisten/fabrica/compiler-runtime',
      directComponentReferences: true,
    })

    expect(result.changed).toBe(true)
    expect(result.code).toContain('createCompiledTemplate(html, [[0,RodProbe')
    expect(result.code).not.toContain('\"RodProbe\"')
    expect(result.code).toContain('[2,\"class\"')
    expect(result.code).not.toContain('html`')
    expect(result.code).not.toContain('<RodProbe')
    expect(result.code).not.toContain('@click=')
    expect(result.code).not.toContain('ref=')
  })

  it('hydrates compiled instruction payloads with components, events, refs and property bindings', () => {
    let clicked = 0
    let refNode: Element | null = null
    const Probe = (props: Record<string, unknown>) => createCompiledElement(
      'section',
      { class: props.class, '@click': props['@click'], ref: props.ref },
      props.children as never,
    )

    const view = createCompiledTemplate(Fabrica.html, {
      nodes: [{
        type: 'element',
        tag: 'div',
        props: [],
        children: [{
          type: 'element',
          tag: 'button',
          props: [
            { type: 'value', name: '@click', index: 0 },
            { type: 'compound', name: 'class', strings: ['btn ', ''], indices: [1] },
            { type: 'value', name: 'ref', index: 2 },
            { type: 'value', name: '.value', index: 3 },
          ],
          children: [{ type: 'value', index: 4 }],
        }],
      }],
    }, () => { clicked += 1 }, 'primary', (node: Element) => { refNode = node }, 'typed value', 'Save')

    const button = view.querySelector('button') as HTMLButtonElement
    expect(button.className).toBe('btn primary')
    expect(button.value).toBe('typed value')
    expect(button.textContent).toBe('Save')
    expect(refNode).toBe(button)
    button.click()
    expect(clicked).toBe(1)
    expect(Probe).toBeTypeOf('function')
  })

  it('applies build-level Cipó config CSS before compiling styled panel templates', () => {
    const configCss = `
      @cipo { prefix: rd; minify: true; rem: 16px; }
      @theme {
        colors<color>: (
          background: var(--background),
          border: var(--border),
          primary: var(--primary)
        );
        radius<length>: (control: 6px);
      }
    `

    const result = compileCipoSourceBuild(`
      const Surface = styled.div('Surface').css\`
        background: $background;
        border: 1px solid $border;
        border-radius: $control;
        color: $primary;
      \`
    `, {
      filename: '/project/src/devtools/panels/console.ts',
      injectCssImport: false,
      configCss,
    })

    expect(result.changed).toBe(true)
    expect(result.css).toContain('background:var(--rd-colors-background)')
    expect(result.css).toMatch(/border:0?\.0625rem solid var\(--rd-colors-border\)/)
    expect(result.css).toContain('border-radius:var(--rd-radius-control)')
    expect(result.css).toContain('color:var(--rd-colors-primary)')
    expect(result.css).not.toMatch(/\$(?:background|border|primary|control)\b/)
  })

  it('emits compact production class names and minified CSS', () => {
    const result = compileCipoSourceBuild(`
      const BuildBadge = styled.span('RodDevtoolsBuildBadge').css\`
        position: sticky;
        right: 0.25rem;
      \`
    `, {
      filename: '/project/src/devtools/shell.ts',
      classPrefix: 'c',
      classNameMode: 'compact',
      minifyCss: true,
      injectCssImport: false,
    })

    expect(result.changed).toBe(true)
    const className = result.manifest[0]?.className
    expect(className).toMatch(/^c[0-9a-z]+$/)
    expect(className).not.toContain('RodDevtoolsBuildBadge')
    expect(result.code).toContain(JSON.stringify(className))
    expect(result.code).not.toContain('.css`')
    expect(result.css).toContain(`.${className}{`)
    expect(result.css).toContain('position:sticky')
    expect(result.css).toMatch(/right:0?\.25rem/)
    expect(result.css).not.toMatch(/\s/)
  })

  it('couples anonymous styled CSS to the component expression for per-component tree shaking', () => {
    const result = compileCipoSourceBuild(`
      export const Used = styled.div.css\`color: red;\`
      export const Unused = styled.section.css\`color: blue;\`
    `, {
      filename: '/project/src/components.ts',
      classNameMode: 'compact',
      coupleStyledCss: true,
      styledCssHelperImportPath: '@rodkisten/cipo/compiled-runtime',
      injectCssImport: false,
    })

    expect(result.code).toContain('attachCompiledCss')
    expect(result.code.match(/\/\*#__PURE__\*\/[A-Za-z_$][\w$]*\(/g)).toHaveLength(2)
    expect(result.code).toContain('color:red')
    expect(result.code).toContain('color:blue')
    expect(result.css).toBe('')
  })

  it('keeps explicitly named styled registry components side-effectful in compiled output', () => {
    const result = compileCipoSourceBuild(`
      export const Registered = styled.textarea('Registered').css\`resize: none;\`
    `, {
      filename: '/project/src/registered.ts',
      classNameMode: 'compact',
      coupleStyledCss: true,
      styledCssHelperImportPath: '@rodkisten/cipo/compiled-runtime',
      injectCssImport: false,
    })

    expect(result.code).toContain('attachCompiledCss')
    expect(result.code).not.toMatch(/\/\*#__PURE__\*\/[A-Za-z_$][\w$]*\(/)
  })

  it('mangles only explicitly private custom properties in compact CSS', () => {
    const result = compileCipoSourceBuild(`
      const Box = styled.div('Box').css\`
        --_cipo-private-gap: 8px;
        gap: var(--_cipo-private-gap);
        color: var(--rd-colors-primary);
      \`
    `, {
      filename: '/project/src/box.ts',
      classNameMode: 'compact',
      privateCustomPropertyPattern: /^--_cipo-/,
      injectCssImport: false,
    })

    expect(result.css).toContain('--a:')
    expect(result.css).toContain('var(--a)')
    expect(result.css).toContain('var(--rd-colors-primary)')
    expect(result.css).not.toContain('--_cipo-private-gap')
  })


  it('lowers runtime configureFromCss calls to parser-free compiled payloads in production', () => {
    const configCss = `
      @cipo { prefix: rd; theme-root: :host; minify: true; }
      @theme { colors<color>: (primary: var(--primary)); radius<length>: (panel: 10px); }
      @breakpoints { md: 680px; }
    `
    const plugin = cipoVite({ root: '/project', mode: 'build', configCss, compileFabrica: false })
    const context = { emitFile: () => 'asset' } as never
    const transformed = plugin.transform?.call(
      context,
      `import { configureFromCss } from '@rodkisten/cipo';
import { appConfigCss } from './config';
configureFromCss(appConfigCss);`,
      '/project/src/devtools/bootstrap.ts',
    )

    const code = transformed && 'code' in transformed ? transformed.code : ''
    expect(code).toContain('configureCompiledCssConfig as __cipoConfigureCompiledCss')
    expect(code).toContain('__cipoConfigureCompiledCss({"operations":')
    expect(code).not.toContain('configureFromCss')
    expect(code).not.toContain('appConfigCss')
    expect(code).not.toContain('var(--rd-colors-primary)')
    expect(code).not.toContain('@theme')
  })

  it('keeps runtime theme application semantics after build-time config lowering', async () => {
    const configCss = `
      @cipo { prefix: rd; theme-root: :host; minify: true; }
      @theme { colors<color>: (primary: var(--primary)); radius<length>: (panel: 10px); }
    `
    const { compileCssConfigPayload } = await import('@rodkisten/cipo/compiler')
    const { configureCompiledCssConfig } = await import('@rodkisten/cipo')
    const payload = compileCssConfigPayload(configCss)

    expect(payload).not.toBeNull()

    // Compare against the canonical runtime parser instead of assuming reset()
    // restores global config defaults. reset() intentionally clears generated
    // artifacts/caches while preserving the active runtime configuration.
    reset()
    const runtimeResult = configureFromCss(configCss)
    const runtimeCss = getCssText()

    reset()
    const compiledResult = configureCompiledCssConfig(payload!)
    const compiledCss = getCssText()

    expect(compiledResult.config).toEqual(runtimeResult.config)
    expect(compiledResult.theme).toEqual(runtimeResult.theme)
    expect(compiledCss).toBe(runtimeCss)
    expect(compiledCss).toContain(':host{')
    expect(compiledCss).toContain('--rd-colors-primary:var(--primary)')
  })

})
