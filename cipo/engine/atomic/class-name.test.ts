import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CipoRuleContext } from '../../types'
const mocks = vi.hoisted(() => ({
  runtime: {
    config: {
      prefix: 'cp',
      debug: false,
      debugOptions: {
        readableClassNames: false,
        includeContext: true,
        maxClassLabelLength: 80,
      },
    },
  },
  hashString64: vi.fn(
    (value: string) =>
      `hash-${value}`,
  ),
  assertGeneratedNameIdentity: vi.fn(),
}))
vi.mock('../../runtime', () => ({
  runtime: mocks.runtime,
}))
vi.mock('../../utils', () => ({
  hashString64: mocks.hashString64,
}))
vi.mock('../hash-registry', () => ({
  assertGeneratedNameIdentity:
    mocks.assertGeneratedNameIdentity,
}))
import {
  createAtomicClassName,
  createReadableAtomicLabel,
  sanitizeAtomicClassSegment,
} from './class-name'
describe('atomic class-name generation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.runtime.config.prefix = 'cp'
    mocks.runtime.config.debug = false
    mocks.runtime.config.debugOptions = {
      readableClassNames: false,
      includeContext: true,
      maxClassLabelLength: 80,
    }
    mocks.hashString64.mockImplementation(
      (value: string) =>
        `hash-${value}`,
    )
  })
  describe('createAtomicClassName', () => {
    it('emits the compact production class shape when debug mode is disabled', () => {
      const className =
        createAtomicClassName(
          'color',
          'red',
          {},
          'color:red',
        )
      expect(
        mocks.hashString64,
      ).toHaveBeenCalledWith(
        'color:red',
      )
      expect(className).toBe(
        'cp-a-hash-color:red',
      )
    })
    it('keeps compact class names when debug is enabled but readable names are disabled', () => {
      mocks.runtime.config.debug = true
      mocks.runtime.config.debugOptions.readableClassNames =
        false
      const className =
        createAtomicClassName(
          'color',
          'red',
          {},
          'color:red',
        )
      expect(className).toBe(
        'cp-a-hash-color:red',
      )
    })
    it('emits a deterministic readable label when debug readable names are enabled', () => {
      mocks.runtime.config.debug = true
      mocks.runtime.config.debugOptions.readableClassNames =
        true
      const className =
        createAtomicClassName(
          'background-color',
          '#FF0000',
          {},
          'background-color:#FF0000',
        )
      expect(className).toBe(
        'cp-background-color-hex-ff0000-hash-background-color:#FF0000',
      )
    })
    it('includes normalized rule context in readable debug class names', () => {
      mocks.runtime.config.debug = true
      mocks.runtime.config.debugOptions.readableClassNames =
        true
      const context: CipoRuleContext = {
        dark: true,
        breakpoint: 'md',
        pseudo: ':hover',
        supports: 'display: grid',
        container: 'sidebar',
        layer: 'components',
      }
      const className =
        createAtomicClassName(
          'color',
          'red',
          context,
          'contextual-rule',
        )
      expect(className).toBe(
        [
          'cp',
          'dark',
          'md',
          'hover',
          'supports',
          'container-sidebar',
          'layer-components',
          'color',
          'red',
          'hash-contextual-rule',
        ].join('-'),
      )
    })
    it('falls back to the atomic label when no readable segments can be produced', () => {
      mocks.runtime.config.debug = true
      mocks.runtime.config.debugOptions.readableClassNames =
        true
      mocks.runtime.config.debugOptions.includeContext =
        false
      const className =
        createAtomicClassName(
          '',
          '',
          {},
          'empty-rule',
        )
      expect(className).toBe(
        'cp-atomic-hash-empty-rule',
      )
    })
    it('uses the configured prefix in both compact and readable modes', () => {
      mocks.runtime.config.prefix =
        'application'
      const compact =
        createAtomicClassName(
          'color',
          'red',
          {},
          'compact',
        )
      mocks.runtime.config.debug = true
      mocks.runtime.config.debugOptions.readableClassNames =
        true
      const readable =
        createAtomicClassName(
          'color',
          'red',
          {},
          'readable',
        )
      expect(compact).toBe(
        'application-a-hash-compact',
      )
      expect(readable).toBe(
        'application-color-red-hash-readable',
      )
    })
    it('asserts generated-name identity using the final class and exact rule id', () => {
      const className =
        createAtomicClassName(
          'display',
          'flex',
          {},
          'display:flex',
        )
      expect(
        mocks.assertGeneratedNameIdentity,
      ).toHaveBeenCalledTimes(1)
      expect(
        mocks.assertGeneratedNameIdentity,
      ).toHaveBeenCalledWith(
        className,
        'display:flex',
      )
    })
    it('uses only the stable rule id as the hash input', () => {
      createAtomicClassName(
        'color',
        'red',
        {
          dark: true,
        },
        'stable-rule-id',
      )
      expect(
        mocks.hashString64,
      ).toHaveBeenCalledTimes(1)
      expect(
        mocks.hashString64,
      ).toHaveBeenCalledWith(
        'stable-rule-id',
      )
    })
    it('produces the same class for repeated calls with the same effective inputs', () => {
      mocks.runtime.config.debug = true
      mocks.runtime.config.debugOptions.readableClassNames =
        true
      const context: CipoRuleContext = {
        dark: true,
        pseudo: ':hover',
      }
      const first =
        createAtomicClassName(
          'color',
          'red',
          context,
          'stable',
        )
      const second =
        createAtomicClassName(
          'color',
          'red',
          context,
          'stable',
        )
      expect(second).toBe(first)
    })
    it('keeps the hash suffix stable when switching between readable and compact presentation', () => {
      const compact =
        createAtomicClassName(
          'color',
          'red',
          {},
          'same-rule',
        )
      mocks.runtime.config.debug = true
      mocks.runtime.config.debugOptions.readableClassNames =
        true
      const readable =
        createAtomicClassName(
          'color',
          'red',
          {},
          'same-rule',
        )
      expect(compact).toEndWith(
        'hash-same-rule',
      )
      expect(readable).toEndWith(
        'hash-same-rule',
      )
    })
  })
  describe('createReadableAtomicLabel', () => {
    beforeEach(() => {
      mocks.runtime.config.debugOptions.includeContext =
        true
      mocks.runtime.config.debugOptions.maxClassLabelLength =
        80
    })
    it('builds a readable declaration label from property and value', () => {
      expect(
        createReadableAtomicLabel(
          'background-color',
          '#FF00AA',
          {},
        ),
      ).toBe(
        'background-color-hex-ff00aa',
      )
    })
    it('omits context segments when includeContext is disabled', () => {
      mocks.runtime.config.debugOptions.includeContext =
        false
      const result =
        createReadableAtomicLabel(
          'color',
          'red',
          {
            dark: true,
            breakpoint: 'md',
            pseudo: ':hover',
          },
        )
      expect(result).toBe(
        'color-red',
      )
    })
    it('emits context segments in a stable canonical order', () => {
      const result =
        createReadableAtomicLabel(
          'color',
          'red',
          {
            layer: 'components',
            container: 'sidebar',
            supports: 'display: grid',
            pseudo: ':focus-visible',
            notBreakpoint: 'lg',
            breakpoint: 'md',
            dark: true,
          },
        )
      expect(result).toBe(
        [
          'dark',
          'md',
          'not-lg',
          'focus-visible',
          'supports',
          'container-sidebar',
          'layer-components',
          'color',
          'red',
        ].join('-'),
      )
    })
    it('uses a generic media segment when mediaQuery exists without a non-base breakpoint', () => {
      expect(
        createReadableAtomicLabel(
          'display',
          'block',
          {
            mediaQuery:
              '(prefers-reduced-motion: reduce)',
          },
        ),
      ).toBe(
        'media-display-block',
      )
    })
    it('uses the explicit breakpoint name instead of a generic media label', () => {
      expect(
        createReadableAtomicLabel(
          'display',
          'block',
          {
            breakpoint: 'md',
            mediaQuery:
              '(min-width: 768px)',
          },
        ),
      ).toBe(
        'md-display-block',
      )
    })
    it('does not emit base as a readable breakpoint segment', () => {
      expect(
        createReadableAtomicLabel(
          'display',
          'block',
          {
            breakpoint: 'base',
          },
        ),
      ).toBe(
        'display-block',
      )
    })
    it('falls back to media when the base breakpoint also carries an explicit media query', () => {
      expect(
        createReadableAtomicLabel(
          'display',
          'block',
          {
            breakpoint: 'base',
            mediaQuery:
              '(orientation: landscape)',
          },
        ),
      ).toBe(
        'media-display-block',
      )
    })
    it('redacts quoted user-authored content from readable labels', () => {
      const result =
        createReadableAtomicLabel(
          'content',
          '"private customer token"',
          {},
        )
      expect(result).toBe(
        'content-string',
      )
      expect(result).not.toContain(
        'private',
      )
      expect(result).not.toContain(
        'customer',
      )
      expect(result).not.toContain(
        'token',
      )
    })
    it('redacts single-quoted user-authored content from readable labels', () => {
      expect(
        createReadableAtomicLabel(
          'content',
          "'secret value'",
          {},
        ),
      ).toBe(
        'content-string',
      )
    })
    it('redacts complete URL values from readable labels', () => {
      const value =
        'url("https://private.example.com/image.png?token=secret")'
      const result =
        createReadableAtomicLabel(
          'background-image',
          value,
          {},
        )
      expect(result).toBe(
        'background-image-url',
      )
      expect(result).not.toContain(
        'private',
      )
      expect(result).not.toContain(
        'token',
      )
      expect(result).not.toContain(
        'secret',
      )
    })
    it('redacts unquoted URL values', () => {
      expect(
        createReadableAtomicLabel(
          'background',
          'url(https://example.com/private.png)',
          {},
        ),
      ).toBe(
        'background-url',
      )
    })
    it('redacts blob URLs', () => {
      const result =
        createReadableAtomicLabel(
          'background-image',
          'blob:https://example.com/123456',
          {},
        )
      expect(result).toBe(
        'background-image-url',
      )
      expect(result).not.toContain(
        '123456',
      )
    })
    it('redacts sensitive values while preserving surrounding non-sensitive CSS structure', () => {
      const result =
        createReadableAtomicLabel(
          'background',
          'linear-gradient(red, blue), url("https://private.example.com/token")',
          {},
        )
      expect(result).toContain(
        'linear-gradient-red-blue',
      )
      expect(result).toContain(
        'url',
      )
      expect(result).not.toContain(
        'private',
      )
      expect(result).not.toContain(
        'token',
      )
    })
    it('truncates the readable portion to the configured maximum length', () => {
      mocks.runtime.config.debugOptions.maxClassLabelLength =
        10
      expect(
        createReadableAtomicLabel(
          'very-long-property',
          'very-long-value',
          {},
        ),
      ).toBe(
        'very-long',
      )
    })
    it('does not leave a trailing hyphen when truncation lands on a separator', () => {
      mocks.runtime.config.debugOptions.maxClassLabelLength =
        6
      const result =
        createReadableAtomicLabel(
          'color',
          'red',
          {},
        )
      expect(result).toBe(
        'color',
      )
      expect(result.endsWith('-')).toBe(
        false,
      )
    })
    it('does not truncate labels shorter than the configured maximum', () => {
      mocks.runtime.config.debugOptions.maxClassLabelLength =
        100
      expect(
        createReadableAtomicLabel(
          'color',
          'red',
          {
            dark: true,
          },
        ),
      ).toBe(
        'dark-color-red',
      )
    })
    it('sanitizes context-derived values before including them in the label', () => {
      const result =
        createReadableAtomicLabel(
          'color',
          'red',
          {
            breakpoint: 'tablet@wide',
            pseudo: ':focus-visible',
            notBreakpoint:
              'mobile/small',
            container:
              'sidebar > main',
            layer:
              'components.ui',
          },
        )
      expect(result).toBe(
        [
          'tablet-wide',
          'not-mobile-per-small',
          'focus-visible',
          'container-sidebar-main',
          'layer-components-dot-ui',
          'color',
          'red',
        ].join('-'),
      )
    })
  })
  describe('sanitizeAtomicClassSegment', () => {
    it.each([
      [
        'COLOR',
        false,
        'color',
      ],
      [
        '  background-color  ',
        false,
        'background-color',
      ],
      [
        'red !important',
        true,
        'red',
      ],
      [
        '-1.5rem',
        true,
        'negative-1-dot-5rem',
      ],
      [
        '50%',
        true,
        '50-pct',
      ],
      [
        '#FF00AA',
        true,
        'hex-ff00aa',
      ],
      [
        '1 + 2',
        true,
        '1-plus-2',
      ],
      [
        '2 * 4',
        true,
        '2-times-4',
      ],
      [
        '16 / 9',
        true,
        '16-per-9',
      ],
      [
        '1.25rem',
        true,
        '1-dot-25rem',
      ],
      [
        'var(--brand-color)',
        true,
        'var-brand-color',
      ],
      [
        'var(--brand-color, red)',
        true,
        'var-brand-color',
      ],
      [
        ':focus-visible',
        false,
        'focus-visible',
      ],
    ] as const)(
      'normalizes %j to %j',
      (
        value,
        isValue,
        expected,
      ) => {
        expect(
          sanitizeAtomicClassSegment(
            value,
            isValue,
          ),
        ).toBe(expected)
      },
    )
    it('collapses repeated separators', () => {
      expect(
        sanitizeAtomicClassSegment(
          'hello___world---again',
        ),
      ).toBe(
        'hello-world-again',
      )
    })
    it('removes unsafe punctuation from arbitrary CSS text', () => {
      expect(
        sanitizeAtomicClassSegment(
          'calc(100% - var(--gap))',
          true,
        ),
      ).toBe(
        'calc-100-pct-var-gap',
      )
    })
    it('trims unsafe leading and trailing separators', () => {
      expect(
        sanitizeAtomicClassSegment(
          '__hello-world---',
        ),
      ).toBe(
        'hello-world',
      )
    })
    it('returns an empty segment for empty input', () => {
      expect(
        sanitizeAtomicClassSegment(
          '',
        ),
      ).toBe('')
    })
    it('removes important case-insensitively', () => {
      expect(
        sanitizeAtomicClassSegment(
          'red !IMPORTANT',
          true,
        ),
      ).toBe('red')
    })
    it('normalizes arbitrary whitespace to safe separators', () => {
      expect(
        sanitizeAtomicClassSegment(
          'hello   beautiful\tworld',
        ),
      ).toBe(
        'hello-beautiful-world',
      )
    })
    it('does not preserve user-controlled quote punctuation', () => {
      expect(
        sanitizeAtomicClassSegment(
          '"hello world"',
          true,
        ),
      ).toBe(
        'hello-world',
      )
    })
  })
  describe('privacy regression contracts', () => {
    it('never exposes quoted secrets in the final readable atomic class name', () => {
      mocks.runtime.config.debug = true
      mocks.runtime.config.debugOptions.readableClassNames =
        true
      const className =
        createAtomicClassName(
          'content',
          '"api-key-super-secret"',
          {},
          'content:"api-key-super-secret"',
        )
      expect(className).toContain(
        'content-string',
      )
      expect(className).not.toContain(
        'api-key',
      )
      expect(className).not.toContain(
        'super-secret',
      )
      // The exact declaration remains represented by the opaque stable hash.
      expect(className).toContain(
        'hash-content:"api-key-super-secret"',
      )
    })
    it('never exposes URL credentials or query tokens in the readable label', () => {
      mocks.runtime.config.debug = true
      mocks.runtime.config.debugOptions.readableClassNames =
        true
      const className =
        createAtomicClassName(
          'background-image',
          'url("https://user:password@example.com/private.png?token=abc123")',
          {},
          'background-image:private-url',
        )
      expect(className).toContain(
        'background-image-url',
      )
      expect(className).not.toContain(
        'password',
      )
      expect(className).not.toContain(
        'abc123',
      )
    })
    it.todo(
      'fully redacts complete unwrapped data URLs including payload content after the comma',
    )
    it.todo(
      'defines whether sensitive content appearing in the ruleId must use a non-reversible production hash implementation before class names can be considered privacy-safe end-to-end',
    )
  })
  describe('context regression contracts', () => {
    it.todo(
      'defines whether multiple simultaneous media contexts need a more descriptive readable label than the generic media segment',
    )
    it.todo(
      'defines whether supports conditions should include a sanitized condition summary rather than the generic supports segment',
    )
    it.todo(
      'defines whether maximum readable-label length should reserve budget for the property segment before context segments consume it',
    )
  })
})
