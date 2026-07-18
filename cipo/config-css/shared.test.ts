import { describe, expect, it } from 'vitest'
import type { CipoConfig, CipoTheme } from '../types'
import { typedTheme } from '../theme-value'
import type { Mutable } from './contracts'
import {
  buildConfigTemplate,
  clearObject,
  mergeConfigPatch,
  mergeTheme,
  normalizeConfigName,
} from './shared'
describe('CSS-first configuration shared utilities', () => {
  describe('mergeConfigPatch', () => {
    it('mutates the target with ordinary configuration fields', () => {
      const target: Partial<Mutable<CipoConfig>> = {
        prefix: 'initial',
        debug: false,
      }
      mergeConfigPatch(target, {
        prefix: 'application',
        debug: true,
        minify: true,
      })
      expect(target).toMatchObject({
        prefix: 'application',
        debug: true,
        minify: true,
      })
    })
    it('preserves existing breakpoint entries while merging new breakpoint subkeys', () => {
      const target: Partial<Mutable<CipoConfig>> = {
        breakpoints: {
          sm: '(min-width: 640px)',
          md: '(min-width: 768px)',
        },
      }
      mergeConfigPatch(target, {
        breakpoints: {
          md: '(min-width: 800px)',
          lg: '(min-width: 1024px)',
        },
      })
      expect(target.breakpoints).toEqual({
        sm: '(min-width: 640px)',
        md: '(min-width: 800px)',
        lg: '(min-width: 1024px)',
      })
    })
    it('creates a breakpoint map when the target has no existing breakpoints', () => {
      const target: Partial<Mutable<CipoConfig>> = {}
      mergeConfigPatch(target, {
        breakpoints: {
          mobile: null,
          desktop: '(min-width: 1280px)',
        },
      })
      expect(target.breakpoints).toEqual({
        mobile: null,
        desktop: '(min-width: 1280px)',
      })
    })
    it('keeps existing breakpoints when an explicitly present breakpoint patch is empty', () => {
      const target: Partial<Mutable<CipoConfig>> = {
        breakpoints: {
          sm: '(min-width: 640px)',
        },
      }
      mergeConfigPatch(target, {
        breakpoints: {},
      })
      expect(target.breakpoints).toEqual({
        sm: '(min-width: 640px)',
      })
    })
    it('uses shallow replacement semantics for configuration fields other than breakpoints', () => {
      const target: Partial<Mutable<CipoConfig>> = {
        atomic: {
          minUses: 2,
        },
        rem: {
          enabled: true,
          baseFontSize: 16,
        },
      }
      const atomicPatch = {
        minUses: 5,
      }
      const remPatch = {
        enabled: false,
        baseFontSize: 20,
      }
      mergeConfigPatch(target, {
        atomic: atomicPatch,
        rem: remPatch,
      })
      expect(target.atomic).toBe(atomicPatch)
      expect(target.rem).toBe(remPatch)
      expect(target).toMatchObject({
        atomic: {
          minUses: 5,
        },
        rem: {
          enabled: false,
          baseFontSize: 20,
        },
      })
    })
    it('does not remove unrelated existing target fields', () => {
      const target: Partial<Mutable<CipoConfig>> = {
        prefix: 'app',
        debug: true,
        minify: false,
      }
      mergeConfigPatch(target, {
        minify: true,
      })
      expect(target).toMatchObject({
        prefix: 'app',
        debug: true,
        minify: true,
      })
    })
    it('applies sequential patches predictably while accumulating breakpoints', () => {
      const target: Partial<Mutable<CipoConfig>> = {}
      mergeConfigPatch(target, {
        prefix: 'first',
        breakpoints: {
          sm: '(min-width: 640px)',
        },
      })
      mergeConfigPatch(target, {
        prefix: 'second',
        breakpoints: {
          md: '(min-width: 768px)',
        },
      })
      mergeConfigPatch(target, {
        breakpoints: {
          sm: '(min-width: 680px)',
        },
      })
      expect(target).toMatchObject({
        prefix: 'second',
        breakpoints: {
          sm: '(min-width: 680px)',
          md: '(min-width: 768px)',
        },
      })
    })
    it('does not mutate the breakpoint patch object while merging it', () => {
      const target: Partial<Mutable<CipoConfig>> = {
        breakpoints: {
          sm: '(min-width: 640px)',
        },
      }
      const patch = {
        md: '(min-width: 768px)',
      }
      mergeConfigPatch(target, {
        breakpoints: patch,
      })
      expect(patch).toEqual({
        md: '(min-width: 768px)',
      })
      expect(target.breakpoints).not.toBe(patch)
    })
  })
  describe('mergeTheme', () => {
    it('merges top-level theme entries without mutating either input', () => {
      const left: CipoTheme = {
        primary: 'red',
        spacing: '8px',
      }
      const right: CipoTheme = {
        secondary: 'blue',
      }
      const result = mergeTheme(
        left,
        right,
      )
      expect(result).toEqual({
        primary: 'red',
        spacing: '8px',
        secondary: 'blue',
      })
      expect(left).toEqual({
        primary: 'red',
        spacing: '8px',
      })
      expect(right).toEqual({
        secondary: 'blue',
      })
      expect(result).not.toBe(left)
      expect(result).not.toBe(right)
    })
    it('recursively merges nested theme objects', () => {
      const left: CipoTheme = {
        colors: {
          primary: 'red',
          secondary: 'gray',
        },
        spacing: {
          sm: '4px',
          md: '8px',
        },
      }
      const right: CipoTheme = {
        colors: {
          primary: 'blue',
          accent: 'purple',
        },
        spacing: {
          lg: '16px',
        },
      }
      const result = mergeTheme(
        left,
        right,
      )
      expect(result).toEqual({
        colors: {
          primary: 'blue',
          secondary: 'gray',
          accent: 'purple',
        },
        spacing: {
          sm: '4px',
          md: '8px',
          lg: '16px',
        },
      })
    })
    it('recursively merges theme objects at multiple nesting levels', () => {
      const left: CipoTheme = {
        semantic: {
          foreground: {
            default: '#111',
            muted: '#666',
          },
        },
      }
      const right: CipoTheme = {
        semantic: {
          foreground: {
            default: '#000',
            inverse: '#fff',
          },
        },
      }
      expect(
        mergeTheme(
          left,
          right,
        ),
      ).toEqual({
        semantic: {
          foreground: {
            default: '#000',
            muted: '#666',
            inverse: '#fff',
          },
        },
      })
    })
    it('lets right-hand primitive values replace existing nested theme objects', () => {
      const left: CipoTheme = {
        colors: {
          primary: 'red',
          secondary: 'blue',
        },
      }
      const right: CipoTheme = {
        colors: 'inherit',
      }
      expect(
        mergeTheme(
          left,
          right,
        ),
      ).toEqual({
        colors: 'inherit',
      })
    })
    it('lets right-hand theme objects replace existing primitive values before subsequent recursive merges', () => {
      const left: CipoTheme = {
        colors: 'inherit',
      }
      const right: CipoTheme = {
        colors: {
          primary: 'red',
        },
      }
      expect(
        mergeTheme(
          left,
          right,
        ),
      ).toEqual({
        colors: {
          primary: 'red',
        },
      })
    })
    it('treats typed theme values as atomic values instead of recursively merging their internal object shape', () => {
      const original = typedTheme(
        'color',
        'red',
        {
          register: true,
          validation: 'warn',
        },
      )
      const replacement = typedTheme(
        'color',
        'blue',
        {
          register: false,
          validation: 'strict',
        },
      )
      const left: CipoTheme = {
        primary: original,
      }
      const right: CipoTheme = {
        primary: replacement,
      }
      const result = mergeTheme(
        left,
        right,
      )
      expect(result.primary).toBe(
        replacement,
      )
      expect(result.primary).not.toEqual(
        expect.objectContaining({
          value: 'red',
        }),
      )
    })
    it('preserves a typed theme value when merging unrelated nested theme entries', () => {
      const typedPrimary = typedTheme(
        'color',
        'red',
        {
          register: true,
        },
      )
      const left: CipoTheme = {
        colors: {
          primary: typedPrimary,
          secondary: 'gray',
        },
      }
      const right: CipoTheme = {
        colors: {
          accent: 'purple',
        },
      }
      const result = mergeTheme(
        left,
        right,
      )
      expect(result).toEqual({
        colors: {
          primary: typedPrimary,
          secondary: 'gray',
          accent: 'purple',
        },
      })
      expect(
        (result.colors as CipoTheme)
          .primary,
      ).toBe(typedPrimary)
    })
    it('ignores undefined values from the right-hand theme', () => {
      const left: CipoTheme = {
        primary: 'red',
        secondary: 'blue',
      }
      const right = {
        primary: undefined,
        accent: 'purple',
      } as unknown as CipoTheme
      const result = mergeTheme(
        left,
        right,
      )
      expect(result).toEqual({
        primary: 'red',
        secondary: 'blue',
        accent: 'purple',
      })
    })
    it('does not reuse nested left-hand objects when a recursive merge occurs', () => {
      const leftColors = {
        primary: 'red',
      }
      const rightColors = {
        secondary: 'blue',
      }
      const result = mergeTheme(
        {
          colors: leftColors,
        },
        {
          colors: rightColors,
        },
      )
      const mergedColors =
        result.colors as CipoTheme
      expect(mergedColors).not.toBe(
        leftColors,
      )
      expect(mergedColors).not.toBe(
        rightColors,
      )
      expect(mergedColors).toEqual({
        primary: 'red',
        secondary: 'blue',
      })
    })
    it('supports null-prototype theme maps produced by the configuration parser', () => {
      const left = Object.create(
        null,
      ) as CipoTheme
      const leftColors = Object.create(
        null,
      ) as CipoTheme
      leftColors.primary = 'red'
      left.colors = leftColors
      const right = Object.create(
        null,
      ) as CipoTheme
      const rightColors = Object.create(
        null,
      ) as CipoTheme
      rightColors.secondary = 'blue'
      right.colors = rightColors
      const result = mergeTheme(
        left,
        right,
      )
      expect(result).toEqual({
        colors: {
          primary: 'red',
          secondary: 'blue',
        },
      })
    })
  })
  describe('normalizeConfigName', () => {
    it.each([
      ['application', 'application'],
      [' application ', 'application'],
      ['"application"', 'application'],
      ["'application'", 'application'],
      ['  "application"  ', 'application'],
      ["  'application'  ", 'application'],
    ])(
      'normalizes %j to %j',
      (
        input,
        expected,
      ) => {
        expect(
          normalizeConfigName(input),
        ).toBe(expected)
      },
    )
    it('removes only surrounding quote characters and preserves internal quotes', () => {
      expect(
        normalizeConfigName(
          '"application\'theme"',
        ),
      ).toBe(
        "application'theme",
      )
    })
    it('preserves internal whitespace', () => {
      expect(
        normalizeConfigName(
          '"my application theme"',
        ),
      ).toBe(
        'my application theme',
      )
    })
    it('normalizes an empty input to an empty string', () => {
      expect(
        normalizeConfigName(''),
      ).toBe('')
    })
    it('normalizes a whitespace-only input to an empty string', () => {
      expect(
        normalizeConfigName('   '),
      ).toBe('')
    })
  })
  describe('buildConfigTemplate', () => {
    it('reconstructs a static template without interpolation values', () => {
      const strings =
        createTemplateStrings([
          `
            @cipo {
              prefix: app;
            }
          `,
        ])
      expect(
        buildConfigTemplate(
          strings,
          [],
        ),
      ).toBe(strings[0])
    })
    it('interleaves template strings and interpolation values in source order', () => {
      const strings =
        createTemplateStrings([
          '@cipo { prefix: ',
          '; minify: ',
          '; }',
        ])
      expect(
        buildConfigTemplate(
          strings,
          [
            'application',
            true,
          ],
        ),
      ).toBe(
        '@cipo { prefix: application; minify: true; }',
      )
    })
    it('coerces number and boolean interpolation values using String semantics', () => {
      const strings =
        createTemplateStrings([
          'min-uses: ',
          '; debug: ',
          ';',
        ])
      expect(
        buildConfigTemplate(
          strings,
          [
            4,
            false,
          ],
        ),
      ).toBe(
        'min-uses: 4; debug: false;',
      )
    })
    it('renders null and undefined interpolation values as empty strings', () => {
      const strings =
        createTemplateStrings([
          'before:',
          ':middle:',
          ':after',
        ])
      expect(
        buildConfigTemplate(
          strings,
          [
            null,
            undefined,
          ],
        ),
      ).toBe(
        'before::middle::after',
      )
    })
    it('uses custom object stringification for interpolation values', () => {
      const value = {
        toString() {
          return 'custom-value'
        },
      }
      const strings =
        createTemplateStrings([
          'value: ',
          ';',
        ])
      expect(
        buildConfigTemplate(
          strings,
          [
            value,
          ],
        ),
      ).toBe(
        'value: custom-value;',
      )
    })
    it('ignores extra values beyond the available template interpolation slots', () => {
      const strings =
        createTemplateStrings([
          'before',
          'after',
        ])
      expect(
        buildConfigTemplate(
          strings,
          [
            ' inserted ',
            'ignored',
          ],
        ),
      ).toBe(
        'before inserted after',
      )
    })
    it('handles fewer values than interpolation slots by leaving unmatched string segments intact', () => {
      const strings =
        createTemplateStrings([
          'first:',
          ':second:',
          ':third',
        ])
      expect(
        buildConfigTemplate(
          strings,
          [
            'one',
          ],
        ),
      ).toBe(
        'first:one:second::third',
      )
    })
    it('does not mutate the template strings or values arrays', () => {
      const strings =
        createTemplateStrings([
          'prefix:',
          ';',
        ])
      const values:
        readonly unknown[] = [
          'app',
        ]
      const stringsBefore = [
        ...strings,
      ]
      const valuesBefore = [
        ...values,
      ]
      buildConfigTemplate(
        strings,
        values,
      )
      expect([
        ...strings,
      ]).toEqual(
        stringsBefore,
      )
      expect([
        ...values,
      ]).toEqual(
        valuesBefore,
      )
    })
  })
  describe('clearObject', () => {
    it('removes all enumerable own string keys from a mutable object', () => {
      const target: Record<
        string,
        unknown
      > = {
        prefix: 'app',
        debug: true,
        minify: false,
      }
      clearObject(target)
      expect(target).toEqual({})
      expect(
        Object.keys(target),
      ).toEqual([])
    })
    it('mutates and preserves the original object identity', () => {
      const target = {
        value: 42,
      }
      const identity = target
      clearObject(target)
      expect(target).toBe(identity)
      expect(target).toEqual({})
    })
    it('clears enumerable properties from null-prototype accumulators', () => {
      const target =
        Object.create(
          null,
        ) as Record<
          string,
          unknown
        >
      target.primary = 'red'
      target.secondary = 'blue'
      clearObject(target)
      expect(
        Object.keys(target),
      ).toEqual([])
      expect(target.primary).toBeUndefined()
      expect(target.secondary).toBeUndefined()
    })
    it('does not remove non-enumerable own properties', () => {
      const target: Record<
        string,
        unknown
      > = {
        enumerable: true,
      }
      Object.defineProperty(
        target,
        'hidden',
        {
          value: 42,
          enumerable: false,
          configurable: true,
        },
      )
      clearObject(target)
      expect(
        'enumerable' in target,
      ).toBe(false)
      expect(
        Object.prototype.hasOwnProperty.call(
          target,
          'hidden',
        ),
      ).toBe(true)
      expect(target.hidden).toBe(42)
    })
    it('does not remove symbol-keyed properties', () => {
      const symbol =
        Symbol('internal')
      const target = {
        enumerable: true,
        [symbol]: 'preserved',
      }
      clearObject(target)
      expect(
        Object.keys(target),
      ).toEqual([])
      expect(target[symbol]).toBe(
        'preserved',
      )
    })
    it('does not modify enumerable properties inherited from the prototype', () => {
      const prototype = {
        inherited: 'keep-me',
      }
      const target =
        Object.create(
          prototype,
        ) as Record<
          string,
          unknown
        >
      target.own = 'remove-me'
      clearObject(target)
      expect(
        Object.prototype.hasOwnProperty.call(
          target,
          'own',
        ),
      ).toBe(false)
      expect(target.inherited).toBe(
        'keep-me',
      )
      expect(prototype).toEqual({
        inherited: 'keep-me',
      })
    })
    it('is idempotent when clearing an already empty object', () => {
      const target = {}
      clearObject(target)
      clearObject(target)
      expect(target).toEqual({})
    })
  })
  describe('configuration merge integration', () => {
    it('supports the parser use case of sequential config and theme accumulation without cross-mutation', () => {
      const config:
        Partial<
          Mutable<CipoConfig>
        > = {}
      mergeConfigPatch(
        config,
        {
          prefix: 'app',
          breakpoints: {
            sm: '(min-width: 640px)',
          },
        },
      )
      mergeConfigPatch(
        config,
        {
          minify: true,
          breakpoints: {
            lg: '(min-width: 1024px)',
          },
        },
      )
      const baseTheme:
        CipoTheme = {
          colors: {
            primary: 'red',
          },
        }
      const extension:
        CipoTheme = {
          colors: {
            secondary: 'blue',
          },
        }
      const theme =
        mergeTheme(
          baseTheme,
          extension,
        )
      expect(config).toEqual({
        prefix: 'app',
        minify: true,
        breakpoints: {
          sm: '(min-width: 640px)',
          lg: '(min-width: 1024px)',
        },
      })
      expect(theme).toEqual({
        colors: {
          primary: 'red',
          secondary: 'blue',
        },
      })
      expect(baseTheme).toEqual({
        colors: {
          primary: 'red',
        },
      })
      expect(extension).toEqual({
        colors: {
          secondary: 'blue',
        },
      })
    })
  })
})
function createTemplateStrings(
  values: readonly string[],
): TemplateStringsArray {
  const strings = [
    ...values,
  ] as unknown as TemplateStringsArray
  Object.defineProperty(
    strings,
    'raw',
    {
      value: [
        ...values,
      ],
    },
  )
  return strings
}
