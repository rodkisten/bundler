import { describe, expect, it } from 'vitest'
import { normalizeFabricaSelectorSyntax } from './fabrica-selector-syntax'

describe('Fábrica selector syntax', () => {
  it('lowers data-value selectors with flexible spacing and quotes', () => {
    expect(normalizeFabricaSelectorSyntax("& :token='comment'")).toBe(
      '& [data-token="comment"]',
    )
    expect(normalizeFabricaSelectorSyntax('& :token = "comment"')).toBe(
      '& [data-token="comment"]',
    )
    expect(normalizeFabricaSelectorSyntax('& :token = “comment”')).toBe(
      '& [data-token="comment"]',
    )
    expect(normalizeFabricaSelectorSyntax('& :token = ‘comment’')).toBe(
      '& [data-token="comment"]',
    )
  })

  it('normalizes Fábrica camelCase data names', () => {
    expect(normalizeFabricaSelectorSyntax("& :toolTab='console'")).toBe(
      '& [data-tool-tab="console"]',
    )
    expect(normalizeFabricaSelectorSyntax('& :panelState')).toBe(
      '& [data-panel-state]',
    )
    expect(normalizeFabricaSelectorSyntax('& :dataPanelState')).toBe(
      '& [data-panel-state]',
    )
  })

  it('lowers Fábrica boolean bindings to attribute selectors', () => {
    expect(normalizeFabricaSelectorSyntax('&?disabled')).toBe(
      '&[disabled]',
    )
    expect(normalizeFabricaSelectorSyntax('& ?required')).toBe(
      '& [required]',
    )
  })

  it('preserves native pseudo classes and pseudo elements', () => {
    const source = [
      '&:hover',
      '&:disabled',
      '&::before',
      'summary::-webkit-details-marker',
      '&:not(:first-child)',
      '&:state(open)',
    ].join(', ')
    expect(normalizeFabricaSelectorSyntax(source)).toBe(source)
  })

  it('allows data shorthand inside native selector functions', () => {
    expect(normalizeFabricaSelectorSyntax("&:not(:state='closed')")).toBe(
      '&:not([data-state="closed"])',
    )
  })

  it('does not rewrite selector text inside native attribute values', () => {
    const source = '[title=":token=\'comment\'"]'
    expect(normalizeFabricaSelectorSyntax(source)).toBe(source)
  })

  it('does not reinterpret the special Fábrica :data object binding', () => {
    expect(normalizeFabricaSelectorSyntax('& :data')).toBe('& :data')
    expect(normalizeFabricaSelectorSyntax("& :data='value'")).toBe(
      "& :data='value'",
    )
  })
})
