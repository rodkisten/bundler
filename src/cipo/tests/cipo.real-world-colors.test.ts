// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { css, getCssText, reset, sheet } from '../../cipo'

/**
 * Installs the exact CSS-first configuration that exposed the production regressions.
 *
 * @remarks
 * Keeping this fixture close to the reported source prevents future tests from
 * becoming synthetic and accidentally omitting interactions between `@cipo`,
 * `@theme`, native shorthand grammar, color helpers and runtime custom properties.
 *
 * @param tag - Cipó's polymorphic CSS template tag.
 * @returns The artifact produced while applying the configuration directives.
 */
function installBaseStyles(tag: typeof css) {
  return tag`
    @cipo {
      prefix: xxx;
      layers: true;
      minify: false;
      rem: 16px;
      color-mode: oklch;
    }

    @theme {
      colors: (
        panel: rgb(12 13 15 / 0.94),
        panelStrong: rgb(18 19 22 / 0.98),
        panelDeep: rgb(8 9 11 / 0.88),
        panelDark: rgb(6 7 9 / 0.78),
        border: rgb(255 255 255 / 0.1),
        borderStrong: rgb(255 255 255 / 0.18),
        text: #e5e7eb,
        strong: #ffffff,
        muted: #9ca3af,
        faint: #6b7280,
        cyan: #7dd3fc,
        cyanStrong: #38bdf8,
        key: #8ab4ff,
        string: #7ee787,
        danger: #ff7b72,
        dangerSoft: #f87171,
        warning: #fbbf24
      );

      spacing: 0.25rem;
      radius: (sm: 6px, md: 14px, lg: 22px, modal: 24px, pill: 999px);
      shadow: (
        panel: 0 28px 90px rgb(0 0 0 / 0.72),
        modal: 0 32px 120px rgb(0 0 0 / 0.78),
        dock: 0 18px 50px rgb(0 0 0 / 0.58)
      );
      font: (
        ui: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif,
        mono: "SFMono-Regular", ui-monospace, Menlo, Monaco, Consolas, monospace
      );
    }
  `
}

describe('real-world CSS-first colors and declarations', () => {
  beforeEach(() => reset())

  it('applies every theme color and compiles the reported patterns', () => {
    installBaseStyles(css)

    const tokenCss = getCssText()
    const expectedColors = {
      panel: 'rgb(12 13 15 / 0.94)',
      panelStrong: 'rgb(18 19 22 / 0.98)',
      panelDeep: 'rgb(8 9 11 / 0.88)',
      panelDark: 'rgb(6 7 9 / 0.78)',
      border: 'rgb(255 255 255 / 0.1)',
      borderStrong: 'rgb(255 255 255 / 0.18)',
      text: '#e5e7eb',
      strong: '#ffffff',
      muted: '#9ca3af',
      faint: '#6b7280',
      cyan: '#7dd3fc',
      cyanStrong: '#38bdf8',
      key: '#8ab4ff',
      string: '#7ee787',
      danger: '#ff7b72',
      dangerSoft: '#f87171',
      warning: '#fbbf24',
    }

    for (const [name, value] of Object.entries(expectedColors)) {
      expect(tokenCss).toContain(`--xxx-colors-${name}:${value}`)
    }

    const artifact = sheet.css`
      .probe {
        $$detailsHeight: 280px
        grid-template-rows: minmax(0, 1fr) auto minmax(0, $$detailsHeight)
        font: 600 16px / 1 $font.ui
        content: ""
        transform: translateX(-50%)
        direction: rtl
        grid: auto-flow / 1fr 2fr
        size(14px)
        color: $colors.text
        background: alpha($colors.panel / 90%)

        &::before {
          content: ""
          transform: translateX(-50%)
        }

        &:hover::before,
        &:focus-visible::before {
          background: alpha($colors.strong / 18%)
        }
      }
    `

    const output = String(artifact)
    expect(output).toContain('grid-template-rows:minmax(0, 1fr) auto minmax(0, var(--xxx-details-height))')
    expect(output).toContain('font:600 1rem / 1 var(--xxx-font-ui)')
    expect(output).toContain('content:""')
    expect(output).toContain('transform:translateX(-50%)')
    expect(output).toContain('direction:rtl')
    expect(output).toContain('grid:auto-flow / 1fr 2fr')
    expect(output).toContain('width:0.875rem')
    expect(output).toContain('height:0.875rem')
    expect(output).toContain('color:var(--xxx-colors-text)')
    expect(output).toContain('background:color-mix(in oklch, var(--xxx-colors-panel) 90%, transparent)')
    expect(output).toContain('.probe:hover::before,.probe:focus-visible::before')
    expect(output).not.toContain('font-family:calc(')
    expect(output).not.toContain('align-content:""')
    expect(output).not.toContain('text-transform:translateX(')
    expect(output).not.toContain('$$detailsHeight')

    const warningCodes = artifact.debug.warnings.map((warning) => warning.code)
    expect(warningCodes).not.toContain('unknown-function-declaration')
    expect(warningCodes).not.toContain('invalid-declaration')
  })
})
