import { describe, expect, it } from 'vitest'
import { optimizeCompiledCss } from './optimizer'
describe('optimizeCompiledCss', () => {
  describe('empty input', () => {
    it.each([
      '',
      ' ',
      '\n',
      '\t',
      '\n\t  \r\n',
    ])(
      'returns an empty string for blank CSS input %j',
      (css) => {
        expect(
          optimizeCompiledCss(css),
        ).toBe('')
      },
    )
  })
  describe('minification', () => {
    it('minifies CSS by default', () => {
      const result = optimizeCompiledCss(`
        .button {
          color: red;
          padding: 8px;
        }
      `)
      expect(result).toContain(
        '.button{color:red;padding:8px}',
      )
    })
    it('preserves readable CSS when minification is explicitly disabled', () => {
      const css = `
        .button {
          color: red;
          padding: 8px;
        }
      `
      const result = optimizeCompiledCss(
        css,
        {
          minify: false,
          mergeEquivalentRules: false,
          mergeEquivalentAtRules: false,
        },
      )
      expect(result).toBe(css.trim())
    })
    it('preserves quoted declaration content during minification', () => {
      const result = optimizeCompiledCss(`
        .label {
          content: "a : b ; c , d";
        }
      `)
      expect(result).toContain(
        '"a : b ; c , d"',
      )
      expect(result).not.toContain(
        '"a:b;c,d"',
      )
    })
    it('preserves single-quoted declaration content during minification', () => {
      const result = optimizeCompiledCss(`
        .label {
          content: 'a : b ; c , d';
        }
      `)
      expect(result).toContain(
        "'a : b ; c , d'",
      )
    })
    it('preserves protocol-relative URLs', () => {
      const result = optimizeCompiledCss(`
        .hero {
          background-image: url(//cdn.example.com/hero.png);
        }
      `)
      expect(result).toContain(
        'url(//cdn.example.com/hero.png)',
      )
    })
    it('preserves quoted URLs containing CSS punctuation', () => {
      const result = optimizeCompiledCss(`
        .hero {
          background-image: url("https://example.com/image:a;b,c.png?x=1");
        }
      `)
      expect(result).toContain(
        'url("https://example.com/image:a;b,c.png?x=1")',
      )
    })
    it('preserves data URLs containing punctuation', () => {
      const result = optimizeCompiledCss(`
        .icon {
          background-image: url("data:image/svg+xml;charset=utf-8,<svg></svg>");
        }
      `)
      expect(result).toContain(
        'data:image/svg+xml;charset=utf-8,<svg></svg>',
      )
    })
    it('preserves custom property values containing spaces and punctuation inside strings', () => {
      const result = optimizeCompiledCss(`
        :root {
          --message: "a : b ; c";
        }
      `)
      expect(result).toContain(
        '--message:"a : b ; c"',
      )
    })
  })
  describe('private custom property mangling', () => {
    it('mangles only custom properties matching the explicitly provided pattern', () => {
      const result = optimizeCompiledCss(
        `
          .button {
            --_cipo-private-color: red;
            --public-color: blue;
            color: var(--_cipo-private-color);
            background: var(--public-color);
          }
        `,
        {
          privateCustomPropertyPattern:
            /^--_cipo-/,
        },
      )
      expect(result).not.toContain(
        '--_cipo-private-color',
      )
      expect(result).toContain(
        '--public-color',
      )
      expect(result).toContain(
        'var(--public-color)',
      )
    })
    it('keeps private custom property declarations and references synchronized after mangling', () => {
      const result = optimizeCompiledCss(
        `
          .button {
            --_cipo-token: red;
            color: var(--_cipo-token);
          }
        `,
        {
          privateCustomPropertyPattern:
            /^--_cipo-/,
        },
      )
      const declarationMatch =
        result.match(
          /(--[A-Za-z0-9_-]+):red/,
        )
      expect(declarationMatch).not.toBeNull()
      const mangledName =
        declarationMatch?.[1]
      expect(mangledName).toBeDefined()
      expect(result).toContain(
        `var(${mangledName})`,
      )
    })
    it('does not mangle public custom properties when no private pattern is configured', () => {
      const result = optimizeCompiledCss(`
        .button {
          --public-color: red;
          color: var(--public-color);
        }
      `)
      expect(result).toContain(
        '--public-color',
      )
      expect(result).toContain(
        'var(--public-color)',
      )
    })
    it('does not rewrite matching custom-property-like text inside strings', () => {
      const result = optimizeCompiledCss(
        `
          .label {
            --_cipo-color: red;
            content: "--_cipo-color";
            color: var(--_cipo-color);
          }
        `,
        {
          privateCustomPropertyPattern:
            /^--_cipo-/,
        },
      )
      expect(result).toContain(
        '"--_cipo-color"',
      )
      expect(
        countOccurrences(
          result,
          '--_cipo-color',
        ),
      ).toBe(1)
    })
  })
  describe('equivalent top-level style rule merging', () => {
    it('merges adjacent top-level style rules with equivalent declaration bodies', () => {
      const result = optimizeCompiledCss(`
        .first {
          color: red;
        }
        .second {
          color: red;
        }
      `)
      expect(result).toBe(
        '.first,.second{color:red}',
      )
    })
    it('canonicalizes harmless declaration whitespace when determining body equivalence', () => {
      const result = optimizeCompiledCss(`
        .first {
          color: red;
          padding: 8px;
        }
        .second {
          color : red ;
          padding : 8px ;
        }
      `)
      expect(result).toBe(
        '.first,.second{color:red;padding:8px}',
      )
    })
    it('does not merge non-adjacent equivalent rules because that would change cascade order', () => {
      const result = optimizeCompiledCss(`
        .a {
          color: red;
        }
        .b {
          color: blue;
        }
        .c {
          color: red;
        }
      `)
      expect(result).toBe(
        [
          '.a{color:red}',
          '.b{color:blue}',
          '.c{color:red}',
        ].join(''),
      )
      expect(result).not.toContain(
        '.a,.c',
      )
    })
    it('preserves the cascade for an element matching both the intervening and final rule', () => {
      const result = optimizeCompiledCss(`
        .a {
          color: red;
        }
        .b {
          color: blue;
        }
        .c {
          color: red;
        }
      `)
      const bIndex =
        result.indexOf(
          '.b{color:blue}',
        )
      const cIndex =
        result.indexOf(
          '.c{color:red}',
        )
      expect(bIndex).toBeGreaterThan(-1)
      expect(cIndex).toBeGreaterThan(-1)
      // `.c` must remain after `.b`. Moving `.c` into `.a` would change the
      // result for an element matching both `.b` and `.c`.
      expect(cIndex).toBeGreaterThan(
        bIndex,
      )
    })
    it('does not merge adjacent rules whose declaration order differs', () => {
      const result = optimizeCompiledCss(`
        .first {
          color: red;
          color: blue;
        }
        .second {
          color: blue;
          color: red;
        }
      `)
      expect(result).toContain(
        '.first{color:red;color:blue}',
      )
      expect(result).toContain(
        '.second{color:blue;color:red}',
      )
      expect(result).not.toContain(
        '.first,.second',
      )
    })
    it('does not merge declaration bodies with different values', () => {
      const result = optimizeCompiledCss(`
        .first {
          color: red;
        }
        .second {
          color: blue;
        }
      `)
      expect(result).toBe(
        '.first{color:red}.second{color:blue}',
      )
    })
    it('does not merge style rules separated by an at-rule', () => {
      const result = optimizeCompiledCss(`
        .first {
          color: red;
        }
        @media (min-width: 768px) {
          .responsive {
            display: block;
          }
        }
        .second {
          color: red;
        }
      `)
      expect(result).not.toContain(
        '.first,.second',
      )
      expect(result.indexOf('.first')).toBeLessThan(
        result.indexOf('@media'),
      )
      expect(result.indexOf('@media')).toBeLessThan(
        result.indexOf('.second'),
      )
    })
    it('can disable equivalent style rule merging explicitly', () => {
      const result = optimizeCompiledCss(
        `
          .first {
            color: red;
          }
          .second {
            color: red;
          }
        `,
        {
          mergeEquivalentRules: false,
        },
      )
      expect(result).toContain(
        '.first{color:red}',
      )
      expect(result).toContain(
        '.second{color:red}',
      )
      expect(result).not.toContain(
        '.first,.second',
      )
    })
    it('does not recursively merge equivalent style rules inside conditional wrappers', () => {
      const result = optimizeCompiledCss(`
        @media (min-width: 768px) {
          .first {
            color: red;
          }
          .second {
            color: red;
          }
        }
      `)
      expect(result).toContain(
        '.first{color:red}.second{color:red}',
      )
      expect(result).not.toContain(
        '.first,.second',
      )
    })
  })
  describe('equivalent grouping at-rule merging', () => {
    it.each([
      '@media (min-width: 768px)',
      '@supports (display: grid)',
      '@container sidebar (width > 30rem)',
    ])(
      'merges adjacent equivalent %s blocks',
      (prelude) => {
        const result = optimizeCompiledCss(`
          ${prelude} {
            .first {
              color: red;
            }
          }
          ${prelude} {
            .second {
              color: blue;
            }
          }
        `)
        expect(
          countOccurrences(
            result,
            `${minifyPrelude(prelude)}{`,
          ),
        ).toBe(1)
        expect(result).toContain(
          '.first{color:red}',
        )
        expect(result).toContain(
          '.second{color:blue}',
        )
      },
    )
    it('normalizes harmless prelude whitespace when comparing adjacent at-rules', () => {
      const result = optimizeCompiledCss(`
        @media   (min-width: 768px) {
          .first {
            color: red;
          }
        }
        @media (min-width: 768px) {
          .second {
            color: blue;
          }
        }
      `)
      expect(
        countOccurrences(
          result,
          '@media',
        ),
      ).toBe(1)
      expect(result).toContain(
        '.first{color:red}',
      )
      expect(result).toContain(
        '.second{color:blue}',
      )
    })
    it('does not merge equivalent at-rules separated by a style rule', () => {
      const result = optimizeCompiledCss(`
        @media (min-width: 768px) {
          .first {
            color: red;
          }
        }
        .separator {
          display: block;
        }
        @media (min-width: 768px) {
          .second {
            color: blue;
          }
        }
      `)
      expect(
        countOccurrences(
          result,
          '@media',
        ),
      ).toBe(2)
    })
    it('does not merge adjacent grouping at-rules with different preludes', () => {
      const result = optimizeCompiledCss(`
        @media (min-width: 768px) {
          .first {
            color: red;
          }
        }
        @media (min-width: 1024px) {
          .second {
            color: blue;
          }
        }
      `)
      expect(
        countOccurrences(
          result,
          '@media',
        ),
      ).toBe(2)
    })
    it('does not merge @layer blocks even when their preludes are identical', () => {
      const result = optimizeCompiledCss(`
        @layer components {
          .first {
            color: red;
          }
        }
        @layer components {
          .second {
            color: blue;
          }
        }
      `)
      expect(
        countOccurrences(
          result,
          '@layer components',
        ),
      ).toBe(2)
    })
    it('does not merge @scope blocks even when their preludes are identical', () => {
      const result = optimizeCompiledCss(`
        @scope (.app) {
          .first {
            color: red;
          }
        }
        @scope (.app) {
          .second {
            color: blue;
          }
        }
      `)
      expect(
        countOccurrences(
          result,
          '@scope',
        ),
      ).toBe(2)
    })
    it('recursively merges adjacent equivalent grouping at-rules inside a layer', () => {
      const result = optimizeCompiledCss(`
        @layer components {
          @media (min-width: 768px) {
            .first {
              color: red;
            }
          }
          @media (min-width: 768px) {
            .second {
              color: blue;
            }
          }
        }
      `)
      expect(
        countOccurrences(
          result,
          '@media',
        ),
      ).toBe(1)
      expect(result).toContain(
        '.first{color:red}',
      )
      expect(result).toContain(
        '.second{color:blue}',
      )
    })
    it('recursively merges adjacent equivalent grouping at-rules inside a scope wrapper', () => {
      const result = optimizeCompiledCss(`
        @scope (.application) {
          @supports (display: grid) {
            .first {
              display: grid;
            }
          }
          @supports (display: grid) {
            .second {
              display: grid;
            }
          }
        }
      `)
      expect(
        countOccurrences(
          result,
          '@supports',
        ),
      ).toBe(1)
      expect(result).toContain(
        '.first{display:grid}',
      )
      expect(result).toContain(
        '.second{display:grid}',
      )
    })
    it('recursively merges nested equivalent grouping at-rules through multiple wrappers', () => {
      const result = optimizeCompiledCss(`
        @layer components {
          @scope (.application) {
            @media (min-width: 768px) {
              .first {
                color: red;
              }
            }
            @media (min-width: 768px) {
              .second {
                color: blue;
              }
            }
          }
        }
      `)
      expect(
        countOccurrences(
          result,
          '@media',
        ),
      ).toBe(1)
    })
    it('does not recursively optimize arbitrary style-rule bodies', () => {
      const result = optimizeCompiledCss(`
        .component {
          color: red;
          @media (min-width: 768px) {
            color: blue;
          }
          @media (min-width: 768px) {
            background: black;
          }
        }
      `)
      // Modern CSS nesting permits declarations and nested rules to coexist
      // inside style-rule bodies. The optimizer intentionally keeps such
      // bodies opaque instead of attempting unsafe rule-list restructuring.
      expect(
        countOccurrences(
          result,
          '@media',
        ),
      ).toBe(2)
    })
    it('merges equivalent grouping at-rules across comments because comments do not form cascade boundaries', () => {
      const result = optimizeCompiledCss(`
        @media (min-width: 768px) {
          .first {
            color: red;
          }
        }
        /* compiler annotation */
        @media (min-width: 768px) {
          .second {
            color: blue;
          }
        }
      `)
      expect(
        countOccurrences(
          result,
          '@media',
        ),
      ).toBe(1)
    })
    it('can disable equivalent at-rule merging explicitly', () => {
      const result = optimizeCompiledCss(
        `
          @media (min-width: 768px) {
            .first {
              color: red;
            }
          }
          @media (min-width: 768px) {
            .second {
              color: blue;
            }
          }
        `,
        {
          mergeEquivalentAtRules: false,
        },
      )
      expect(
        countOccurrences(
          result,
          '@media',
        ),
      ).toBe(2)
    })
    it('does not merge equivalent at-rules by default when minification is disabled', () => {
      const result = optimizeCompiledCss(
        `
          @media (min-width: 768px) {
            .first {
              color: red;
            }
          }
          @media (min-width: 768px) {
            .second {
              color: blue;
            }
          }
        `,
        {
          minify: false,
          mergeEquivalentRules: false,
        },
      )
      expect(
        countOccurrences(
          result,
          '@media',
        ),
      ).toBe(2)
    })
    it('allows at-rule merging to be explicitly enabled even when minification is disabled', () => {
      const result = optimizeCompiledCss(
        `
          @media (min-width: 768px) {
            .first {
              color: red;
            }
          }
          @media (min-width: 768px) {
            .second {
              color: blue;
            }
          }
        `,
        {
          minify: false,
          mergeEquivalentAtRules: true,
          mergeEquivalentRules: false,
        },
      )
      expect(
        countOccurrences(
          result,
          '@media',
        ),
      ).toBe(1)
    })
  })
  describe('rule-list parsing safety', () => {
    it('handles braces inside quoted declaration values without truncating a rule', () => {
      const result = optimizeCompiledCss(`
        .first {
          content: "}";
          color: red;
        }
        .second {
          color: blue;
        }
      `)
      expect(result).toContain(
        'content:"}"',
      )
      expect(result).toContain(
        '.second{color:blue}',
      )
    })
    it('handles opening braces inside quoted declaration values', () => {
      const result = optimizeCompiledCss(`
        .first {
          content: "{";
          color: red;
        }
        .second {
          color: blue;
        }
      `)
      expect(result).toContain(
        'content:"{"',
      )
      expect(result).toContain(
        '.second{color:blue}',
      )
    })
    it('handles semicolons inside quoted selector attributes', () => {
      const result = optimizeCompiledCss(`
        [data-value="a;b"] {
          color: red;
        }
        .next {
          color: blue;
        }
      `)
      expect(result).toContain(
        '[data-value="a;b"]{color:red}',
      )
      expect(result).toContain(
        '.next{color:blue}',
      )
    })
    it('handles braces inside attribute selectors', () => {
      const result = optimizeCompiledCss(`
        [data-value="{example}"] {
          color: red;
        }
      `)
      expect(result).toContain(
        '[data-value="{example}"]{color:red}',
      )
    })
    it('handles semicolons inside functional selector arguments', () => {
      const result = optimizeCompiledCss(`
        .item:is([data-value="a;b"], .other) {
          color: red;
        }
      `)
      expect(result).toContain(
        '.item:is([data-value="a;b"],.other){color:red}',
      )
    })
    it('preserves statement-style at-rules while parsing the surrounding rule list', () => {
      const result = optimizeCompiledCss(`
        @charset "UTF-8";
        .button {
          color: red;
        }
      `)
      expect(result).toContain(
        '@charset "UTF-8";',
      )
      expect(result).toContain(
        '.button{color:red}',
      )
    })
    it('falls back safely rather than partially rewriting malformed unclosed rule lists', () => {
      const css = `
        .button {
          color: red;
      `
      expect(() =>
        optimizeCompiledCss(
          css,
          {
            mergeEquivalentRules: true,
            mergeEquivalentAtRules: true,
          },
        ),
      ).not.toThrow()
    })
  })
  describe('interaction between optimization passes', () => {
    it('minifies before comparing equivalent declaration bodies', () => {
      const result = optimizeCompiledCss(`
        .first {
          color : red ;
        }
        .second {
          color:red;
        }
      `)
      expect(result).toBe(
        '.first,.second{color:red}',
      )
    })
    it('mangles private properties before equivalent-rule comparison', () => {
      const result = optimizeCompiledCss(
        `
          .first {
            --_cipo-token: red;
            color: var(--_cipo-token);
          }
          .second {
            --_cipo-token: red;
            color: var(--_cipo-token);
          }
        `,
        {
          privateCustomPropertyPattern:
            /^--_cipo-/,
        },
      )
      expect(result).toMatch(
        /^\.first,\.second\{/,
      )
      expect(result).not.toContain(
        '--_cipo-token',
      )
    })
    it('merges adjacent at-rules before attempting top-level equivalent style-rule merging', () => {
      const result = optimizeCompiledCss(`
        @media (min-width: 768px) {
          .first {
            color: red;
          }
        }
        @media (min-width: 768px) {
          .second {
            color: blue;
          }
        }
        .third {
          display: block;
        }
        .fourth {
          display: block;
        }
      `)
      expect(
        countOccurrences(
          result,
          '@media',
        ),
      ).toBe(1)
      expect(result).toContain(
        '.third,.fourth{display:block}',
      )
    })
  })
  describe('determinism and idempotence', () => {
    it('produces deterministic output for identical input and options', () => {
      const css = `
        @media (min-width: 768px) {
          .first {
            color: red;
          }
        }
        @media (min-width: 768px) {
          .second {
            color: blue;
          }
        }
        .third {
          padding: 8px;
        }
        .fourth {
          padding: 8px;
        }
      `
      const options = {
        minify: true,
        mergeEquivalentRules: true,
        mergeEquivalentAtRules: true,
        privateCustomPropertyPattern:
          /^--_cipo-/,
      } as const
      const first =
        optimizeCompiledCss(
          css,
          options,
        )
      const second =
        optimizeCompiledCss(
          css,
          options,
        )
      expect(second).toBe(first)
    })
    it('is idempotent for already optimized CSS', () => {
      const css = `
        @layer components {
          @media (min-width: 768px) {
            .first {
              color: red;
            }
          }
          @media (min-width: 768px) {
            .second {
              color: blue;
            }
          }
        }
        .third {
          padding: 8px;
        }
        .fourth {
          padding: 8px;
        }
      `
      const once =
        optimizeCompiledCss(css)
      const twice =
        optimizeCompiledCss(once)
      expect(twice).toBe(once)
    })
    it('remains idempotent with quoted strings, URLs and private custom properties', () => {
      const css = `
        .component {
          --_cipo-private: red;
          content: "a : b ; c";
          background: url(//cdn.example.com/a.png);
          color: var(--_cipo-private);
        }
      `
      const options = {
        privateCustomPropertyPattern:
          /^--_cipo-/,
      }
      const once =
        optimizeCompiledCss(
          css,
          options,
        )
      const twice =
        optimizeCompiledCss(
          once,
          options,
        )
      expect(twice).toBe(once)
    })
  })
  describe('cascade regression contracts', () => {
    it('never groups equal declaration bodies across an intervening rule', () => {
      const css = `
        .red-first {
          color: red;
        }
        .blue {
          color: blue;
        }
        .red-last {
          color: red;
        }
      `
      const result =
        optimizeCompiledCss(css)
      expect(result).toBe(
        '.red-first{color:red}.blue{color:blue}.red-last{color:red}',
      )
    })
    it('never groups equivalent media blocks across an intervening cascade segment', () => {
      const css = `
        @media (min-width: 768px) {
          .target {
            color: red;
          }
        }
        .separator {
          color: green;
        }
        @media (min-width: 768px) {
          .target {
            color: blue;
          }
        }
      `
      const result =
        optimizeCompiledCss(css)
      expect(
        countOccurrences(
          result,
          '@media',
        ),
      ).toBe(2)
      const firstMedia =
        result.indexOf('@media')
      const separator =
        result.indexOf('.separator')
      const secondMedia =
        result.indexOf(
          '@media',
          firstMedia + 1,
        )
      expect(firstMedia).toBeLessThan(
        separator,
      )
      expect(separator).toBeLessThan(
        secondMedia,
      )
    })
    it('preserves declaration order inside merged selectors', () => {
      const result = optimizeCompiledCss(`
        .first {
          color: red;
          color: blue;
        }
        .second {
          color: red;
          color: blue;
        }
      `)
      expect(result).toBe(
        '.first,.second{color:red;color:blue}',
      )
    })
  })
  describe('known optimizer boundaries', () => {
    it.todo(
      'distinguishes malformed CSS from valid CSS instead of silently returning whichever optimization stage completed before parse failure',
    )
    it.todo(
      'defines whether equivalent style rules inside @layer and @scope should eventually be merged recursively',
    )
    it.todo(
      'defines whether comment preservation is required when minify is false but structural merging is enabled',
    )
    it.todo(
      'uses a structured CSS IR for optimizer passes once the entire compiler emission pipeline no longer needs string-level rule-list parsing',
    )
  })
})
function countOccurrences(
  value: string,
  search: string,
): number {
  if (!search) {
    return 0
  }
  let count = 0
  let offset = 0
  while (true) {
    const index = value.indexOf(
      search,
      offset,
    )
    if (index === -1) {
      return count
    }
    count += 1
    offset = index + search.length
  }
}
function minifyPrelude(
  value: string,
): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(
      /\s*([:>,+~])\s*/g,
      '$1',
    )
}
