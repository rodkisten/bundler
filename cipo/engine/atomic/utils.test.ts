import { describe, expect, it } from 'vitest'
import type {
  CipoAtomicRule,
  CipoRuleContext,
} from '../../types'
import {
  atomicRuleToDeclaration,
  joinAtomicClassNames,
  normalizeAtomicMinUses,
} from './utils'
describe('atomic utilities', () => {
  describe('normalizeAtomicMinUses', () => {
    it.each([
      [1, 1],
      [2, 2],
      [10, 10],
      [1.9, 1],
      [2.99, 2],
      [100.75, 100],
    ])(
      'truncates finite positive threshold %d to %d',
      (input, expected) => {
        expect(
          normalizeAtomicMinUses(input),
        ).toBe(expected)
      },
    )
    it.each([
      [0, 1],
      [-1, 1],
      [-100, 1],
      [-1.5, 1],
      [Number.MIN_SAFE_INTEGER, 1],
    ])(
      'clamps threshold %d to the minimum supported value',
      (input, expected) => {
        expect(
          normalizeAtomicMinUses(input),
        ).toBe(expected)
      },
    )
    it('normalizes positive infinity to positive infinity', () => {
      expect(
        normalizeAtomicMinUses(
          Number.POSITIVE_INFINITY,
        ),
      ).toBe(
        Number.POSITIVE_INFINITY,
      )
    })
    it('normalizes negative infinity to positive infinity', () => {
      expect(
        normalizeAtomicMinUses(
          Number.NEGATIVE_INFINITY,
        ),
      ).toBe(
        Number.POSITIVE_INFINITY,
      )
    })
    it('normalizes NaN to positive infinity', () => {
      expect(
        normalizeAtomicMinUses(
          Number.NaN,
        ),
      ).toBe(
        Number.POSITIVE_INFINITY,
      )
    })
    it('preserves the largest finite integer value', () => {
      expect(
        normalizeAtomicMinUses(
          Number.MAX_SAFE_INTEGER,
        ),
      ).toBe(
        Number.MAX_SAFE_INTEGER,
      )
    })
    it('truncates toward zero before applying the minimum threshold', () => {
      expect(
        normalizeAtomicMinUses(
          -1.9,
        ),
      ).toBe(1)
      expect(
        normalizeAtomicMinUses(
          3.9,
        ),
      ).toBe(3)
    })
    it('is idempotent for normalized finite values', () => {
      const values = [
        1,
        2,
        5,
        100,
      ]
      for (const value of values) {
        expect(
          normalizeAtomicMinUses(
            normalizeAtomicMinUses(value),
          ),
        ).toBe(value)
      }
    })
    it('is idempotent for the disabled infinite threshold representation', () => {
      const normalized =
        normalizeAtomicMinUses(
          Number.NaN,
        )
      expect(
        normalizeAtomicMinUses(
          normalized,
        ),
      ).toBe(
        Number.POSITIVE_INFINITY,
      )
    })
  })
  describe('joinAtomicClassNames', () => {
    it('joins a component scope and atomic classes in source order', () => {
      const atoms = [
        createAtom(
          'color:red',
          'cp-a-color',
        ),
        createAtom(
          'display:flex',
          'cp-a-display',
        ),
        createAtom(
          'padding:8px',
          'cp-a-padding',
        ),
      ]
      expect(
        joinAtomicClassNames(
          'cp-s-component',
          atoms,
        ),
      ).toBe(
        'cp-s-component cp-a-color cp-a-display cp-a-padding',
      )
    })
    it('omits the scope class when it is empty', () => {
      const atoms = [
        createAtom(
          'color:red',
          'cp-a-color',
        ),
        createAtom(
          'display:flex',
          'cp-a-display',
        ),
      ]
      expect(
        joinAtomicClassNames(
          '',
          atoms,
        ),
      ).toBe(
        'cp-a-color cp-a-display',
      )
    })
    it('returns only the scope class when there are no atoms', () => {
      expect(
        joinAtomicClassNames(
          'cp-s-component',
          [],
        ),
      ).toBe(
        'cp-s-component',
      )
    })
    it('returns an empty string when both scope and atom collections are empty', () => {
      expect(
        joinAtomicClassNames(
          '',
          [],
        ),
      ).toBe('')
    })
    it('deduplicates repeated atomic class names while preserving first-seen order', () => {
      const atoms = [
        createAtom(
          'color:red:first',
          'cp-a-color',
        ),
        createAtom(
          'display:flex',
          'cp-a-display',
        ),
        createAtom(
          'color:red:duplicate',
          'cp-a-color',
        ),
        createAtom(
          'padding:8px',
          'cp-a-padding',
        ),
        createAtom(
          'display:flex:duplicate',
          'cp-a-display',
        ),
      ]
      expect(
        joinAtomicClassNames(
          '',
          atoms,
        ),
      ).toBe(
        'cp-a-color cp-a-display cp-a-padding',
      )
    })
    it('deduplicates an atomic class that is identical to the scope class', () => {
      const atoms = [
        createAtom(
          'color:red',
          'cp-s-component',
        ),
        createAtom(
          'display:flex',
          'cp-a-display',
        ),
      ]
      expect(
        joinAtomicClassNames(
          'cp-s-component',
          atoms,
        ),
      ).toBe(
        'cp-s-component cp-a-display',
      )
    })
    it('uses className rather than atomic rule id as the deduplication identity', () => {
      const atoms = [
        createAtom(
          'first-id',
          'shared-class',
        ),
        createAtom(
          'second-id',
          'shared-class',
        ),
      ]
      expect(
        joinAtomicClassNames(
          '',
          atoms,
        ),
      ).toBe(
        'shared-class',
      )
    })
    it('keeps atoms with the same id when their class names differ', () => {
      const atoms = [
        createAtom(
          'same-id',
          'first-class',
        ),
        createAtom(
          'same-id',
          'second-class',
        ),
      ]
      expect(
        joinAtomicClassNames(
          '',
          atoms,
        ),
      ).toBe(
        'first-class second-class',
      )
    })
    it('does not mutate the input atom array', () => {
      const first = createAtom(
        'color:red',
        'cp-a-color',
      )
      const second = createAtom(
        'display:flex',
        'cp-a-display',
      )
      const atoms = [
        first,
        second,
      ]
      const snapshot = [
        ...atoms,
      ]
      joinAtomicClassNames(
        'cp-s-component',
        atoms,
      )
      expect(atoms).toEqual(
        snapshot,
      )
      expect(atoms[0]).toBe(first)
      expect(atoms[1]).toBe(second)
    })
    it('does not mutate atomic rule objects while joining their classes', () => {
      const atom = createAtom(
        'color:red',
        'cp-a-color',
        {
          dark: true,
        },
      )
      const snapshot = {
        ...atom,
        context: {
          ...atom.context,
        },
      }
      joinAtomicClassNames(
        'cp-s-component',
        [
          atom,
        ],
      )
      expect(atom).toEqual(
        snapshot,
      )
    })
    it('is deterministic for identical ordered inputs', () => {
      const atoms = [
        createAtom(
          'color:red',
          'cp-a-color',
        ),
        createAtom(
          'display:flex',
          'cp-a-display',
        ),
      ]
      const first =
        joinAtomicClassNames(
          'cp-s-component',
          atoms,
        )
      const second =
        joinAtomicClassNames(
          'cp-s-component',
          atoms,
        )
      expect(second).toBe(first)
    })
    it('preserves exact class-name text rather than normalizing it', () => {
      const atoms = [
        createAtom(
          'first',
          'Custom_Class',
        ),
        createAtom(
          'second',
          'cp-a-value--hash',
        ),
      ]
      expect(
        joinAtomicClassNames(
          'Scope_Class',
          atoms,
        ),
      ).toBe(
        'Scope_Class Custom_Class cp-a-value--hash',
      )
    })
    it('treats class names as case-sensitive identities', () => {
      const atoms = [
        createAtom(
          'first',
          'cp-a-color',
        ),
        createAtom(
          'second',
          'CP-A-COLOR',
        ),
      ]
      expect(
        joinAtomicClassNames(
          '',
          atoms,
        ),
      ).toBe(
        'cp-a-color CP-A-COLOR',
      )
    })
  })
  describe('atomicRuleToDeclaration', () => {
    it('converts an atomic rule into a declaration node', () => {
      const atom = createAtom(
        'color:red',
        'cp-a-color',
      )
      expect(
        atomicRuleToDeclaration(
          atom,
        ),
      ).toEqual({
        type: 'declaration',
        property: 'color',
        value: 'red',
        source: 'color:red',
      })
    })
    it('preserves the atomic property, value and source exactly', () => {
      const atom = createAtom(
        'custom-id',
        'cp-a-custom',
      )
      const customAtom = {
        ...atom,
        property:
          '--custom-property',
        value:
          'calc(100% - var(--gap))',
        source:
          '--custom-property: calc(100% - var(--gap));',
      }
      expect(
        atomicRuleToDeclaration(
          customAtom,
        ),
      ).toEqual({
        type: 'declaration',
        property:
          '--custom-property',
        value:
          'calc(100% - var(--gap))',
        source:
          '--custom-property: calc(100% - var(--gap));',
      })
    })
    it('does not copy atomic-only metadata into the declaration node', () => {
      const atom = createAtom(
        'color:red',
        'cp-a-color',
        {
          dark: true,
          breakpoint: 'md',
          mediaQuery:
            '(min-width: 768px)',
        },
      )
      const declaration =
        atomicRuleToDeclaration(
          atom,
        )
      expect(declaration).toEqual({
        type: 'declaration',
        property: 'color',
        value: 'red',
        source: 'color:red',
      })
      expect(
        'id' in declaration,
      ).toBe(false)
      expect(
        'className' in declaration,
      ).toBe(false)
      expect(
        'context' in declaration,
      ).toBe(false)
    })
    it('returns a new declaration object on every call', () => {
      const atom = createAtom(
        'color:red',
        'cp-a-color',
      )
      const first =
        atomicRuleToDeclaration(
          atom,
        )
      const second =
        atomicRuleToDeclaration(
          atom,
        )
      expect(second).toEqual(first)
      expect(second).not.toBe(first)
    })
    it('does not mutate the original atomic rule', () => {
      const atom = createAtom(
        'color:red',
        'cp-a-color',
        {
          dark: true,
        },
      )
      const snapshot = {
        ...atom,
        context: {
          ...atom.context,
        },
      }
      atomicRuleToDeclaration(
        atom,
      )
      expect(atom).toEqual(
        snapshot,
      )
    })
    it('keeps source undefined when the atomic source is undefined', () => {
      const atom = {
        ...createAtom(
          'color:red',
          'cp-a-color',
        ),
        source: undefined,
      } as unknown as CipoAtomicRule
      expect(
        atomicRuleToDeclaration(
          atom,
        ),
      ).toEqual({
        type: 'declaration',
        property: 'color',
        value: 'red',
        source: undefined,
      })
    })
  })
  describe('atomic fallback integration', () => {
    it('can deduplicate class output independently from declaration fallback conversion', () => {
      const first = createAtom(
        'first-rule',
        'cp-a-shared',
      )
      const second = {
        ...createAtom(
          'second-rule',
          'cp-a-shared',
        ),
        property: 'background',
        value: 'blue',
        source: 'background:blue',
      }
      const className =
        joinAtomicClassNames(
          'cp-s-component',
          [
            first,
            second,
          ],
        )
      const declarations = [
        atomicRuleToDeclaration(
          first,
        ),
        atomicRuleToDeclaration(
          second,
        ),
      ]
      expect(className).toBe(
        'cp-s-component cp-a-shared',
      )
      expect(declarations).toEqual([
        {
          type: 'declaration',
          property: 'first-rule',
          value: '',
          source: 'first-rule',
        },
        {
          type: 'declaration',
          property: 'background',
          value: 'blue',
          source: 'background:blue',
        },
      ])
    })
    it('supports normalized thresholds used by streaming atomic promotion', () => {
      const configurationValues = [
        {
          input: 0,
          expected: 1,
        },
        {
          input: 2.9,
          expected: 2,
        },
        {
          input:
            Number.POSITIVE_INFINITY,
          expected:
            Number.POSITIVE_INFINITY,
        },
      ]
      for (
        const {
          input,
          expected,
        }
        of configurationValues
      ) {
        expect(
          normalizeAtomicMinUses(
            input,
          ),
        ).toBe(expected)
      }
    })
  })
})
function createAtom(
  id: string,
  className: string,
  context: CipoRuleContext = {},
): CipoAtomicRule {
  const colon =
    id.indexOf(':')
  return {
    id,
    className,
    property:
      colon >= 0
        ? id.slice(
            0,
            colon,
          )
        : id,
    value:
      colon >= 0
        ? id.slice(
            colon + 1,
          )
        : '',
    source: id,
    context,
  } as CipoAtomicRule
}
