import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CipoHelperContext } from '../types'
import type { ValueNormalizer } from './contracts'
const mocks = vi.hoisted(() => ({
  normalizePxValues: vi.fn(
    (value: string) =>
      `px(${value})`,
  ),
  runtime: {
    config: {
      prefix: 'cp',
      minify: false,
    },
    warningSink: [] as Array<{ code: string; message: string; source?: string }>,
    helperRegistry:
      new Map<
        string,
        (
          args: string,
          context: CipoHelperContext,
        ) => string
      >(),
  },
}))
vi.mock('../helpers', () => ({
  normalizePxValues:
    mocks.normalizePxValues,
}))
vi.mock('../runtime', () => ({
  runtime: mocks.runtime,
}))
import { createHelperResolver } from './helper-resolution'
describe('helper resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.runtime.helperRegistry.clear()
    mocks.runtime.config.prefix = 'cp'
    mocks.runtime.config.minify = false
    mocks.runtime.warningSink = []
    mocks.normalizePxValues.mockImplementation(
      (value: string) =>
        `px(${value})`,
    )
  })
  describe('createHelperResolver', () => {
    it('creates an isolated resolver bound to its own value normalizer', () => {
      const firstNormalizer =
        vi.fn<ValueNormalizer>(
          (_property, value) =>
            `first(${value})`,
        )
      const secondNormalizer =
        vi.fn<ValueNormalizer>(
          (_property, value) =>
            `second(${value})`,
        )
      mocks.runtime.helperRegistry.set(
        'resolve',
        (
          args,
          context,
        ) =>
          context.resolveValue(args),
      )
      const first =
        createHelperResolver(
          firstNormalizer,
        )
      const second =
        createHelperResolver(
          secondNormalizer,
        )
      expect(
        first(
          'resolve(value)',
        ),
      ).toBe(
        'px(first(value))',
      )
      expect(
        second(
          'resolve(value)',
        ),
      ).toBe(
        'px(second(value))',
      )
    })
  })
  describe('helper discovery', () => {
    it('expands a registered helper call', () => {
      mocks.runtime.helperRegistry.set(
        'alpha',
        (
          args,
        ) =>
          `color-mix(${args})`,
      )
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          'alpha(red / 20%)',
        ),
      ).toBe(
        'px(color-mix(red / 20%))',
      )
    })
    it('supports the legacy x: helper prefix', () => {
      mocks.runtime.helperRegistry.set(
        'alpha',
        (
          args,
        ) =>
          `color-mix(${args})`,
      )
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          'x:alpha(red / 20%)',
        ),
      ).toBe(
        'px(color-mix(red / 20%))',
      )
    })
    it('removes the legacy x: prefix from the expanded result', () => {
      mocks.runtime.helperRegistry.set(
        'alpha',
        () =>
          'resolved',
      )
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          'before x:alpha(red) after',
        ),
      ).toBe(
        'px(before resolved after)',
      )
    })
    it('expands multiple registered helpers in source order', () => {
      mocks.runtime.helperRegistry.set(
        'first',
        (
          args,
        ) =>
          `[first:${args}]`,
      )
      mocks.runtime.helperRegistry.set(
        'second',
        (
          args,
        ) =>
          `[second:${args}]`,
      )
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          'first(a) second(b)',
        ),
      ).toBe(
        'px([first:a] [second:b])',
      )
    })
    it('does not expand helper-like substrings embedded in identifier-like text', () => {
      mocks.runtime.helperRegistry.set(
        'alpha',
        (
          args,
        ) =>
          `[${args}]`,
      )
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          'before-alpha(red)-after',
        ),
      ).toBe(
        'px(before-alpha(red)-after)',
      )
    })
    it('does not expand an unregistered function', () => {
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          'unknown(red)',
        ),
      ).toBe(
        'px(unknown(red))',
      )
    })
    it('does not expand a registered helper name when it is not followed by parentheses', () => {
      mocks.runtime.helperRegistry.set(
        'alpha',
        () =>
          'resolved',
      )
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          'alpha + value',
        ),
      ).toBe(
        'px(alpha + value)',
      )
    })
    it('does not expand a helper name embedded inside a larger identifier', () => {
      mocks.runtime.helperRegistry.set(
        'alpha',
        () =>
          'resolved',
      )
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          'myalpha(red)',
        ),
      ).toBe(
        'px(myalpha(red))',
      )
    })
    it('does not treat a helper suffix after an identifier part as a standalone call', () => {
      mocks.runtime.helperRegistry.set(
        'alpha',
        () =>
          'resolved',
      )
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          'token-alpha(red)',
        ),
      ).toBe(
        'px(token-alpha(red))',
      )
    })
    it('supports underscore-prefixed helper names', () => {
      mocks.runtime.helperRegistry.set(
        '_private',
        (
          args,
        ) =>
          `private(${args})`,
      )
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          '_private(value)',
        ),
      ).toBe(
        'px(private(value))',
      )
    })
    it('supports digits and hyphens after the first helper-name character', () => {
      mocks.runtime.helperRegistry.set(
        'helper-2',
        (
          args,
        ) =>
          `resolved(${args})`,
      )
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          'helper-2(value)',
        ),
      ).toBe(
        'px(resolved(value))',
      )
    })
  })
  describe('balanced parentheses', () => {
    it('preserves nested native CSS functions inside helper arguments', () => {
      mocks.runtime.helperRegistry.set(
        'wrap',
        (
          args,
        ) =>
          `[${args}]`,
      )
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          'wrap(linear-gradient(red, rgb(0, 0, 0)))',
        ),
      ).toBe(
        'px([linear-gradient(red, rgb(0, 0, 0))])',
      )
    })
    it('supports deeply nested parentheses', () => {
      mocks.runtime.helperRegistry.set(
        'wrap',
        (
          args,
        ) =>
          `[${args}]`,
      )
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          'wrap(fn(a, nested(b, deeper(c))))',
        ),
      ).toBe(
        'px([fn(a, nested(b, deeper(c)))])',
      )
    })
    it('ignores closing parentheses inside double-quoted helper arguments', () => {
      mocks.runtime.helperRegistry.set(
        'content',
        (
          args,
        ) =>
          `[${args}]`,
      )
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          'content(")")',
        ),
      ).toBe(
        'px([")"])',
      )
    })
    it('ignores opening parentheses inside quoted helper arguments', () => {
      mocks.runtime.helperRegistry.set(
        'content',
        (
          args,
        ) =>
          `[${args}]`,
      )
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          'content("(")',
        ),
      ).toBe(
        'px(["("])',
      )
    })
    it('ignores parentheses inside single-quoted helper arguments', () => {
      mocks.runtime.helperRegistry.set(
        'content',
        (
          args,
        ) =>
          `[${args}]`,
      )
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          "content(')(')",
        ),
      ).toBe(
        "px([')('])",
      )
    })
    it('preserves escaped quotes while scanning helper arguments', () => {
      mocks.runtime.helperRegistry.set(
        'content',
        (
          args,
        ) =>
          `[${args}]`,
      )
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          String.raw`content("hello \"world)\"")`,
        ),
      ).toBe(
        String.raw`px(["hello \"world)\""])`,
      )
    })
    it('preserves an unclosed helper call without throwing', () => {
      mocks.runtime.helperRegistry.set(
        'alpha',
        () =>
          'resolved',
      )
      const resolveHelpers =
        createResolver()
      expect(() =>
        resolveHelpers(
          'before alpha(red',
        ),
      ).not.toThrow()
      expect(
        resolveHelpers(
          'before alpha(red',
        ),
      ).toBe(
        'px(before alpha(red)',
      )
    })
    it('stops scanning after an unclosed registered helper call and preserves the remaining source', () => {
      mocks.runtime.helperRegistry.set(
        'alpha',
        () =>
          'resolved',
      )
      mocks.runtime.helperRegistry.set(
        'second',
        () =>
          'second-result',
      )
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          'alpha(unclosed second(value)',
        ),
      ).toBe(
        'px(alpha(unclosed second(value))',
      )
    })
  })
  describe('helper context', () => {
    it('passes helper name and raw argument source to the helper', () => {
      const helper =
        vi.fn(
          (
            _args: string,
            _context: CipoHelperContext,
          ) =>
            'resolved',
        )
      mocks.runtime.helperRegistry.set(
        'alpha',
        helper,
      )
      const resolveHelpers =
        createResolver()
      resolveHelpers(
        'alpha(var(--brand) / 20%)',
      )
      expect(helper).toHaveBeenCalledTimes(
        1,
      )
      expect(
        helper.mock.calls[0]?.[0],
      ).toBe(
        'var(--brand) / 20%',
      )
      expect(
        helper.mock.calls[0]?.[1],
      ).toMatchObject({
        name: 'alpha',
        raw:
          'var(--brand) / 20%',
        config:
          mocks.runtime.config,
      })
    })
    it('passes the active runtime config by reference', () => {
      const seenConfigs:
        unknown[] = []
      mocks.runtime.helperRegistry.set(
        'inspect',
        (
          _args,
          context,
        ) => {
          seenConfigs.push(
            context.config,
          )
          return 'resolved'
        },
      )
      const resolveHelpers =
        createResolver()
      resolveHelpers(
        'inspect(value)',
      )
      expect(
        seenConfigs[0],
      ).toBe(
        mocks.runtime.config,
      )
    })
    it('reflects runtime config changes without recreating the resolver', () => {
      const seenPrefixes:
        string[] = []
      mocks.runtime.helperRegistry.set(
        'inspect',
        (
          _args,
          context,
        ) => {
          seenPrefixes.push(
            String(
              context.config.prefix,
            ),
          )
          return 'resolved'
        },
      )
      const resolveHelpers =
        createResolver()
      resolveHelpers(
        'inspect(first)',
      )
      mocks.runtime.config.prefix =
        'app'
      resolveHelpers(
        'inspect(second)',
      )
      expect(seenPrefixes).toEqual([
        'cp',
        'app',
      ])
    })
    it('exposes resolveValue backed by the pipeline value normalizer', () => {
      const normalizeValue =
        vi.fn<ValueNormalizer>(
          (
            property,
            value,
          ) =>
            `${property}<${value}>`,
        )
      mocks.runtime.helperRegistry.set(
        'resolve',
        (
          args,
          context,
        ) =>
          context.resolveValue(
            args,
          ),
      )
      const resolveHelpers =
        createHelperResolver(
          normalizeValue,
        )
      expect(
        resolveHelpers(
          'resolve(10px)',
        ),
      ).toBe(
        'px(helper<10px>)',
      )
      expect(
        normalizeValue,
      ).toHaveBeenCalledWith(
        'helper',
        '10px',
      )
    })
    it('allows helpers to specify a custom property when resolving nested values', () => {
      const normalizeValue =
        vi.fn<ValueNormalizer>(
          (
            property,
            value,
          ) =>
            `${property}<${value}>`,
        )
      mocks.runtime.helperRegistry.set(
        'resolve',
        (
          args,
          context,
        ) =>
          context.resolveValue(
            args,
            'background',
          ),
      )
      const resolveHelpers =
        createHelperResolver(
          normalizeValue,
        )
      expect(
        resolveHelpers(
          'resolve(red)',
        ),
      ).toBe(
        'px(background<red>)',
      )
      expect(
        normalizeValue,
      ).toHaveBeenCalledWith(
        'background',
        'red',
      )
    })
    it('creates a fresh helper context for every helper invocation', () => {
      const contexts:
        CipoHelperContext[] = []
      mocks.runtime.helperRegistry.set(
        'inspect',
        (
          _args,
          context,
        ) => {
          contexts.push(
            context,
          )
          return 'resolved'
        },
      )
      const resolveHelpers =
        createResolver()
      resolveHelpers(
        'inspect(a) inspect(b)',
      )
      expect(contexts).toHaveLength(2)
      expect(
        contexts[0],
      ).not.toBe(
        contexts[1],
      )
      expect(
        contexts.map(
          (context) =>
            context.raw,
        ),
      ).toEqual([
        'a',
        'b',
      ])
    })
  })
  describe('multi-pass expansion', () => {
    it('expands a helper produced by another helper on a later pass', () => {
      mocks.runtime.helperRegistry.set(
        'outer',
        (
          args,
        ) =>
          `inner(${args})`,
      )
      mocks.runtime.helperRegistry.set(
        'inner',
        (
          args,
        ) =>
          `resolved(${args})`,
      )
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          'outer(value)',
        ),
      ).toBe(
        'px(resolved(value))',
      )
    })
    it('expands a deep helper chain across multiple passes', () => {
      mocks.runtime.helperRegistry.set(
        'one',
        () =>
          'two()',
      )
      mocks.runtime.helperRegistry.set(
        'two',
        () =>
          'three()',
      )
      mocks.runtime.helperRegistry.set(
        'three',
        () =>
          'four()',
      )
      mocks.runtime.helperRegistry.set(
        'four',
        () =>
          'done',
      )
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          'one()',
        ),
      ).toBe(
        'px(done)',
      )
    })
    it('can resolve a helper produced next to ordinary source', () => {
      mocks.runtime.helperRegistry.set(
        'first',
        () =>
          'second(value)',
      )
      mocks.runtime.helperRegistry.set(
        'second',
        (
          args,
        ) =>
          `[${args}]`,
      )
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          'before first() after',
        ),
      ).toBe(
        'px(before [value] after)',
      )
    })
    it('stops when a pass produces no changes', () => {
      const helper =
        vi.fn(
          () =>
            'resolved',
        )
      mocks.runtime.helperRegistry.set(
        'helper',
        helper,
      )
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          'helper()',
        ),
      ).toBe(
        'px(resolved)',
      )
      expect(helper).toHaveBeenCalledTimes(
        1,
      )
    })
    it('bounds self-referential helper expansion to twelve passes', () => {
      const helper =
        vi.fn(
          (
            args: string,
          ) =>
            `loop(${args}x)`,
        )
      mocks.runtime.helperRegistry.set(
        'loop',
        helper,
      )
      const resolveHelpers =
        createResolver()
      const result =
        resolveHelpers(
          'loop()',
        )
      expect(
        helper,
      ).toHaveBeenCalledTimes(13)
      expect(result).toBe(
        `px(loop(${
          'x'.repeat(12)
        }))`,
      )
    })
    it('bounds mutually recursive helper expansion to twelve passes', () => {
      const first =
        vi.fn(
          () =>
            'second()',
        )
      const second =
        vi.fn(
          () =>
            'first()',
        )
      mocks.runtime.helperRegistry.set(
        'first',
        first,
      )
      mocks.runtime.helperRegistry.set(
        'second',
        second,
      )
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          'first()',
        ),
      ).toBe(
        'px(first())',
      )
      expect(
        first.mock.calls.length
        + second.mock.calls.length,
      ).toBe(13)
    })
    it('allows a helper chain that resolves on the twelfth pass', () => {
      for (
        let index = 1;
        index <= 12;
        index += 1
      ) {
        const name =
          `h${index}`
        const next =
          index === 12
            ? 'done'
            : `h${index + 1}()`
        mocks.runtime.helperRegistry.set(
          name,
          () => next,
        )
      }
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          'h1()',
        ),
      ).toBe(
        'px(done)',
      )
    })
  })
  describe('normalizePxValues integration', () => {
    it('normalizes px values when no helper exists', () => {
      mocks.normalizePxValues.mockReturnValue(
        '1rem',
      )
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          '16px',
        ),
      ).toBe(
        '1rem',
      )
      expect(
        mocks.normalizePxValues,
      ).toHaveBeenCalledWith(
        '16px',
      )
    })
    it('normalizes px values only after helper expansion stabilizes', () => {
      mocks.runtime.helperRegistry.set(
        'size',
        () =>
          '16px',
      )
      mocks.normalizePxValues.mockImplementation(
        (value: string) =>
          value.replace(
            '16px',
            '1rem',
          ),
      )
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          'size()',
        ),
      ).toBe(
        '1rem',
      )
      expect(
        mocks.normalizePxValues,
      ).toHaveBeenCalledTimes(1)
      expect(
        mocks.normalizePxValues,
      ).toHaveBeenCalledWith(
        '16px',
      )
    })
    it('normalizes px values exactly once after a multi-pass helper chain', () => {
      mocks.runtime.helperRegistry.set(
        'first',
        () =>
          'second()',
      )
      mocks.runtime.helperRegistry.set(
        'second',
        () =>
          '16px',
      )
      const resolveHelpers =
        createResolver()
      resolveHelpers(
        'first()',
      )
      expect(
        mocks.normalizePxValues,
      ).toHaveBeenCalledTimes(1)
      expect(
        mocks.normalizePxValues,
      ).toHaveBeenCalledWith(
        '16px',
      )
    })
    it('normalizes px values exactly once after reaching the maximum pass count', () => {
      mocks.runtime.helperRegistry.set(
        'loop',
        (
          args,
        ) =>
          `loop(${args}x)`,
      )
      const resolveHelpers =
        createResolver()
      resolveHelpers(
        'loop()',
      )
      expect(
        mocks.normalizePxValues,
      ).toHaveBeenCalledTimes(1)
    })
  })
  describe('registry behavior', () => {
    it('reads helpers from the current runtime registry at resolution time', () => {
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          'dynamic(value)',
        ),
      ).toBe(
        'px(dynamic(value))',
      )
      mocks.runtime.helperRegistry.set(
        'dynamic',
        (
          args,
        ) =>
          `resolved(${args})`,
      )
      expect(
        resolveHelpers(
          'dynamic(value)',
        ),
      ).toBe(
        'px(resolved(value))',
      )
    })
    it('stops resolving a helper after it is removed from the registry', () => {
      mocks.runtime.helperRegistry.set(
        'dynamic',
        () =>
          'resolved',
      )
      const resolveHelpers =
        createResolver()
      expect(
        resolveHelpers(
          'dynamic()',
        ),
      ).toBe(
        'px(resolved)',
      )
      mocks.runtime.helperRegistry.delete(
        'dynamic',
      )
      expect(
        resolveHelpers(
          'dynamic()',
        ),
      ).toBe(
        'px(dynamic())',
      )
    })
  })
  describe('determinism', () => {
    it('produces identical output for identical input and registry state', () => {
      mocks.runtime.helperRegistry.set(
        'alpha',
        (
          args,
        ) =>
          `resolved(${args})`,
      )
      const resolveHelpers =
        createResolver()
      const first =
        resolveHelpers(
          'alpha(red)',
        )
      const second =
        resolveHelpers(
          'alpha(red)',
        )
      expect(second).toBe(first)
    })
    it('does not mutate the input value', () => {
      mocks.runtime.helperRegistry.set(
        'alpha',
        (
          args,
        ) =>
          `resolved(${args})`,
      )
      const input =
        'alpha(red)'
      const resolveHelpers =
        createResolver()
      resolveHelpers(input)
      expect(input).toBe(
        'alpha(red)',
      )
    })
  })
  describe('regression contracts', () => {
    it(
      'does not expand helper-like syntax inside double-quoted or single-quoted strings',
      () => {
        mocks.runtime.helperRegistry.set('alpha', (args) => `resolved(${args})`)
        const resolveHelpers = createResolver()
        expect(resolveHelpers(`content:"alpha(red)";other:'alpha(blue)'`)).toBe(`px(content:"alpha(red)";other:'alpha(blue)')`)
      },
    )
    it(
      'does not expand helper-like syntax inside CSS comments',
      () => {
        mocks.runtime.helperRegistry.set('alpha', (args) => `resolved(${args})`)
        const resolveHelpers = createResolver()
        expect(resolveHelpers('/* alpha(red) */ color:blue')).toBe('px(/* alpha(red) */ color:blue)')
      },
    )
    it(
      'uses escape parity instead of checking only the immediately preceding backslash when matching helper parentheses',
      () => {
        mocks.runtime.helperRegistry.set('alpha', (args) => `resolved(${args})`)
        const resolveHelpers = createResolver()
        const input = String.raw`content:"x\\";alpha(red)`
        expect(resolveHelpers(input)).toContain('resolved(red)')
      },
    )
    it(
      'emits a diagnostic or exposes convergence status when helper expansion still changes after the twelve-pass safety limit',
      () => {
        mocks.runtime.helperRegistry.set('loop', () => 'loop()x')
        const resolveHelpers = createResolver()
        resolveHelpers('loop()')
        expect(mocks.runtime.warningSink.some((warning) => warning.code === 'cipo-helper-expansion-limit')).toBe(true)
      },
    )
    it(
      'defines whether legacy x: helper syntax may contain whitespace between the prefix, helper name and opening parenthesis',
      () => {
        mocks.runtime.helperRegistry.set('alpha', (args) => `resolved(${args})`)
        expect(createResolver()('x:  alpha  (red)')).toBe('px(resolved(red))')
      },
    )
    it(
      'shares identifier and balanced-parentheses scanning with the runtime DSL lexer instead of maintaining another local scanner',
      () => {
        mocks.runtime.helperRegistry.set('alpha', (args) => `resolved(${args})`)
        expect(createResolver()('alpha(fn([a,b], c))')).toBe('px(resolved(fn([a,b], c)))')
      },
    )
  })
})
function createResolver(
  normalizeValue: ValueNormalizer =
    (
      _property,
      value,
    ) =>
      value,
): (input: string) => string {
  return createHelperResolver(
    normalizeValue,
  )
}
