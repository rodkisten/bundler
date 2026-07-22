import { describe, expect, it } from 'vitest'
import { atomic, reset, setup, sheet } from '@rodkisten/cipo'
import { normalizeDeclarationSpacing } from './css-test-utils'


describe('Cipó smart shorthands', () => {
  it('expands size, position and grid declaration functions', () => {
    reset()
    setup({ prefix: 'rod', theme: { spacing: '0.25rem' } })

    const card = atomic.css`
      h(contain, min: 240px, max: 70vh)
      w(fill, min: 320px, max: 960px)
      pos(fixed, top: 0, right: 0)
      grid-template(cols: 220px minmax(0, 1fr), rows: auto minmax(0, 1fr))
      grid-flow(row dense)
    `
    const css = normalizeDeclarationSpacing(card.compiledCss)

    expect(css).toContain('height:auto')
    expect(css).toContain('min-height:15rem')
    expect(css).toContain('max-height:70vh')
    expect(css).toContain('width:100%')
    expect(css).toContain('min-width:20rem')
    expect(css).toContain('position:fixed')
    expect(css).toContain('right:0')
    expect(css).toContain('grid-template-columns:13.75rem minmax(0, 1fr)')
    expect(css).toContain('grid-auto-flow:row dense')
  })

  it('expands typography, word breaking and border shorthands', () => {
    reset()
    const card = atomic.css`
      text(nowrap)
      break(anywhere)
      bor: red
      bor-x: 2px dashed color-amber-245
    `
    const css = normalizeDeclarationSpacing(card.compiledCss)

    expect(css).toContain('white-space:nowrap')
    expect(css).toContain('overflow-wrap:anywhere')
    expect(css).toContain('border:1px solid red')
    expect(css).toContain('border-inline:0.125rem dashed oklch(')
  })

  it('expands modern background helpers', () => {
    reset()
    const card = atomic.css`
      bg: gradient(repeating-linear, 90deg, red, blue)
      background-image: image(https://example.com/panel.png)
      color: color-amber-245
    `
    const css = normalizeDeclarationSpacing(card.compiledCss)

    expect(css).toContain('repeating-linear-gradient(90deg, red, blue)')
    expect(css).toContain(
      'background-image:url("https://example.com/panel.png")',
    )
    expect(css).toContain('color:oklch(')
  })

  it('expands layout helpers', () => {
    reset()
    const card = atomic.css`
      stack(gap: 3)
      cluster(gap: 2, justify: space-between)
      center(max: 720px, px: 16px, text: center)
      cover(header: auto, main: minmax(0, 1fr), footer: auto)
      sidebar(side: right, width: 280px, gap: 16px)
    `
    const css = normalizeDeclarationSpacing(card.compiledCss)

    expect(css).toContain('flex-direction:column')
    expect(css).toContain('flex-wrap:wrap')
    expect(css).toContain('justify-content:space-between')
    expect(css).toContain('max-width:45rem')
    expect(css).toContain('text-align:center')
    expect(css).toContain('grid-template-rows:auto minmax(0, 1fr) auto')
    expect(css).toContain('grid-template-columns:minmax(0,1fr) 17.5rem')
  })

  it('expands scroll, snap, interaction and motion helpers', () => {
    reset()
    const card = atomic.css`
      scroll(smooth)
      scrollbar(thin)
      snap(x, mandatory)
      snap-item(start)
      overscroll(contain)
      tap(none)
      select(none)
      drag(none)
      focus-ring($brand)
      transition(colors, transform)
      animate(fade-in)
    `
    const css = normalizeDeclarationSpacing(card.compiledCss)

    expect(css).toContain('scroll-behavior:smooth')
    expect(css).toContain('scrollbar-width:thin')
    expect(css).toContain('scroll-snap-type:x mandatory')
    expect(css).toContain('scroll-snap-align:start')
    expect(css).toContain('overscroll-behavior:contain')
    expect(css).toContain('touch-action:none')
    expect(css).toContain('user-select:none')
    expect(css).toContain('-webkit-user-drag:none')
    expect(css).toContain('outline:2px solid')
    expect(css).toContain('transition:color 160ms ease')
    expect(css).toContain('animation:fade-in 180ms ease-out both')
  })

  it('wraps supports, layer, container query and reduced motion blocks', () => {
    reset()
    const cssText = String(sheet.css`
      .card {
        color: red

        supports(backdrop-filter: blur(1px)) {
          backdrop-filter: blur(18px)
        }

        layer(components) {
          bg: blue
        }

        x:cq(md) {
          grid-template(cols: 1fr 1fr)
        }

        reduce-motion {
          transition: none
        }
      }
    `)

    expect(cssText).toContain('@supports (backdrop-filter: blur(0.0625rem))')
    expect(cssText).toContain('@layer components')
    expect(cssText).toContain('@container md')
    expect(cssText).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
