import { describe, expect, it } from 'vitest'
import {
  classifyAtRule,
  isStylesheetAtRuleName,
  type CipoAtRuleKind,
} from './at-rule-kind'
describe('at-rule classification', () => {
  describe('classifyAtRule', () => {
    it.each([
      ['@keyframes fade', 'keyframes'],
      ['@keyframes', 'keyframes'],
      ['@-webkit-keyframes fade', 'keyframes'],
      ['@-WEBKIT-KEYFRAMES fade', 'keyframes'],
    ] satisfies readonly [string, CipoAtRuleKind][])(
      'classifies %j as %s',
      (name, expected) => {
        expect(
          classifyAtRule(name),
        ).toBe(expected)
      },
    )
    it.each([
      ['@font-face', 'declaration-block'],
      ['@font-face screen-font', 'declaration-block'],
      ['@property --brand-color', 'declaration-block'],
      ['@PROPERTY --spacing', 'declaration-block'],
    ] satisfies readonly [string, CipoAtRuleKind][])(
      'classifies declaration-block at-rule %j as %s',
      (name, expected) => {
        expect(
          classifyAtRule(name),
        ).toBe(expected)
      },
    )
    it.each([
      '@media (min-width: 768px)',
      '@supports (display: grid)',
      '@container sidebar (width > 30rem)',
      '@layer components',
      '@scope (.card)',
      '@starting-style',
    ])(
      'classifies conditional at-rule %j',
      (name) => {
        expect(
          classifyAtRule(name),
        ).toBe('conditional')
      },
    )
    it('classifies @page independently from declaration and conditional blocks', () => {
      expect(
        classifyAtRule('@page'),
      ).toBe('page')
      expect(
        classifyAtRule('@page :first'),
      ).toBe('page')
    })
    it('normalizes surrounding whitespace before classification', () => {
      expect(
        classifyAtRule(
          '   @media (width >= 40rem)   ',
        ),
      ).toBe('conditional')
      expect(
        classifyAtRule(
          '\n\t@keyframes fade\t',
        ),
      ).toBe('keyframes')
    })
    it('classifies names case-insensitively', () => {
      expect(
        classifyAtRule(
          '@MEDIA (min-width: 1px)',
        ),
      ).toBe('conditional')
      expect(
        classifyAtRule(
          '@Font-Face',
        ),
      ).toBe('declaration-block')
      expect(
        classifyAtRule(
          '@PAGE',
        ),
      ).toBe('page')
    })
    it.each([
      '@charset "UTF-8"',
      '@import "./theme.css"',
      '@namespace svg url(http://www.w3.org/2000/svg)',
      '@counter-style custom',
      '@font-feature-values Font',
      '@unknown something',
      '@-moz-keyframes fade',
      '',
      'media',
      'keyframes',
      'font-face',
    ])(
      'classifies unsupported at-rule %j as unknown',
      (name) => {
        expect(
          classifyAtRule(name),
        ).toBe('unknown')
      },
    )
    it('requires an at-rule keyword boundary and rejects prefix lookalikes', () => {
      expect(
        classifyAtRule(
          '@media-query something',
        ),
      ).toBe('unknown')
      expect(
        classifyAtRule(
          '@supports-grid',
        ),
      ).toBe('unknown')
      expect(
        classifyAtRule(
          '@font-face-extra',
        ),
      ).toBe('unknown')
      expect(
        classifyAtRule(
          '@page-layout',
        ),
      ).toBe('unknown')
      expect(
        classifyAtRule(
          '@keyframes-extra',
        ),
      ).toBe('unknown')
    })
    it('does not confuse an at-rule name appearing later in arbitrary text with a root at-rule', () => {
      expect(
        classifyAtRule(
          'selector @media (min-width: 1px)',
        ),
      ).toBe('unknown')
      expect(
        classifyAtRule(
          '/* @keyframes fade */',
        ),
      ).toBe('unknown')
    })
    it('keeps vendor keyframe support deliberately limited to WebKit', () => {
      expect(
        classifyAtRule(
          '@-webkit-keyframes fade',
        ),
      ).toBe('keyframes')
      expect(
        classifyAtRule(
          '@-moz-keyframes fade',
        ),
      ).toBe('unknown')
      expect(
        classifyAtRule(
          '@-ms-keyframes fade',
        ),
      ).toBe('unknown')
    })
  })
  describe('isStylesheetAtRuleName', () => {
    it.each([
      '@keyframes fade',
      '@-webkit-keyframes fade',
      '@font-face',
      '@property --brand-color',
      '@page',
      '@media (min-width: 768px)',
      '@supports (display: grid)',
      '@container sidebar',
      '@layer components',
      '@scope (.card)',
      '@starting-style',
    ])(
      'accepts supported root stylesheet at-rule %j',
      (name) => {
        expect(
          isStylesheetAtRuleName(name),
        ).toBe(true)
      },
    )
    it.each([
      '@charset "UTF-8"',
      '@import "./theme.css"',
      '@namespace svg',
      '@counter-style custom',
      '@unknown',
      '@media-query',
      '@font-face-extra',
      '',
    ])(
      'rejects unsupported root stylesheet at-rule %j',
      (name) => {
        expect(
          isStylesheetAtRuleName(name),
        ).toBe(false)
      },
    )
    it('remains behaviorally equivalent to checking classifyAtRule against unknown', () => {
      const cases = [
        '@keyframes fade',
        '@-webkit-keyframes fade',
        '@font-face',
        '@property --x',
        '@page',
        '@media print',
        '@supports (display: grid)',
        '@container card',
        '@layer utilities',
        '@scope (.root)',
        '@starting-style',
        '@import "./style.css"',
        '@unknown',
        '@media-query',
        '',
      ]
      for (const name of cases) {
        expect(
          isStylesheetAtRuleName(name),
        ).toBe(
          classifyAtRule(name) !== 'unknown',
        )
      }
    })
  })
  describe('compiler grammar contract', () => {
    it('keeps structurally different at-rule families distinct', () => {
      const cases = new Map<
        CipoAtRuleKind,
        string[]
      >([
        [
          'conditional',
          [
            '@media print',
            '@supports (display: grid)',
            '@container card',
          ],
        ],
        [
          'keyframes',
          [
            '@keyframes fade',
            '@-webkit-keyframes fade',
          ],
        ],
        [
          'declaration-block',
          [
            '@font-face',
            '@property --brand',
          ],
        ],
        [
          'page',
          [
            '@page',
          ],
        ],
      ])
      for (
        const [
          expectedKind,
          names,
        ] of cases
      ) {
        for (const name of names) {
          expect(
            classifyAtRule(name),
            `${name} should preserve its structural grammar family`,
          ).toBe(expectedKind)
        }
      }
    })
    it('does not accidentally promote newly encountered CSS at-rules into the supported compiler grammar', () => {
      const unsupported = [
        '@charset',
        '@import',
        '@namespace',
        '@counter-style',
        '@font-feature-values',
        '@color-profile',
        '@position-try',
      ]
      for (const name of unsupported) {
        expect(
          classifyAtRule(name),
        ).toBe('unknown')
        expect(
          isStylesheetAtRuleName(name),
        ).toBe(false)
      }
    })
  })
})
