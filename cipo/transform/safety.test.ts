import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  runtime: {
    config: {
      prefix: 'cp',
    },
  },
  installNativePropertyGuards: vi.fn(),
}))
vi.mock('../runtime', () => ({
  runtime: mocks.runtime,
}))
vi.mock('../native-property-guards', () => ({
  installNativePropertyGuards:
    mocks.installNativePropertyGuards,
}))
import {
  expandCoreSizeCalls,
  finalizeCoreCssOutput,
  joinNestedSelectorLists,
  normalizeCompactRuntimeBlocks,
  normalizePropertyDirectiveNames,
  normalizeTemplateChunk,
  prepareCoreCssInput,
  protectNativeSlashes,
  resolveRemainingRuntimeVars,
  restoreNativeSlashes,
} from './safety'
describe('core CSS transform safety', () => {
  beforeEach(() => {
    mocks.runtime.config.prefix = 'cp'
  })
  describe('prepareCoreCssInput', () => {
    it('runs property normalization, compact-block normalization, size expansion and native slash protection', () => {
      const result =
        prepareCoreCssInput(
          [
            '@property $$layoutGap { syntax: "<length>"; }',
            '.card { size(10px, 20px); font: 16px/1.4 "Inter"; }',
          ].join('\n'),
        )
      expect(result).toContain(
        '@property --cp-layout-gap',
      )
      expect(result).toContain(
        'w: 10px;',
      )
      expect(result).toContain(
        'h: 20px',
      )
      expect(result).toContain('var(--cipo-internal-native-slash-7f3c, /)')
      expect(result).toContain('"Inter"')
    })
    it('installs native property guards at most once for the loaded module instance', () => {
      prepareCoreCssInput(
        'color:red;',
      )
      prepareCoreCssInput(
        'display:block;',
      )
      prepareCoreCssInput(
        'font:16px/1.4 sans-serif;',
      )
      expect(
        mocks.installNativePropertyGuards.mock.calls.length,
      ).toBeLessThanOrEqual(1)
    })
  })
  describe('normalizeCompactRuntimeBlocks', () => {
    it('moves compact declarations onto their own line after an opening brace', () => {
      expect(
        normalizeCompactRuntimeBlocks(
          '.button{ color:red;}',
        ),
      ).toBe([
        '.button{',
        'color:red;',
        '}',
      ].join('\n'))
    })
    it('leaves ordinary compact CSS unchanged without the runtime-block spacing cue', () => {
      expect(
        normalizeCompactRuntimeBlocks(
          '.button{color:red; }',
        ),
      ).toBe('.button{color:red; }')
    })
    it('normalizes both compact block boundaries together', () => {
      expect(
        normalizeCompactRuntimeBlocks(
          '.button{ color:red; }',
        ),
      ).toBe([
        '.button{',
        'color:red;',
        '}',
      ].join('\n'))
    })
    it('supports hash-prefixed compact content', () => {
      expect(
        normalizeCompactRuntimeBlocks(
          '.scope{ #child{color:red;} }',
        ),
      ).toBe([
        '.scope{',
        '#child{color:red;',
        '}',
        '}',
      ].join('\n'))
    })
    it('supports dollar-prefixed runtime DSL content', () => {
      expect(
        normalizeCompactRuntimeBlocks(
          '.scope{ $$token: red; }',
        ),
      ).toBe([
        '.scope{',
        '$$token: red;',
        '}',
      ].join('\n'))
    })
    it('does not rewrite matching syntax inside double-quoted strings', () => {
      const input =
        '.label{content:"{ color:red; }";}'
      expect(
        normalizeCompactRuntimeBlocks(
          input,
        ),
      ).toBe(input)
    })
    it('does not rewrite matching syntax inside single-quoted strings', () => {
      const input =
        ".label{content:'{ color:red; }';}"
      expect(
        normalizeCompactRuntimeBlocks(
          input,
        ),
      ).toBe(input)
    })
    it('does not rewrite matching syntax inside CSS comments', () => {
      const input =
        '/* .button{ color:red; } */'
      expect(
        normalizeCompactRuntimeBlocks(
          input,
        ),
      ).toBe(input)
    })
  })
  describe('expandCoreSizeCalls', () => {
    it('expands one size argument into equal width and height aliases', () => {
      expect(
        expandCoreSizeCalls(
          'size(20px)',
        ),
      ).toBe([
        'w: 20px;',
        'h: 20px',
      ].join('\n'))
    })
    it('expands separate width and height arguments', () => {
      expect(
        expandCoreSizeCalls(
          'size(20px, 40px)',
        ),
      ).toBe([
        'w: 20px;',
        'h: 40px',
      ].join('\n'))
    })
    it('preserves indentation for generated width and height aliases', () => {
      expect(
        expandCoreSizeCalls(
          '  size(20px, 40px)',
        ),
      ).toBe([
        '  w: 20px;',
        '  h: 40px',
      ].join('\n'))
    })
    it('expands size calls after a declaration delimiter', () => {
      expect(
        expandCoreSizeCalls(
          'color:red; size(20px)',
        ),
      ).toBe([
        'color:red; w: 20px;',
        ' h: 20px',
      ].join('\n'))
    })
    it('preserves nested function commas inside width arguments', () => {
      expect(
        expandCoreSizeCalls(
          'size(clamp(10px, 20vw, 40px))',
        ),
      ).toBe([
        'w: clamp(10px, 20vw, 40px);',
        'h: clamp(10px, 20vw, 40px)',
      ].join('\n'))
    })
    it('supports nested functions independently in width and height', () => {
      expect(
        expandCoreSizeCalls(
          'size(min(100%, 40rem), calc(100vh - 2rem))',
        ),
      ).toBe([
        'w: min(100%, 40rem);',
        'h: calc(100vh - 2rem)',
      ].join('\n'))
    })
    it('removes an empty size call instead of generating empty declarations', () => {
      expect(
        expandCoreSizeCalls(
          'before;size();after;',
        ),
      ).toBe(
        'before;after;',
      )
    })
    it('does not rewrite size() when embedded inside another value', () => {
      const input =
        'value:fn(size(20px));'
      expect(
        expandCoreSizeCalls(
          input,
        ),
      ).toBe(input)
    })
    it('does not rewrite size() inside quoted strings', () => {
      const input =
        'content:"size(20px)";'
      expect(
        expandCoreSizeCalls(
          input,
        ),
      ).toBe(input)
    })
    it('does not rewrite size() inside comments', () => {
      const input =
        '/* size(20px) */'
      expect(
        expandCoreSizeCalls(
          input,
        ),
      ).toBe(input)
    })
    it('does not expand size calls whose arguments contain block syntax', () => {
      const input =
        'size({invalid})'
      expect(
        expandCoreSizeCalls(
          input,
        ),
      ).toBe(input)
    })
  })
  describe('normalizePropertyDirectiveNames', () => {
    it('converts a runtime token property directive into a prefixed CSS custom property', () => {
      expect(
        normalizePropertyDirectiveNames(
          '@property $$spacing',
        ),
      ).toBe(
        '@property --cp-spacing',
      )
    })
    it('uses the active runtime prefix', () => {
      mocks.runtime.config.prefix =
        'application'
      expect(
        normalizePropertyDirectiveNames(
          '@property $$spacing',
        ),
      ).toBe(
        '@property --application-spacing',
      )
    })
    it('converts mixed-case names to kebab case', () => {
      expect(
        normalizePropertyDirectiveNames(
          '@property $$primaryColor',
        ),
      ).toBe(
        '@property --cp-primary-color',
      )
    })
    it('normalizes dots and underscores to hyphens', () => {
      expect(
        normalizePropertyDirectiveNames(
          '@property $$theme.primary_color',
        ),
      ).toBe(
        '@property --cp-theme-primary-color',
      )
    })
    it('normalizes multiple property directives independently', () => {
      expect(
        normalizePropertyDirectiveNames(
          [
            '@property $$first { syntax: "<length>"; }',
            '@property $$second { syntax: "<color>"; }',
          ].join('\n'),
        ),
      ).toBe([
        '@property --cp-first { syntax: "<length>"; }',
        '@property --cp-second { syntax: "<color>"; }',
      ].join('\n'))
    })
    it('preserves ordinary native @property directives', () => {
      const input =
        '@property --native-token { syntax: "<color>"; }'
      expect(
        normalizePropertyDirectiveNames(
          input,
        ),
      ).toBe(input)
    })
    it('does not rewrite property-like syntax inside quoted strings', () => {
      const input =
        'content:"@property $$secret";'
      expect(
        normalizePropertyDirectiveNames(
          input,
        ),
      ).toBe(input)
    })
    it('does not rewrite property-like syntax inside comments', () => {
      const input =
        '/* @property $$secret */'
      expect(
        normalizePropertyDirectiveNames(
          input,
        ),
      ).toBe(input)
    })
  })
  describe('protectNativeSlashes', () => {
    const protectedSlash =
      'var(--cipo-internal-native-slash-7f3c, /)'
    it('protects slash grammar in font shorthand values', () => {
      expect(
        protectNativeSlashes(
          'font:16px/1.4 sans-serif;',
        ),
      ).toBe(
        `font:16px${protectedSlash}1.4 sans-serif;`,
      )
    })
    it('protects slash grammar in aspect-ratio values', () => {
      expect(
        protectNativeSlashes(
          'aspect-ratio:16/9;',
        ),
      ).toBe(
        `aspect-ratio:16${protectedSlash}9;`,
      )
    })
    it('protects slash grammar in grid declarations', () => {
      expect(
        protectNativeSlashes(
          'grid: auto-flow / 1fr 1fr;',
        ),
      ).toBe(
        `grid: auto-flow ${protectedSlash} 1fr 1fr;`,
      )
    })
    it.each([
      'grid-template',
      'grid-template-columns',
      'grid-template-rows',
      'grid-area',
      'grid-row',
      'grid-column',
    ])(
      'protects slash grammar for %s',
      (property) => {
        const input =
          `${property}:a/b;`
        expect(
          protectNativeSlashes(
            input,
          ),
        ).toBe(
          `${property}:a${protectedSlash}b;`,
        )
      },
    )
    it('matches protected property names case-insensitively', () => {
      expect(
        protectNativeSlashes(
          'FONT:16px/1.4 sans-serif;',
        ),
      ).toBe(
        `FONT:16px${protectedSlash}1.4 sans-serif;`,
      )
    })
    it('does not protect slash operators in unrelated properties', () => {
      const input =
        'width:100%/2;'
      expect(
        protectNativeSlashes(
          input,
        ),
      ).toBe(input)
    })
    it('does not protect slashes inside quoted font-family names', () => {
      const result =
        protectNativeSlashes(
          'font:16px/1.4 "A/B Font";',
        )
      expect(result).toBe(
        `font:16px${protectedSlash}1.4 "A/B Font";`,
      )
    })
    it('does not protect slashes inside single-quoted strings', () => {
      const result =
        protectNativeSlashes(
          "font:16px/1.4 'A/B Font';",
        )
      expect(result).toBe(
        `font:16px${protectedSlash}1.4 'A/B Font';`,
      )
    })
    it('does not protect slash text inside block comments', () => {
      const result =
        protectNativeSlashes(
          'font:16px/1.4 /* preserve/a/b */ sans-serif;',
        )
      expect(result).toBe(
        `font:16px${protectedSlash}1.4 /* preserve/a/b */ sans-serif;`,
      )
    })
    it('protects multiple unquoted native slashes in one declaration', () => {
      expect(
        protectNativeSlashes(
          'grid:a/b/c;',
        ),
      ).toBe(
        `grid:a${protectedSlash}b${protectedSlash}c;`,
      )
    })
    it('handles compact declarations inside selector blocks', () => {
      expect(
        protectNativeSlashes(
          '.card{aspect-ratio:16/9;}',
        ),
      ).toBe(
        `.card{aspect-ratio:16${protectedSlash}9;}`,
      )
    })
    it('handles multiple protected declarations without corrupting source offsets', () => {
      const result =
        protectNativeSlashes(
          [
            'font:16px/1.4 sans-serif;',
            'aspect-ratio:16/9;',
            'color:red;',
          ].join('\n'),
        )
      expect(result).toBe([
        `font:16px${protectedSlash}1.4 sans-serif;`,
        `aspect-ratio:16${protectedSlash}9;`,
        'color:red;',
      ].join('\n'))
    })
  })
  describe('restoreNativeSlashes', () => {
    it('restores all private native slash markers', () => {
      const marker =
        'var(--cipo-internal-native-slash-7f3c, /)'
      expect(
        restoreNativeSlashes(
          `font:16px${marker}1.4;aspect-ratio:16${marker}9;`,
        ),
      ).toBe(
        'font:16px/1.4;aspect-ratio:16/9;',
      )
    })
    it('is the inverse of slash protection for supported declarations', () => {
      const input = [
        'font:16px/1.4 "Inter";',
        'grid:a/b;',
        'aspect-ratio:16/9;',
      ].join('\n')
      expect(
        restoreNativeSlashes(
          protectNativeSlashes(
            input,
          ),
        ),
      ).toBe(input)
    })
    it('leaves input without markers unchanged', () => {
      const input =
        'color:red;'
      expect(
        restoreNativeSlashes(
          input,
        ),
      ).toBe(input)
    })
  })
  describe('resolveRemainingRuntimeVars', () => {
    it('resolves a simple runtime variable reference', () => {
      expect(
        resolveRemainingRuntimeVars(
          'color:$$brand;',
        ),
      ).toBe(
        'color:var(--cp-brand);',
      )
    })
    it('uses the active runtime prefix', () => {
      mocks.runtime.config.prefix =
        'app'
      expect(
        resolveRemainingRuntimeVars(
          'color:$$brand;',
        ),
      ).toBe(
        'color:var(--app-brand);',
      )
    })
    it('normalizes mixed-case runtime variable names', () => {
      expect(
        resolveRemainingRuntimeVars(
          'color:$$primaryColor;',
        ),
      ).toBe(
        'color:var(--cp-primary-color);',
      )
    })
    it('normalizes dots and underscores in runtime variable names', () => {
      expect(
        resolveRemainingRuntimeVars(
          'color:$$theme.primary_color;',
        ),
      ).toBe(
        'color:var(--cp-theme-primary-color);',
      )
    })
    it('resolves multiple runtime references independently', () => {
      expect(
        resolveRemainingRuntimeVars(
          'margin:$$spaceY $$spaceX;',
        ),
      ).toBe(
        'margin:var(--cp-space-y) var(--cp-space-x);',
      )
    })
    it('does not resolve runtime token declarations on the property side', () => {
      expect(
        resolveRemainingRuntimeVars(
          '$$brand: red;',
        ),
      ).toBe(
        '$$brand: red;',
      )
    })
    it('resolves a declared runtime token when referenced later as a value', () => {
      expect(
        resolveRemainingRuntimeVars(
          '$$brand: red;color:$$brand;',
        ),
      ).toBe(
        '$$brand: red;color:var(--cp-brand);',
      )
    })
    it('does not replace runtime variables embedded inside larger identifiers', () => {
      expect(
        resolveRemainingRuntimeVars(
          'value:prefix$$brand;',
        ),
      ).toBe(
        'value:prefix$$brand;',
      )
    })
    it('does not replace a runtime variable when identifier characters continue after it', () => {
      expect(
        resolveRemainingRuntimeVars(
          'value:$$brand.extra;',
        ),
      ).toBe(
        'value:var(--cp-brand-extra);',
      )
    })
    it('does not resolve runtime references inside double-quoted strings', () => {
      const input =
        'content:"$$secret";'
      expect(
        resolveRemainingRuntimeVars(
          input,
        ),
      ).toBe(input)
    })
    it('does not resolve runtime references inside single-quoted strings', () => {
      const input =
        "content:'$$secret';"
      expect(
        resolveRemainingRuntimeVars(
          input,
        ),
      ).toBe(input)
    })
    it('does not resolve runtime references inside comments', () => {
      const input =
        '/* $$secret */'
      expect(
        resolveRemainingRuntimeVars(
          input,
        ),
      ).toBe(input)
    })
  })
  describe('joinNestedSelectorLists', () => {
    it('joins a multiline nested selector continuation beginning with ampersand', () => {
      expect(
        joinNestedSelectorLists(
          [
            '&:hover,',
            '&:focus{color:red;}',
          ].join('\n'),
        ),
      ).toBe(
        '&:hover,&:focus{color:red;}',
      )
    })
    it('joins multiple consecutive ampersand selector continuations', () => {
      expect(
        joinNestedSelectorLists(
          [
            '&:hover,',
            '&:focus,',
            '&:active{color:red;}',
          ].join('\n'),
        ),
      ).toBe(
        '&:hover,&:focus,&:active{color:red;}',
      )
    })
    it('preserves indentation before the first selector', () => {
      expect(
        joinNestedSelectorLists(
          [
            '  &:hover,',
            '    &:focus{color:red;}',
          ].join('\n'),
        ),
      ).toBe(
        '  &:hover,&:focus{color:red;}',
      )
    })
    it('does not join the next line when it does not begin with ampersand', () => {
      const input = [
        '.button,',
        '.link{color:red;}',
      ].join('\n')
      expect(
        joinNestedSelectorLists(
          input,
        ),
      ).toBe(input)
    })
    it('does not join an ampersand line when the previous line has no trailing comma', () => {
      const input = [
        '&:hover',
        '&:focus{color:red;}',
      ].join('\n')
      expect(
        joinNestedSelectorLists(
          input,
        ),
      ).toBe(input)
    })
    it('repairs whitespace between &: and a pseudo name', () => {
      expect(
        joinNestedSelectorLists(
          '&: hover{color:red;}',
        ),
      ).toBe(
        '&:hover{color:red;}',
      )
    })
    it('repairs pseudo names containing hyphens', () => {
      expect(
        joinNestedSelectorLists(
          '&: focus-visible{color:red;}',
        ),
      ).toBe(
        '&:focus-visible{color:red;}',
      )
    })
    it('does not rewrite selector-like content inside quoted strings', () => {
      const input =
        'content:"&: hover";'
      expect(
        joinNestedSelectorLists(
          input,
        ),
      ).toBe(input)
    })
    it('does not rewrite selector-like content inside comments', () => {
      const input =
        '/* &: hover */'
      expect(
        joinNestedSelectorLists(
          input,
        ),
      ).toBe(input)
    })
    it('preserves ordinary multiline CSS unchanged', () => {
      const input = [
        '.button{',
        '  color:red;',
        '}',
      ].join('\n')
      expect(
        joinNestedSelectorLists(
          input,
        ),
      ).toBe(input)
    })
  })
  describe('normalizeTemplateChunk', () => {
    it('normalizes compact blocks and nested selector lists without prematurely protecting native slash grammar', () => {
      const result =
        normalizeTemplateChunk(
          [
            '.button{ font:16px/1.4 sans-serif; }',
            '&:hover,',
            '&:focus{color:red;}',
          ].join('\n'),
        )
      expect(result).toContain('font:16px/1.4 sans-serif;')
      expect(result).not.toContain('var(--cipo-internal-native-slash-7f3c, /)')
      expect(result).toContain(
        '&:hover,&:focus',
      )
    })
    it('does not expand size() calls in template-chunk normalization', () => {
      expect(
        normalizeTemplateChunk(
          'size(20px)',
        ),
      ).toBe(
        'size(20px)',
      )
    })
    it('does not normalize @property runtime names in template-chunk normalization', () => {
      expect(
        normalizeTemplateChunk(
          '@property $$spacing',
        ),
      ).toBe(
        '@property $$spacing',
      )
    })
  })
  describe('finalizeCoreCssOutput', () => {
    it('restores native slashes before resolving runtime variables and joining selectors', () => {
      const marker =
        'var(--cipo-internal-native-slash-7f3c, /)'
      const result =
        finalizeCoreCssOutput(
          [
            `font:16px${marker}1.4 sans-serif;`,
            'color:$$brand;',
            '&:hover,',
            '&:focus{color:red;}',
          ].join('\n'),
        )
      expect(result).toBe([
        'font:16px/1.4 sans-serif;',
        'color:var(--cp-brand);',
        '&:hover,&:focus{color:red;}',
      ].join('\n'))
    })
    it('is a no-op for source requiring no restoration or normalization', () => {
      const input =
        '.button{color:red;}'
      expect(
        finalizeCoreCssOutput(
          input,
        ),
      ).toBe(input)
    })
  })
  describe('round-trip safety', () => {
    it('preserves native font slash semantics through prepare and finalize', () => {
      const input =
        'font:16px/1.4 "Inter";'
      expect(
        finalizeCoreCssOutput(
          prepareCoreCssInput(
            input,
          ),
        ),
      ).toBe(input)
    })
    it('preserves quoted slash content through prepare and finalize', () => {
      const input =
        'font:16px/1.4 "Font/A";'
      expect(
        finalizeCoreCssOutput(
          prepareCoreCssInput(
            input,
          ),
        ),
      ).toBe(input)
    })
    it('preserves comment slash content through prepare and finalize', () => {
      const input =
        'font:16px/1.4 /* A/B */ sans-serif;'
      expect(
        finalizeCoreCssOutput(
          prepareCoreCssInput(
            input,
          ),
        ),
      ).toBe(input)
    })
    it('produces deterministic results for identical input and runtime configuration', () => {
      const input = [
        '@property $$layoutGap { syntax: "<length>"; }',
        'size(20px, 40px)',
        'font:16px/1.4 sans-serif;',
        'color:$$brand;',
      ].join('\n')
      const first =
        finalizeCoreCssOutput(
          prepareCoreCssInput(
            input,
          ),
        )
      const second =
        finalizeCoreCssOutput(
          prepareCoreCssInput(
            input,
          ),
        )
      expect(second).toBe(first)
    })
    it('uses the current runtime prefix without retaining stale prefix state', () => {
      const first =
        finalizeCoreCssOutput(
          prepareCoreCssInput(
            '@property $$token\ncolor:$$token;',
          ),
        )
      mocks.runtime.config.prefix =
        'app'
      const second =
        finalizeCoreCssOutput(
          prepareCoreCssInput(
            '@property $$token\ncolor:$$token;',
          ),
        )
      expect(first).toContain(
        '--cp-token',
      )
      expect(second).toContain(
        '--app-token',
      )
      expect(second).not.toContain(
        '--cp-token',
      )
    })
  })
  describe('regression contracts', () => {
    it(
      'protectNativeSlashes does not confuse selector pseudo-class colons with declaration property separators',
      () => {
        const output = protectNativeSlashes('a:hover{font:16px/1.4 Arial;}')
        expect(output).toContain('a:hover{font:16px')
        expect(restoreNativeSlashes(output)).toBe('a:hover{font:16px/1.4 Arial;}')
      },
    )
    it(
      'protectNativeSlashes preserves line comments if the input reaches this layer before comment stripping',
      () => {
        const input = `// font:16px/1.4\nfont:16px/1.4 Arial;`
        const protectedCss = protectNativeSlashes(input)
        expect(protectedCss).toContain('// font:16px/1.4')
        expect(restoreNativeSlashes(protectedCss)).toBe(input)
      },
    )
    it(
      'resolveRemainingRuntimeVars defines whether $$token followed by a declaration colon with intervening whitespace is always a declaration rather than a value reference',
      () => {
        expect(resolveRemainingRuntimeVars('$$token : red; color: $$token;')).toBe('$$token : red; color: var(--cp-token);')
      },
    )
    it(
      'joinNestedSelectorLists supports CR-only line endings consistently with CRLF and LF',
      () => {
        expect(joinNestedSelectorLists('&:hover,\r&:focus { color:red; }')).toBe('&:hover,&:focus { color:red; }')
      },
    )
    it(
      'the private native slash sentinel cannot collide with literal user-authored CSS containing the same var() expression',
      () => {
        const sentinel = 'var(--cipo-internal-native-slash-7f3c, /)'
        const input = `.a{content:"${sentinel}";font:16px/1.4 Arial;}`
        expect(restoreNativeSlashes(protectNativeSlashes(input))).toBe(input)
      },
    )
  })
})
