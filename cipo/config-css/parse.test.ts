import { beforeEach, describe, expect, it } from 'vitest'
import { CipoCompiledConfigOpcode } from '../compiled-config'
import { typedTheme } from '../theme-value'
import {
  clearPreparedCssConfigCache,
  compileCssConfigPayload,
  getPreparedCssConfig,
} from './parse'
describe('CSS-first configuration parser', () => {
  beforeEach(() => {
    clearPreparedCssConfigCache()
  })
  describe('getPreparedCssConfig', () => {
    it('parses a complete @cipo configuration block', () => {
      const prepared = getPreparedCssConfig(`
        @cipo {
          prefix: app;
          layers: false;
          important: true;
          debug: off;
          minify: yes;
          atomic-min-uses: 3;
          scope: ".app-root";
          debug-overlay: true;
          color-mode: dark;
          dark-selector: "[data-theme=dark]";
          theme-root: ":root";
          theme-validation: strict;
          register-typed-theme-properties: false;
          rem: 18px;
          base-font-size: 20;
        }
      `)
      expect(prepared.config).toMatchObject({
        prefix: 'app',
        layers: false,
        important: true,
        debug: false,
        minify: true,
        atomic: {
          minUses: 3,
        },
        scope: '.app-root',
        debugOverlay: true,
        colorMode: 'dark',
        darkSelector: '[data-theme=dark]',
        themeRootSelector: ':root',
        themeValidation: 'strict',
        registerTypedThemeProperties: false,
        rem: {
          enabled: true,
          baseFontSize: 18,
        },
        baseFontSize: 20,
      })
      expect(prepared.warnings).toEqual([])
      expect(prepared.operations).toHaveLength(1)
      expect(prepared.operations[0]).toMatchObject({
        kind: 'config',
      })
    })
    it('accepts camelCase and kebab-case configuration keys consistently', () => {
      const kebab = getPreparedCssConfig(`
        @cipo {
          atomic-min-uses: 4;
          debug-overlay: true;
          dark-selector: ".dark";
          theme-validation: warn;
          register-typed-theme-properties: true;
          base-font-size: 18;
        }
      `)
      const camel = getPreparedCssConfig(`
        @cipo {
          atomicMinUses: 4;
          debugOverlay: true;
          darkSelector: ".dark";
          themeValidation: warn;
          registerTypedThemeProperties: true;
          baseFontSize: 18;
        }
      `)
      expect(camel.config).toEqual(kebab.config)
    })
    it('parses scope selector and strategy into a structured scope configuration', () => {
      const prepared = getPreparedCssConfig(`
        @cipo {
          scope-selector: "#application";
          scope-strategy: where;
        }
      `)
      expect(prepared.config.scope).toEqual({
        selector: '#application',
        strategy: 'where',
      })
    })
    it('merges scope configuration declared across multiple @cipo blocks', () => {
      const prepared = getPreparedCssConfig(`
        @cipo {
          scope-selector: "#application";
        }
        @cipo {
          scope-strategy: where;
        }
      `)
      expect(prepared.config.scope).toEqual({
        selector: '#application',
        strategy: 'where',
      })
      expect(
        prepared.operations.filter(
          (operation) => operation.kind === 'config',
        ),
      ).toHaveLength(2)
    })
    it('merges repeated configuration blocks while preserving operation order', () => {
      const prepared = getPreparedCssConfig(`
        @cipo {
          prefix: first;
          minify: false;
        }
        @config {
          prefix: second;
          debug: true;
        }
      `)
      expect(prepared.config).toMatchObject({
        prefix: 'second',
        minify: false,
        debug: true,
      })
      expect(
        prepared.operations.map(
          (operation) => operation.kind,
        ),
      ).toEqual([
        'config',
        'config',
      ])
    })
    it('parses breakpoints and normalizes simple widths to media conditions', () => {
      const prepared = getPreparedCssConfig(`
        @breakpoints {
          base: base;
          mobile: null;
          tablet: 768px;
          desktop: "1200px";
          landscape: (orientation: landscape);
        }
      `)
      expect(prepared.config.breakpoints).toEqual({
        base: null,
        mobile: null,
        tablet: '(min-width: 768px)',
        desktop: '(min-width: 1200px)',
        landscape: '(orientation: landscape)',
      })
    })
    it('accepts comma-separated breakpoint map entries', () => {
      const prepared = getPreparedCssConfig(`
        @breakpoints {
          sm: 640px,
          md: 768px,
          lg: 1024px
        }
      `)
      expect(prepared.config.breakpoints).toEqual({
        sm: '(min-width: 640px)',
        md: '(min-width: 768px)',
        lg: '(min-width: 1024px)',
      })
    })
    it('parses nested theme objects without flattening their hierarchy', () => {
      const prepared = getPreparedCssConfig(`
        @theme {
          colors: (
            primary: #3366ff;
            secondary: #ff3366;
          );
          spacing: (
            sm: 4px;
            md: 8px;
          );
        }
      `)
      expect(prepared.theme).toEqual({
        colors: {
          primary: '#3366ff',
          secondary: '#ff3366',
        },
        spacing: {
          sm: '4px',
          md: '8px',
        },
      })
    })
    it('merges theme patches declared across @theme and @tokens blocks', () => {
      const prepared = getPreparedCssConfig(`
        @theme {
          colors: (
            primary: red;
          );
        }
        @tokens {
          colors: (
            secondary: blue;
          );
          spacing: (
            md: 8px;
          );
        }
      `)
      expect(prepared.theme).toEqual({
        colors: {
          primary: 'red',
          secondary: 'blue',
        },
        spacing: {
          md: '8px',
        },
      })
      expect(
        prepared.operations.map(
          (operation) => operation.kind,
        ),
      ).toEqual([
        'theme',
        'theme',
      ])
    })
    it('parses typed theme entries through the shared typedTheme primitive', () => {
      const prepared = getPreparedCssConfig(`
        @theme {
          primary<color>: #3366ff;
          accent<color, register, inherits: false, initial: transparent, validation: strict>: #ff3366;
          spacing<size, no-register, validation: warn>: 8px;
        }
      `)
      expect(prepared.theme.primary).toEqual(
        typedTheme(
          'color',
          '#3366ff',
          {},
        ),
      )
      expect(prepared.theme.accent).toEqual(
        typedTheme(
          'color',
          '#ff3366',
          {
            register: true,
            inherits: false,
            initialValue: 'transparent',
            validation: 'strict',
          },
        ),
      )
      expect(prepared.theme.spacing).toEqual(
        typedTheme(
          'size',
          '8px',
          {
            register: false,
            validation: 'warn',
          },
        ),
      )
    })
    it('supports auto registration mode in typed theme annotations', () => {
      const prepared = getPreparedCssConfig(`
        @theme {
          primary<color, auto>: red;
        }
      `)
      expect(prepared.theme.primary).toEqual(
        typedTheme(
          'color',
          'red',
          {
            register: 'auto',
          },
        ),
      )
    })
    it('does not split commas that belong to ordinary CSS theme values', () => {
      const prepared = getPreparedCssConfig(`
        @theme {
          font-family: Inter, "Helvetica Neue", sans-serif;
          transition: color 120ms ease, background 200ms linear;
          md: 14px,
          lg: 22px;
        }
      `)
      expect(prepared.theme).toMatchObject({
        fontFamily: 'Inter, "Helvetica Neue", sans-serif',
        transition: 'color 120ms ease, background 200ms linear',
        md: '14px',
        lg: '22px',
      })
    })
    it('preserves colons inside quoted theme values', () => {
      const prepared = getPreparedCssConfig(`
        @theme {
          content: "scheme: dark";
          url: "https://example.com/theme.css";
        }
      `)
      expect(prepared.theme).toEqual({
        content: '"scheme: dark"',
        url: '"https://example.com/theme.css"',
      })
    })
    it('registers named aliases and helpers as alias operations', () => {
      const prepared = getPreparedCssConfig(`
        @alias flex-center {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        @helper truncate {
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `)
      expect(prepared.appliedAliases).toEqual([
        'flex-center',
        'truncate',
      ])
      expect(prepared.operations).toEqual([
        {
          kind: 'alias',
          name: 'flex-center',
          cssText: [
            'display: flex;',
            '          align-items: center;',
            '          justify-content: center;',
          ].join('\n'),
        },
        {
          kind: 'alias',
          name: 'truncate',
          cssText: [
            'overflow: hidden;',
            '          text-overflow: ellipsis;',
          ].join('\n'),
        },
      ])
    })
    it('parses custom property definitions', () => {
      const prepared = getPreparedCssConfig(`
        @property --brand-color {
          syntax: "<color>";
          inherits: false;
          initial-value: #000000;
        }
        @property --spacing {
          syntax: "<length>";
          initial: 0px;
        }
      `)
      expect(prepared.appliedProperties).toEqual([
        '--brand-color',
        '--spacing',
      ])
      expect(prepared.operations).toEqual([
        {
          kind: 'property',
          name: '--brand-color',
          definition: {
            syntax: '<color>',
            inherits: false,
            initialValue: '#000000',
          },
        },
        {
          kind: 'property',
          name: '--spacing',
          definition: {
            syntax: '<length>',
            inherits: true,
            initialValue: '0px',
          },
        },
      ])
    })
    it('records presets and plugins without attempting to execute them during parsing', () => {
      const prepared = getPreparedCssConfig(`
        @preset reset;
        @plugin typography;
        @preset application;
      `)
      expect(prepared.appliedPresets).toEqual([
        'reset',
        'application',
      ])
      expect(prepared.appliedPlugins).toEqual([
        'typography',
      ])
      expect(prepared.operations).toEqual([
        {
          kind: 'preset',
          name: 'reset',
        },
        {
          kind: 'plugin',
          name: 'typography',
        },
        {
          kind: 'preset',
          name: 'application',
        },
      ])
    })
    it('normalizes layer statements into executable CSS operations', () => {
      const prepared = getPreparedCssConfig(`
        @layer reset, base, components;
        @layer utilities;
      `)
      expect(prepared.operations).toEqual([
        {
          kind: 'layer',
          cssText: '@layer reset, base, components;',
        },
        {
          kind: 'layer',
          cssText: '@layer utilities;',
        },
      ])
    })
    it('preserves the raw input source on the prepared plan', () => {
      const source = `
        /* documentation */
        @cipo {
          prefix: application;
        }
      `
      const prepared = getPreparedCssConfig(source)
      expect(prepared.source).toBe(source)
    })
    it('does not execute directives that appear inside comments', () => {
      const prepared = getPreparedCssConfig(`
        /*
          @cipo {
            prefix: malicious-comment;
            minify: true;
          }
          @theme {
            should-not-exist: red;
          }
          @alias fake {
            color: red;
          }
        */
        @cipo {
          prefix: real;
          minify: false;
        }
        @theme {
          primary: blue;
        }
      `)
      expect(prepared.config).toMatchObject({
        prefix: 'real',
        minify: false,
      })
      expect(prepared.theme).toEqual({
        primary: 'blue',
      })
      expect(prepared.appliedAliases).toEqual([])
      expect(
        prepared.operations.map(
          (operation) => operation.kind,
        ),
      ).toEqual([
        'config',
        'theme',
      ])
    })
    it('does not interpret @ directives appearing inside quoted values', () => {
      const prepared = getPreparedCssConfig(`
        @theme {
          documentation: "@cipo { prefix: fake; }";
          email: "developer@example.com";
        }
        @cipo {
          prefix: real;
        }
      `)
      expect(prepared.config.prefix).toBe('real')
      expect(prepared.theme).toEqual({
        documentation: '"@cipo { prefix: fake; }"',
        email: '"developer@example.com"',
      })
      expect(
        prepared.operations.map(
          (operation) => operation.kind,
        ),
      ).toEqual([
        'theme',
        'config',
      ])
    })
    it('emits a warning for an unknown block directive without executing it', () => {
      const prepared = getPreparedCssConfig(`
        @does-not-exist {
          prefix: fake;
        }
      `)
      expect(prepared.operations).toEqual([])
      expect(prepared.warnings).toEqual([
        {
          code: 'cipo-config-unknown-directive',
          message: 'Unknown CSS-first directive: @does-not-exist',
        },
      ])
    })
    it('emits a warning when an alias block has no name', () => {
      const prepared = getPreparedCssConfig(`
        @alias {
          color: red;
        }
      `)
      expect(prepared.operations).toEqual([])
      expect(prepared.appliedAliases).toEqual([])
      expect(prepared.warnings).toEqual([
        {
          code: 'cipo-config-alias-name-missing',
          message: '@alias needs a name.',
        },
      ])
    })
    it('emits a warning when a property block has no custom property name', () => {
      const prepared = getPreparedCssConfig(`
        @property {
          syntax: "<color>";
        }
      `)
      expect(prepared.operations).toEqual([])
      expect(prepared.appliedProperties).toEqual([])
      expect(prepared.warnings).toEqual([
        {
          code: 'cipo-config-property-name-missing',
          message: '@property needs a custom property name.',
        },
      ])
    })
    it('emits a warning and stops safely on an unclosed directive block', () => {
      const prepared = getPreparedCssConfig(`
        @cipo {
          prefix: broken;
        @theme {
          primary: red;
        }
      `)
      expect(prepared.warnings).toContainEqual({
        code: 'cipo-config-unclosed-block',
        message: 'Unclosed @cipo block.',
      })
    })
    it('uses documented boolean coercion semantics', () => {
      const falsyValues = [
        'false',
        'FALSE',
        '0',
        'no',
        'off',
      ]
      for (const value of falsyValues) {
        clearPreparedCssConfigCache()
        const prepared = getPreparedCssConfig(`
          @cipo {
            debug: ${value};
          }
        `)
        expect(
          prepared.config.debug,
          `${value} should parse as false`,
        ).toBe(false)
      }
      const truthyValues = [
        'true',
        '1',
        'yes',
        'on',
        'anything',
      ]
      for (const value of truthyValues) {
        clearPreparedCssConfigCache()
        const prepared = getPreparedCssConfig(`
          @cipo {
            debug: ${value};
          }
        `)
        expect(
          prepared.config.debug,
          `${value} should parse as true`,
        ).toBe(true)
      }
    })
    it('extracts numeric values from CSS-like number declarations', () => {
      const prepared = getPreparedCssConfig(`
        @cipo {
          atomic-min-uses: 4.5;
          rem: 18px;
          base-font-size: 20rem;
        }
      `)
      expect(prepared.config.atomic).toEqual({
        minUses: 4.5,
      })
      expect(prepared.config.rem).toEqual({
        enabled: true,
        baseFontSize: 18,
      })
      expect(prepared.config.baseFontSize).toBe(20)
    })
    it('uses parser fallbacks when numeric configuration values contain no number', () => {
      const prepared = getPreparedCssConfig(`
        @cipo {
          atomic-min-uses: invalid;
          rem: invalid;
          base-font-size: invalid;
        }
      `)
      expect(prepared.config.atomic).toEqual({
        minUses: 1,
      })
      expect(prepared.config.rem).toEqual({
        enabled: true,
        baseFontSize: 16,
      })
      expect(prepared.config.baseFontSize).toBe(16)
    })
  })
  describe('parse-plan cache', () => {
    it('returns the same prepared plan instance for identical source', () => {
      const source = `
        @cipo {
          prefix: cached;
        }
      `
      const first = getPreparedCssConfig(source)
      const second = getPreparedCssConfig(source)
      expect(second).toBe(first)
    })
    it('treats the complete source string as the cache identity', () => {
      const first = getPreparedCssConfig(`
        @cipo {
          prefix: first;
        }
      `)
      const second = getPreparedCssConfig(`
        @cipo {
          prefix: second;
        }
      `)
      expect(second).not.toBe(first)
      expect(first.config.prefix).toBe('first')
      expect(second.config.prefix).toBe('second')
    })
    it('clears the pure parse-plan cache without changing parser semantics', () => {
      const source = `
        @theme {
          primary: red;
        }
      `
      const first = getPreparedCssConfig(source)
      clearPreparedCssConfigCache()
      const second = getPreparedCssConfig(source)
      expect(second).not.toBe(first)
      expect(second).toEqual(first)
    })
    it('evicts the oldest cached parse plan when the bounded cache is exceeded', () => {
      const oldestSource = `
        @cipo {
          prefix: oldest;
        }
      `
      const oldest =
        getPreparedCssConfig(oldestSource)
      // The production cache is deliberately bounded to avoid unbounded growth
      // in dev servers processing many virtual or generated configuration files.
      for (
        let index = 0;
        index < 128;
        index += 1
      ) {
        getPreparedCssConfig(`
          @cipo {
            prefix: generated-${index};
          }
        `)
      }
      const reparsed =
        getPreparedCssConfig(oldestSource)
      expect(reparsed).not.toBe(oldest)
      expect(reparsed).toEqual(oldest)
    })
  })
  describe('compileCssConfigPayload', () => {
    it('lowers pure configuration operations to parser-free opcodes in source order', () => {
      const payload = compileCssConfigPayload(`
        @cipo {
          prefix: app;
          minify: true;
        }
        @theme {
          primary: red;
        }
        @alias center {
          display: flex;
        }
        @property --brand {
          syntax: "<color>";
          inherits: false;
          initial-value: black;
        }
        @layer reset, components;
      `)
      expect(payload).not.toBeNull()
      expect(payload?.operations).toEqual([
        [
          CipoCompiledConfigOpcode.Config,
          {
            prefix: 'app',
            minify: true,
          },
        ],
        [
          CipoCompiledConfigOpcode.Theme,
          {
            primary: 'red',
          },
        ],
        [
          CipoCompiledConfigOpcode.Alias,
          'center',
          'display: flex;',
        ],
        [
          CipoCompiledConfigOpcode.Property,
          '--brand',
          {
            syntax: '<color>',
            inherits: false,
            initialValue: 'black',
          },
        ],
        [
          CipoCompiledConfigOpcode.Css,
          '@layer reset, components;',
        ],
      ])
    })
    it('lowers breakpoint configuration through the regular Config opcode', () => {
      const payload = compileCssConfigPayload(`
        @breakpoints {
          mobile: 640px;
          desktop: 1280px;
        }
      `)
      expect(payload).toEqual({
        operations: [
          [
            CipoCompiledConfigOpcode.Config,
            {
              breakpoints: {
                mobile: '(min-width: 640px)',
                desktop: '(min-width: 1280px)',
              },
            },
          ],
        ],
      })
    })
    it('lowers typed theme values without losing type metadata', () => {
      const payload = compileCssConfigPayload(`
        @theme {
          primary<color, register, inherits: false>: red;
        }
      `)
      expect(payload).toEqual({
        operations: [
          [
            CipoCompiledConfigOpcode.Theme,
            {
              primary: typedTheme(
                'color',
                'red',
                {
                  register: true,
                  inherits: false,
                },
              ),
            },
          ],
        ],
      })
    })
    it('returns an empty parser-free payload for empty configuration source', () => {
      expect(
        compileCssConfigPayload(''),
      ).toEqual({
        operations: [],
      })
    })
    it('returns null when a preset requires runtime registry execution', () => {
      expect(
        compileCssConfigPayload(`
          @cipo {
            prefix: app;
          }
          @preset application;
        `),
      ).toBeNull()
    })
    it('returns null when a plugin requires runtime registry execution', () => {
      expect(
        compileCssConfigPayload(`
          @theme {
            primary: red;
          }
          @plugin typography;
        `),
      ).toBeNull()
    })
    it('returns null regardless of where a runtime-dependent operation appears', () => {
      const presetFirst = compileCssConfigPayload(`
        @preset application;
        @cipo {
          prefix: app;
        }
      `)
      const presetLast = compileCssConfigPayload(`
        @cipo {
          prefix: app;
        }
        @preset application;
      `)
      expect(presetFirst).toBeNull()
      expect(presetLast).toBeNull()
    })
    it('does not treat preset or plugin names inside comments as runtime dependencies', () => {
      const payload = compileCssConfigPayload(`
        /*
          @preset fake;
          @plugin fake;
        */
        @cipo {
          prefix: app;
        }
      `)
      expect(payload).toEqual({
        operations: [
          [
            CipoCompiledConfigOpcode.Config,
            {
              prefix: 'app',
            },
          ],
        ],
      })
    })
    it('produces deterministic payloads across repeated compilations', () => {
      const source = `
        @cipo {
          prefix: app;
          minify: true;
        }
        @theme {
          primary: red;
          spacing: (
            sm: 4px;
            md: 8px;
          );
        }
      `
      const first =
        compileCssConfigPayload(source)
      const second =
        compileCssConfigPayload(source)
      expect(second).toEqual(first)
    })
  })
  describe('parser regression contracts', () => {
    it('keeps URLs, font stacks and transition lists intact while splitting map entries', () => {
      const prepared = getPreparedCssConfig(`
        @theme {
          api-url: "https://example.com/a:b";
          font-stack: Inter, "Helvetica Neue", Arial, sans-serif;
          transition-list: color 100ms ease, background 200ms ease;
          small: 4px,
          medium: 8px
        }
      `)
      expect(prepared.theme).toEqual({
        apiUrl: '"https://example.com/a:b"',
        fontStack: 'Inter, "Helvetica Neue", Arial, sans-serif',
        transitionList: 'color 100ms ease, background 200ms ease',
        small: '4px',
        medium: '8px',
      })
    })
    it('keeps annotation commas separate from theme map separators', () => {
      const prepared = getPreparedCssConfig(`
        @theme {
          primary<color, register, inherits: false, validation: warn>: red,
          secondary<color, no-register>: blue
        }
      `)
      expect(prepared.theme.primary).toEqual(
        typedTheme(
          'color',
          'red',
          {
            register: true,
            inherits: false,
            validation: 'warn',
          },
        ),
      )
      expect(prepared.theme.secondary).toEqual(
        typedTheme(
          'color',
          'blue',
          {
            register: false,
          },
        ),
      )
    })
    it('strips leading dollar markers from configuration and theme keys', () => {
      const prepared = getPreparedCssConfig(`
        @theme {
          $primary-color: red;
        }
        @cipo {
          $prefix: application;
        }
      `)
      expect(prepared.theme).toEqual({
        primaryColor: 'red',
      })
      expect(prepared.config.prefix).toBe(
        'application',
      )
    })
    it('ignores malformed declarations that do not contain a top-level colon', () => {
      const prepared = getPreparedCssConfig(`
        @cipo {
          prefix: app;
          malformed declaration;
          minify: true;
        }
      `)
      expect(prepared.config).toMatchObject({
        prefix: 'app',
        minify: true,
      })
    })
    it('ignores unsupported theme validation modes instead of emitting invalid configuration', () => {
      const prepared = getPreparedCssConfig(`
        @cipo {
          theme-validation: definitely-invalid;
        }
      `)
      expect(
        prepared.config.themeValidation,
      ).toBeUndefined()
    })
    it('ignores unsupported typed-theme validation modes', () => {
      const prepared = getPreparedCssConfig(`
        @theme {
          primary<color, validation: invalid>: red;
        }
      `)
      expect(prepared.theme.primary).toEqual(
        typedTheme(
          'color',
          'red',
          {},
        ),
      )
    })
    it('emits a warning for unknown statement-style directives instead of silently ignoring them', () => {
      const prepared = getPreparedCssConfig('@unknown value;')
      expect(prepared.warnings).toContainEqual({
        code: 'cipo-config-unknown-directive',
        message: 'Unknown CSS-first directive: @unknown',
      })
    })
    it('deep-freezes cached prepared configuration plans', () => {
      const prepared = getPreparedCssConfig(`
        @cipo { breakpoints: ignored; }
        @theme { colors: { brand: red; }; }
      `)
      expect(Object.isFrozen(prepared)).toBe(true)
      expect(Object.isFrozen(prepared.operations)).toBe(true)
      expect(Object.isFrozen(prepared.config)).toBe(true)
      expect(Object.isFrozen(prepared.theme)).toBe(true)
      expect(getPreparedCssConfig(prepared.source)).toBe(prepared)
    })
  })
})
