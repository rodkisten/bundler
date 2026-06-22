import { describe, expect, it } from 'vitest'
import { atomic, reset, setup, sheet } from '../src/index'

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

    expect(card.compiledCss).toContain('height:auto')
    expect(card.compiledCss).toContain('min-height:15rem')
    expect(card.compiledCss).toContain('max-height:70vh')
    expect(card.compiledCss).toContain('width:100%')
    expect(card.compiledCss).toContain('min-width:20rem')
    expect(card.compiledCss).toContain('position:fixed')
    expect(card.compiledCss).toContain('right:0')
    expect(card.compiledCss).toContain('grid-template-columns:13.75rem minmax(0, 1fr)')
    expect(card.compiledCss).toContain('grid-auto-flow:row dense')
  })

  it('expands typography, word breaking and border shorthands', () => {
    reset()
    const card = atomic.css`
      text(nowrap)
      break(anywhere)
      bor: red
      bor-x: 2px dashed color-amber-245
    `

    expect(card.compiledCss).toContain('white-space:nowrap')
    expect(card.compiledCss).toContain('overflow-wrap:anywhere')
    expect(card.compiledCss).toContain('border:1px solid red')
    expect(card.compiledCss).toContain('border-inline:0.125rem dashed oklch(')
  })

  it('expands modern background helpers', () => {
    reset()
    const card = atomic.css`
      bg: gradient(repeating-linear, 90deg, red, blue)
      background-image: image(https://example.com/panel.png)
      color: color-amber-245
    `

    expect(card.compiledCss).toContain('repeating-linear-gradient(90deg, red, blue)')
    expect(card.compiledCss).toContain('background-image:url("https://example.com/panel.png")')
    expect(card.compiledCss).toContain('color:oklch(')
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

    expect(card.compiledCss).toContain('flex-direction:column')
    expect(card.compiledCss).toContain('flex-wrap:wrap')
    expect(card.compiledCss).toContain('justify-content:space-between')
    expect(card.compiledCss).toContain('max-width:45rem')
    expect(card.compiledCss).toContain('text-align:center')
    expect(card.compiledCss).toContain('grid-template-rows:auto minmax(0, 1fr) auto')
    expect(card.compiledCss).toContain('grid-template-columns:minmax(0,1fr) 17.5rem')
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

    expect(card.compiledCss).toContain('scroll-behavior:smooth')
    expect(card.compiledCss).toContain('scrollbar-width:thin')
    expect(card.compiledCss).toContain('scroll-snap-type:x mandatory')
    expect(card.compiledCss).toContain('scroll-snap-align:start')
    expect(card.compiledCss).toContain('overscroll-behavior:contain')
    expect(card.compiledCss).toContain('touch-action:none')
    expect(card.compiledCss).toContain('user-select:none')
    expect(card.compiledCss).toContain('-webkit-user-drag:none')
    expect(card.compiledCss).toContain('outline:2px solid')
    expect(card.compiledCss).toContain('transition:color 160ms ease')
    expect(card.compiledCss).toContain('animation:fade-in 180ms ease-out both')
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
