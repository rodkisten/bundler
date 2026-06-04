/**
 * @tool Cipo
 * @global Cipo
 * @package cipo
 * @tags css jit atomic userscripts
 * @description Browser-first atomic CSS runtime and semantic CSS DSL bundled as a standalone browser global.
 */
/**
 * Cipó runtime.
 *
 * @remarks
 * Cipó is a browser-first atomic CSS runtime with a semantic CSS DSL. This file
 * keeps the previous public API intact and layers the new 1.0 language on top:
 * `css`, `inline.css`, `theme`, `configure`, `setup`, `injectGlobal`,
 * `injectStyle`, `cipo.div.css`, component wrappers, browser globals, aliases,
 * helpers, runtime JIT caching, cascade layers, REM conversion and token lookup.
 *
 * The main authoring style is CSS-like:
 *
 * ```ts
 * const card = css`
 *   cardSurface;
 *   interactive;
 *
 *   px: 4;
 *   py: 3;
 *   gap: 2;
 *
 *   bg: $panel;
 *   color: $ink;
 *   rounded: $xl;
 *   shadow: $glow;
 *
 *   text(size: lg, weight: 800, lh: 1.1, color: $ink);
 *
 *   x:hover {
 *     bg: alpha($brand / 14%);
 *   }
 * `;
 * ```
 *
 * @example Configure everything in one call
 * ```ts
 * configure({
 *   prefix: "rod",
 *   debug: true,
 *   important: false,
 *   adapter: "dom",
 *   minify: false,
 *   layers: true,
 *   rem: { enabled: true, baseFontSize: 16 },
 *   colorMode: "oklch",
 *   darkSelector: ".dark",
 *   themeRootSelector: ":root",
 *   theme: {
 *     colors: {
 *       brand: "#f97316",
 *       panel: "#0f172a",
 *       ink: "#f8fafc",
 *     },
 *     spacing: "0.25rem",
 *     radius: { xl: "24px" },
 *     shadow: { glow: "0 24px 80px rgb(0 0 0 / .24)" },
 *     text: { lg: "1.25rem" },
 *   },
 *   aliases: {
 *     cardSurface: `
 *       bg: alpha($panel / 86%);
 *       border: 1px solid alpha($ink / 12%);
 *       backdrop-filter: blur(16px);
 *     `,
 *     interactive: `
 *       cursor: pointer;
 *       user-select: none;
 *       transition: transform 160ms ease, opacity 160ms ease;
 *       x:active { transform: scale(.98); }
 *     `,
 *   },
 *   helpers: {
 *     glow(args, ctx) {
 *       return `0 0 0 1px ${args || "alpha($brand / 30%)"}`;
 *     },
 *   },
 * });
 * ```
 *
 * @example Basic atomic CSS
 * ```ts
 * const button = css`
 *   color: white;
 *   background: #111827;
 *   padding: 12px 16px;
 *   border-radius: 12px;
 * `;
 *
 * String(button);
 * // "cipo-a-xxxxx cipo-a-yyyyy cipo-a-zzzzz cipo-a-wwwww"
 * ```
 *
 * Output CSS when `minify` is false:
 *
 * ```css
 * @layer cipo.atomic {
 *   .cipo-a-xxxxx {
 *     color: white;
 *   }
 *
 *   .cipo-a-yyyyy {
 *     background: #111827;
 *   }
 *
 *   .cipo-a-zzzzz {
 *     padding: 0.75rem 1rem;
 *   }
 *
 *   .cipo-a-wwwww {
 *     border-radius: 0.75rem;
 *   }
 * }
 * ```
 *
 * @example Theme tokens and inferred dollar variables
 * ```ts
 * configure({
 *   theme: {
 *     colors: { brand: "#22c55e", ink: "#f8fafc" },
 *     radius: { xl: "18px" },
 *     spacing: "0.25rem",
 *   },
 * });
 *
 * const card = css`
 *   bg: $brand;
 *   color: $ink;
 *   rounded: $xl;
 *   gap: spacing(4);
 * `;
 * ```
 *
 * Output CSS:
 *
 * ```css
 * :root {
 *   --cipo-colors-brand: #22c55e;
 *   --cipo-colors-ink: #f8fafc;
 *   --cipo-radius-xl: 1.125rem;
 *   --cipo-spacing: 0.25rem;
 * }
 *
 * .cipo-a-xxxxx { background: var(--cipo-colors-brand); }
 * .cipo-a-yyyyy { color: var(--cipo-colors-ink); }
 * .cipo-a-zzzzz { border-radius: var(--cipo-radius-xl); }
 * .cipo-a-wwwww { gap: calc(var(--cipo-spacing, 0.25rem) * 4); }
 * ```
 *
 * @example Explicit token namespaces
 * ```ts
 * css`
 *   bg: $colors.brand;
 *   rounded: $radius.xl;
 *   shadow: $shadow.glow;
 * `;
 * ```
 *
 * @example Property aliases, no `@with` needed
 * ```ts
 * const box = css`
 *   flex;
 *   center;
 *   px: 4;
 *   py: 3;
 *   m: fluid(1rem, 2rem, 4vw);
 *   bg: alpha($brand / 18%);
 *   rounded: $xl;
 *   shadow: $glow;
 * `;
 * ```
 *
 * Output CSS:
 *
 * ```css
 * .cipo-a-xxxxx { display: flex; }
 * .cipo-a-yyyyy { align-items: center; }
 * .cipo-a-zzzzz { justify-content: center; }
 * .cipo-a-aaaaa { padding-inline: calc(var(--cipo-spacing, 0.25rem) * 4); }
 * .cipo-a-bbbbb { padding-block: calc(var(--cipo-spacing, 0.25rem) * 3); }
 * .cipo-a-ccccc { margin: clamp(1rem, 4vw, 2rem); }
 * .cipo-a-ddddd { background: color-mix(in oklch, var(--cipo-colors-brand) 18%, transparent); }
 * ```
 *
 * @example Legacy `@with` compatibility
 * ```ts
 * const legacy = css`
 *   @with(bg($brand), color($ink), px(4), py(2), rounded($xl));
 * `;
 * ```
 *
 * `@with` remains supported, but the recommended 1.0 syntax is:
 *
 * ```ts
 * const modern = css`
 *   bg: $brand;
 *   color: $ink;
 *   px: 4;
 *   py: 2;
 *   rounded: $xl;
 * `;
 * ```
 *
 * @example Responsive, dark mode, pseudo and context variants
 * ```ts
 * const panel = css`
 *   width: 100%;
 *
 *   x:md {
 *     width: 720px;
 *   }
 *
 *   x:not(md) {
 *     font-size: 14px;
 *   }
 *
 *   x:dark {
 *     bg: #020617;
 *     color: white;
 *   }
 *
 *   x:md:hover {
 *     transform: translateY(-2px);
 *   }
 * `;
 * ```
 *
 * @example Scoped selectors
 * ```ts
 * const list = css`
 *   p: 0;
 *
 *   li {
 *     list-style: none;
 *     py: 2;
 *   }
 *
 *   &:hover {
 *     opacity: .92;
 *   }
 * `;
 * ```
 *
 * Output CSS:
 *
 * ```css
 * .cipo-a-yyyyy { padding: 0; }
 * .cipo-s-xxxxx li { list-style: none; padding-block: .5rem; }
 * .cipo-s-xxxxx:hover { opacity: .92; }
 * ```
 *
 * @example Text helper
 * ```ts
 * const title = css`
 *   text(size: lg, lh: 1.2, weight: 800, align: center, decoration: underline, shadow: $glow, color: $brand);
 * `;
 * ```
 *
 * Output CSS:
 *
 * ```css
 * .cipo-a-xxxxx { font-size: var(--cipo-text-lg); }
 * .cipo-a-yyyyy { line-height: 1.2; }
 * .cipo-a-zzzzz { font-weight: 800; }
 * .cipo-a-aaaaa { text-align: center; }
 * .cipo-a-bbbbb { text-decoration-line: underline; }
 * .cipo-a-ccccc { text-shadow: var(--cipo-shadow-glow); }
 * .cipo-a-ddddd { color: var(--cipo-colors-brand); }
 * ```
 *
 * @example Inline CSS for style attributes
 * ```ts
 * const style = inline.css`
 *   px: 2;
 *   color: saturate($primary, 100%);
 *   bg: lighten($brand, 20%);
 *   text(size: sm, lh: 2, $red-500, underline);
 * `;
 *
 * String(style);
 * // "padding-inline: calc(var(--cipo-spacing, 0.25rem) * 2); color: ...;"
 * ```
 *
 * @example Register helpers and aliases
 * ```ts
 * registerHelper("ring", (args) => `0 0 0 ${args || "2px"} alpha($brand / 42%)`);
 *
 * registerAlias("glass", `
 *   bg: alpha($panel / 74%);
 *   border: 1px solid alpha($ink / 14%);
 *   backdrop-filter: blur(20px);
 * `);
 *
 * const card = css`
 *   glass;
 *   box-shadow: ring(2px);
 * `;
 * ```
 *
 * @example DOM API
 * ```ts
 * const element = document.createElement("div");
 * const styled = cipo(element).css`color: red; px: 4;`;
 *
 * styled.element === element;
 * // true
 * ```
 *
 * @example DOM tag factory API
 * ```ts
 * configure({ adapter: "dom" });
 *
 * const Card = cipo.div.css`
 *   px: 4;
 *   py: 3;
 *   bg: white;
 * `;
 *
 * const element = Card({ class: "extra", children: "Hello" });
 * ```
 *
 * @example React, Preact and Solid component wrappers
 * ```ts
 * configure({ adapter: "react" });
 * const ReactButton = cipo.button.css`bg: black; color: white;`;
 * // passes className
 *
 * configure({ adapter: "solid" });
 * const SolidButton = cipo.button.css`bg: black; color: white;`;
 * // passes class
 * ```
 *
 * @example Global and local style injection
 * ```ts
 * injectGlobal`
 *   body {
 *     margin: 0;
 *     bg: $panel;
 *   }
 * `;
 *
 * const shadow = host.attachShadow({ mode: "open" });
 * injectStyle(shadow, css`button { color: $brand; }`);
 * ```
 *
 * @example JIT cache configuration
 * ```ts
 * configure({
 *   jit: {
 *     enabled: true,
 *     cache: true,
 *     maxEntries: 2000,
 *     debug: true,
 *   },
 * });
 * ```
 *
 * @example Browser globals
 * ```ts
 * window.Cipo.css`color: red;`;
 * window.Cipo.cipo.div.css`color: blue;`;
 * window.RodK === window.Cipo;
 * // true
 * ```
 */

/* ============================================================================
 * Constants
 * ========================================================================== */

const STYLE_ELEMENT_ID = 'cipo-runtime-style';
const HASH_SEED = 5381;
const HASH_MASK = 0xffffffff;
const DEFAULT_PREFIX = 'cipo';
const EMPTY_STRING = '';
const CLASS_PROP = 'class';
const CLASS_NAME_PROP = 'className';
const CHILDREN_PROP = 'children';
const DEFAULT_BASE_FONT_SIZE = 16;
const DEFAULT_SPACING_VALUE = '0.25rem';
const DEFAULT_LAYER_DECLARATION = '@layer cipo.reset, cipo.tokens, cipo.base, cipo.atomic, cipo.scoped, cipo.global, cipo.inline;';

const HTML_TAGS = [
  'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'base',
  'bdi', 'bdo', 'blockquote', 'body', 'br', 'button', 'canvas', 'caption',
  'cite', 'code', 'col', 'colgroup', 'data', 'datalist', 'dd', 'del',
  'details', 'dfn', 'dialog', 'div', 'dl', 'dt', 'em', 'embed', 'fieldset',
  'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5',
  'h6', 'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img',
  'input', 'ins', 'kbd', 'label', 'legend', 'li', 'link', 'main', 'map',
  'mark', 'menu', 'meta', 'meter', 'nav', 'noscript', 'object', 'ol',
  'optgroup', 'option', 'output', 'p', 'picture', 'pre', 'progress', 'q',
  'rp', 'rt', 'ruby', 's', 'samp', 'script', 'section', 'select', 'slot',
  'small', 'source', 'span', 'strong', 'style', 'sub', 'summary', 'sup',
  'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead',
  'time', 'title', 'tr', 'track', 'u', 'ul', 'var', 'video', 'wbr',
] as const;

/* ============================================================================
 * Public Types
 * ========================================================================== */

export type CipoPrimitive = string | number | boolean | null | undefined;
export type CipoAdapterName = 'dom' | 'solid' | 'react' | 'preact';
export type CipoHtmlTagName = (typeof HTML_TAGS)[number];
export type CipoAnyRecord = Record<string, unknown>;
export type CipoColorMode = 'oklch' | 'oklab' | 'hsl' | 'rgba' | 'preserve';
export type CipoLayerName = 'reset' | 'tokens' | 'base' | 'atomic' | 'scoped' | 'global' | 'inline';
export type CipoHelperResolver = (args: string, context: CipoHelperContext) => string;
export type CipoAliasValue = string | CipoStyleObject | ((context: CipoAliasContext) => string | CipoStyleObject);
export type CipoComponent<Props extends CipoAnyRecord = CipoAnyRecord> = (props: Props) => unknown;
export type CipoTarget = Element | string | CipoComponent | ((...args: never[]) => unknown);
export type CipoCssInterpolation = CipoPrimitive | CipoCssArtifact | CipoInlineCssArtifact | CipoStyleObject;

export interface CipoStyleObject {
  readonly [property: string]: string | number | CipoStyleObject | null | undefined;
}

export interface CipoAdapter {
  readonly name?: string;
  readonly classProp: 'class' | 'className';
  mergeProps(props: CipoAnyRecord | null | undefined, className: string): CipoAnyRecord;
  createElement?(tag: string, props: CipoAnyRecord | null | undefined, className: string): unknown;
  wrapComponent?(component: unknown, className: string): CipoComponent;
}

export interface CipoRemConfig {
  readonly enabled?: boolean;
  readonly baseFontSize?: number;
}

export interface CipoColorConfig {
  readonly mode?: CipoColorMode;
}

export interface CipoOutputConfig {
  readonly minify?: boolean;
  readonly layers?: boolean;
  readonly pretty?: boolean;
}

export interface CipoJitConfig {
  readonly enabled?: boolean;
  readonly cache?: boolean;
  readonly maxEntries?: number;
  readonly debug?: boolean;
}

export interface CipoRuntimeConfig {
  readonly prefix?: string;
  readonly debug?: boolean;
  readonly important?: boolean;
  readonly adapter?: CipoAdapterName | CipoAdapter;
  readonly darkSelector?: string;
  readonly breakpoints?: Readonly<Record<string, string | null>>;
  readonly themeRootSelector?: string;
  readonly onWarning?: (warning: CipoWarning) => void;
  readonly minify?: boolean;
  readonly layers?: boolean;
  readonly rem?: boolean | CipoRemConfig;
  readonly baseFontSize?: number;
  readonly colorMode?: CipoColorMode;
  readonly color?: CipoColorConfig;
  readonly output?: CipoOutputConfig;
  readonly theme?: CipoThemeDefinition;
  readonly aliases?: Record<string, CipoAliasValue>;
  readonly helpers?: Record<string, CipoHelperResolver>;
  readonly jit?: boolean | CipoJitConfig;
}

export interface CipoTargetOptions {
  readonly adapter?: CipoAdapterName | CipoAdapter;
}

export interface CipoInjectGlobalOptions {
  readonly important?: boolean;
  readonly layer?: CipoLayerName | false;
}

export interface CipoInjectStyleOptions {
  readonly nonce?: string;
  readonly dedupe?: boolean;
  readonly position?: 'append' | 'prepend';
}

export interface CipoWarning {
  readonly code: string;
  readonly message: string;
  readonly context?: unknown;
}

export interface CipoThemeDefinition {
  readonly [key: string]: string | number | CipoThemeDefinition;
}

export interface CipoHelperContext {
  readonly name: string;
  readonly prefix: string;
  readonly colorMode: CipoColorMode;
  readonly remBase: number;
}

export interface CipoAliasContext {
  readonly name: string;
  readonly prefix: string;
}

export interface CipoAtomicRule {
  readonly id: string;
  readonly className: string;
  readonly property: string;
  readonly value: string;
  readonly context: CipoRuleContext;
  readonly source: string;
}

export interface CipoScopedRule {
  readonly selector: string;
  readonly declarations: readonly CipoDeclarationNode[];
  readonly context: CipoRuleContext;
}

export interface CipoRuleContext {
  readonly breakpoint?: string;
  readonly mediaQuery?: string;
  readonly pseudo?: string;
  readonly dark?: boolean;
  readonly notBreakpoint?: string;
}

export interface CipoCssArtifact {
  readonly kind: 'cipo.css';
  readonly className: string;
  readonly scopeClassName: string;
  readonly atoms: readonly CipoAtomicRule[];
  readonly scopedRules: readonly CipoScopedRule[];
  readonly rawCss: string;
  readonly transformedCss: string;
  readonly compiledCss: string;
  readonly debug: CipoDebugArtifact;
  toString(): string;
  [Symbol.toPrimitive](): string;
  readonly [Symbol.toStringTag]: string;
}

export interface CipoInlineCssArtifact {
  readonly kind: 'cipo.inline-css';
  readonly rawCss: string;
  readonly transformedCss: string;
  readonly cssText: string;
  toString(): string;
  [Symbol.toPrimitive](): string;
  readonly [Symbol.toStringTag]: string;
}

export interface CipoDebugArtifact {
  readonly id: string;
  readonly atoms: readonly CipoAtomicRule[];
  readonly scopedRules: readonly CipoScopedRule[];
  readonly ast: readonly CipoAstNode[];
  readonly warnings: readonly CipoWarning[];
  readonly cacheHit: boolean;
}

export interface CipoExplainResult {
  readonly className: string;
  readonly atom?: CipoAtomicRule;
  readonly css?: string;
  readonly found: boolean;
}

export interface CipoDomStyledResult<ElementType extends Element = Element> {
  readonly element: ElementType;
  readonly artifact: CipoCssArtifact;
  readonly className: string;
}

export interface CipoStyledBuilder<ResultType = unknown> {
  css(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]): ResultType;
}

export interface CipoStyledTagFactory {
  css(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]): CipoComponent;
  attrs(defaultProps: CipoAnyRecord): CipoStyledTagFactory;
}

export interface CipoCallable {
  <ElementType extends Element>(target: ElementType, options?: CipoTargetOptions): CipoStyledBuilder<CipoDomStyledResult<ElementType>>;
  <Props extends CipoAnyRecord>(target: CipoComponent<Props>, options?: CipoTargetOptions): CipoStyledBuilder<CipoComponent<Props>>;
  (target: string, options?: CipoTargetOptions): CipoStyledTagFactory;
  css: typeof css;
  html: typeof html;
  theme: typeof theme;
  configure: typeof configure;
  setup: typeof setup;
  inline: typeof inline;
  injectGlobal: typeof injectGlobal;
  injectStyle: typeof injectStyle;
  registerHelper: typeof registerHelper;
  registerAlias: typeof registerAlias;
  explain: typeof explain;
  getCssText: typeof getCssText;
  reset: typeof reset;
  createBrowserGlobal: typeof createBrowserGlobal;
  installBrowserGlobal: typeof installBrowserGlobal;
}

export interface CipoBrowserGlobal {
  readonly cipo: CipoCallable;
  readonly configure: typeof configure;
  readonly setup: typeof setup;
  readonly theme: typeof theme;
  readonly css: typeof css;
  readonly inline: typeof inline;
  readonly html: typeof html;
  readonly injectGlobal: typeof injectGlobal;
  readonly injectStyle: typeof injectStyle;
  readonly registerHelper: typeof registerHelper;
  readonly registerAlias: typeof registerAlias;
  readonly explain: typeof explain;
  readonly getCssText: typeof getCssText;
  readonly reset: typeof reset;
  readonly createBrowserGlobal: typeof createBrowserGlobal;
  readonly installBrowserGlobal: typeof installBrowserGlobal;
}

export type CipoAstNode = CipoDeclarationNode | CipoBlockNode | CipoDirectiveNode;

export interface CipoDeclarationNode {
  readonly type: 'declaration';
  readonly property: string;
  readonly value: string;
  readonly source: string;
}

export interface CipoBlockNode {
  readonly type: 'block';
  readonly name: string;
  readonly body: readonly CipoAstNode[];
  readonly source: string;
}

export interface CipoDirectiveNode {
  readonly type: 'directive';
  readonly name: string;
  readonly args: readonly string[];
  readonly source: string;
}

interface CipoRuntimeState {
  config: {
    prefix: string;
    debug: boolean;
    important: boolean;
    adapter: CipoAdapterName | CipoAdapter;
    darkSelector: string;
    themeRootSelector: string;
    breakpoints: Readonly<Record<string, string | null>>;
    onWarning?: (warning: CipoWarning) => void;
    minify: boolean;
    layers: boolean;
    rem: Required<CipoRemConfig>;
    colorMode: CipoColorMode;
    jit: Required<CipoJitConfig>;
  };
  sheet: CSSStyleSheet | null;
  insertedCss: Set<string>;
  atomicCache: Map<string, CipoAtomicRule>;
  debugAtoms: Map<string, CipoAtomicRule>;
  sourceCache: Map<string, CipoCssArtifact>;
  inlineCache: Map<string, CipoInlineCssArtifact>;
  helperRegistry: Map<string, CipoHelperResolver>;
  aliasRegistry: Map<string, CipoAliasValue>;
  themeKeys: Set<string>;
  tokenAliases: Map<string, string>;
  ambiguousTokens: Map<string, string[]>;
  warningSink: CipoWarning[];
  layerHeaderInserted: boolean;
  themeVersion: number;
  configVersion: number;
}

declare global {
  interface Window {
    Cipo?: CipoBrowserGlobal;
    RodK?: CipoBrowserGlobal;
  }
}

/* ============================================================================
 * Adapters
 * ========================================================================== */

const DOM_ADAPTER: CipoAdapter = {
  name: 'dom',
  classProp: CLASS_PROP,
  mergeProps(props, className) {
    return mergeClassIntoProps(props, CLASS_PROP, className);
  },
  createElement(tag, props, className) {
    return createDomElement(tag, props, className);
  },
  wrapComponent(component, className) {
    return createGenericWrappedComponent(component, className, CLASS_PROP);
  },
};

const SOLID_ADAPTER: CipoAdapter = {
  name: 'solid',
  classProp: CLASS_PROP,
  mergeProps(props, className) {
    return mergeClassIntoProps(props, CLASS_PROP, className);
  },
  wrapComponent(component, className) {
    return createGenericWrappedComponent(component, className, CLASS_PROP);
  },
};

const REACT_ADAPTER: CipoAdapter = {
  name: 'react',
  classProp: CLASS_NAME_PROP,
  mergeProps(props, className) {
    return mergeClassIntoProps(props, CLASS_NAME_PROP, className);
  },
  wrapComponent(component, className) {
    return createGenericWrappedComponent(component, className, CLASS_NAME_PROP);
  },
};

const PREACT_ADAPTER: CipoAdapter = {
  name: 'preact',
  classProp: CLASS_NAME_PROP,
  mergeProps(props, className) {
    return mergeClassIntoProps(props, CLASS_NAME_PROP, className);
  },
  wrapComponent(component, className) {
    return createGenericWrappedComponent(component, className, CLASS_NAME_PROP);
  },
};

/* ============================================================================
 * Runtime State
 * ========================================================================== */

const runtime: CipoRuntimeState = {
  config: {
    prefix: DEFAULT_PREFIX,
    debug: true,
    important: false,
    adapter: 'dom',
    darkSelector: '[data-theme="dark"]',
    themeRootSelector: ':root',
    breakpoints: {
      base: null,
      sm: null,
      md: '(min-width: 768px)',
      lg: '(min-width: 1024px)',
      xl: '(min-width: 1280px)',
      '2xl': '(min-width: 1536px)',
    },
    onWarning: undefined,
    minify: false,
    layers: true,
    rem: {
      enabled: true,
      baseFontSize: DEFAULT_BASE_FONT_SIZE,
    },
    colorMode: 'oklch',
    jit: {
      enabled: true,
      cache: true,
      maxEntries: 2000,
      debug: false,
    },
  },
  sheet: null,
  insertedCss: new Set<string>(),
  atomicCache: new Map<string, CipoAtomicRule>(),
  debugAtoms: new Map<string, CipoAtomicRule>(),
  sourceCache: new Map<string, CipoCssArtifact>(),
  inlineCache: new Map<string, CipoInlineCssArtifact>(),
  helperRegistry: new Map<string, CipoHelperResolver>(),
  aliasRegistry: new Map<string, CipoAliasValue>(),
  themeKeys: new Set<string>(),
  tokenAliases: new Map<string, string>(),
  ambiguousTokens: new Map<string, string[]>(),
  warningSink: [],
  layerHeaderInserted: false,
  themeVersion: 0,
  configVersion: 0,
};

/* ============================================================================
 * Data Driven Alias Tables
 * ========================================================================== */

type AliasScale = 'spacing' | 'radius' | 'shadow' | 'text' | 'color' | 'none';

interface PropertyAliasDefinition {
  readonly property: string;
  readonly scale: AliasScale;
}

const PROPERTY_ALIASES: Record<string, PropertyAliasDefinition> = {
  p: { property: 'padding', scale: 'spacing' },
  px: { property: 'padding-inline', scale: 'spacing' },
  py: { property: 'padding-block', scale: 'spacing' },
  ps: { property: 'padding-inline-start', scale: 'spacing' },
  pe: { property: 'padding-inline-end', scale: 'spacing' },
  pt: { property: 'padding-top', scale: 'spacing' },
  pr: { property: 'padding-right', scale: 'spacing' },
  pb: { property: 'padding-bottom', scale: 'spacing' },
  pl: { property: 'padding-left', scale: 'spacing' },
  m: { property: 'margin', scale: 'spacing' },
  mx: { property: 'margin-inline', scale: 'spacing' },
  my: { property: 'margin-block', scale: 'spacing' },
  ms: { property: 'margin-inline-start', scale: 'spacing' },
  me: { property: 'margin-inline-end', scale: 'spacing' },
  mt: { property: 'margin-top', scale: 'spacing' },
  mr: { property: 'margin-right', scale: 'spacing' },
  mb: { property: 'margin-bottom', scale: 'spacing' },
  ml: { property: 'margin-left', scale: 'spacing' },
  gap: { property: 'gap', scale: 'spacing' },
  gapx: { property: 'column-gap', scale: 'spacing' },
  gapy: { property: 'row-gap', scale: 'spacing' },
  w: { property: 'width', scale: 'spacing' },
  h: { property: 'height', scale: 'spacing' },
  minw: { property: 'min-width', scale: 'spacing' },
  minh: { property: 'min-height', scale: 'spacing' },
  maxw: { property: 'max-width', scale: 'spacing' },
  maxh: { property: 'max-height', scale: 'spacing' },
  bg: { property: 'background', scale: 'color' },
  bgColor: { property: 'background-color', scale: 'color' },
  'bg-color': { property: 'background-color', scale: 'color' },
  color: { property: 'color', scale: 'color' },
  fill: { property: 'fill', scale: 'color' },
  stroke: { property: 'stroke', scale: 'color' },
  rounded: { property: 'border-radius', scale: 'radius' },
  radius: { property: 'border-radius', scale: 'radius' },
  shadow: { property: 'box-shadow', scale: 'shadow' },
  z: { property: 'z-index', scale: 'none' },
  lh: { property: 'line-height', scale: 'none' },
  leading: { property: 'line-height', scale: 'none' },
  tracking: { property: 'letter-spacing', scale: 'none' },
  opacity: { property: 'opacity', scale: 'none' },
  flex: { property: 'flex', scale: 'none' },
  grid: { property: 'grid-template-columns', scale: 'none' },
  inset: { property: 'inset', scale: 'spacing' },
  top: { property: 'top', scale: 'spacing' },
  right: { property: 'right', scale: 'spacing' },
  bottom: { property: 'bottom', scale: 'spacing' },
  left: { property: 'left', scale: 'spacing' },
};

const BUILTIN_ALIAS_MAP: Record<string, string> = {
  hidden: 'display:none;',
  block: 'display:block;',
  flex: 'display:flex;',
  'inline-flex': 'display:inline-flex;',
  grid: 'display:grid;',
  center: 'display:flex;align-items:center;justify-content:center;',
  'items-center': 'align-items:center;',
  'justify-center': 'justify-content:center;',
  'sr-only': 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;',
};

const TEXT_SIZE_TOKENS = new Set(['xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl']);
const RADIUS_TOKENS = new Set(['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full']);
const SHADOW_TOKENS = new Set(['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', 'inner', 'glow']);

/* ============================================================================
 * Built-in Helper Registration
 * ========================================================================== */

registerHelper('spacing', args => resolveSpacingFunction(args));
registerHelper('fluid', args => resolveFluidFunction(args));
registerHelper('rem', args => pxToRem(args.trim()));
registerHelper('alpha', (args, context) => resolveAlphaFunction(args, context));
registerHelper('lighten', args => resolveColorAdjustFunction('lighten', args));
registerHelper('darken', args => resolveColorAdjustFunction('darken', args));
registerHelper('saturate', args => resolveColorAdjustFunction('saturate', args));
registerHelper('desaturate', args => resolveColorAdjustFunction('desaturate', args));
registerHelper('mix', args => resolveMixFunction(args));
registerHelper('gradient', args => resolveGradientFunction(args));
registerHelper('size', args => {
  const value = normalizeDeclarationValue('width', args.trim());
  return 'width:' + value + ';height:' + value + ';';
});

/* ============================================================================
 * Public API
 * ========================================================================== */

/**
 * Configures the runtime while keeping the previous configure() API intact.
 *
 * @param config Runtime options.
 * @returns Nothing.
 *
 * @example
 * configure({ prefix: 'rod', important: true, adapter: 'solid' });
 *
 * @example
 * configure({
 *   theme: { colors: { brand: '#f97316' } },
 *   aliases: { glass: 'bg: alpha($brand / 70%); backdrop-filter: blur(16px);' },
 *   helpers: { glow: args => `0 0 0 ${args || '2px'} alpha($brand / 32%)` },
 * });
 */
export function configure(config: CipoRuntimeConfig): void {
  const remConfig = normalizeRemConfig(config.rem, config.baseFontSize);
  const jitConfig = normalizeJitConfig(config.jit);

  runtime.config = {
    prefix: config.prefix ?? runtime.config.prefix,
    debug: config.debug ?? runtime.config.debug,
    important: config.important ?? runtime.config.important,
    adapter: config.adapter ?? runtime.config.adapter,
    darkSelector: config.darkSelector ?? runtime.config.darkSelector,
    themeRootSelector: config.themeRootSelector ?? runtime.config.themeRootSelector,
    breakpoints: {
      ...runtime.config.breakpoints,
      ...(config.breakpoints ?? {}),
    },
    onWarning: config.onWarning ?? runtime.config.onWarning,
    minify: config.minify ?? config.output?.minify ?? runtime.config.minify,
    layers: config.layers ?? config.output?.layers ?? runtime.config.layers,
    rem: remConfig ?? runtime.config.rem,
    colorMode: config.colorMode ?? config.color?.mode ?? runtime.config.colorMode,
    jit: jitConfig ?? runtime.config.jit,
  };

  runtime.configVersion += 1;

  if (config.helpers) {
    for (const [name, resolver] of Object.entries(config.helpers)) {
      registerHelper(name, resolver);
    }
  }

  if (config.aliases) {
    for (const [name, value] of Object.entries(config.aliases)) {
      registerAlias(name, value);
    }
  }

  if (config.theme) {
    theme(config.theme);
  }
}

/**
 * Friendly alias for configure(). It exists for the new 1.0 API while keeping
 * configure() fully compatible.
 *
 * @param config Runtime options.
 * @returns Nothing.
 *
 * @example
 * setup({ minify: true, colorMode: 'hsl' });
 */
export function setup(config: CipoRuntimeConfig): void {
  configure(config);
}

/**
 * Registers a value helper. Helpers can be called from values with or without
 * the legacy `x:` prefix.
 *
 * @param name Helper name.
 * @param resolver Helper resolver.
 * @returns Nothing.
 *
 * @example
 * registerHelper('ring', (args) => `0 0 0 ${args || '2px'} alpha($brand / 40%)`);
 *
 * css`
 *   box-shadow: ring(2px);
 * `;
 */
export function registerHelper(name: string, resolver: CipoHelperResolver): void {
  runtime.helperRegistry.set(name, resolver);
  runtime.configVersion += 1;
}

/**
 * Registers a standalone alias. Aliases expand from bare identifiers inside
 * `css```, preserving the old utility speed without `@with`.
 *
 * @param name Alias name.
 * @param value Alias CSS, style object or resolver.
 * @returns Nothing.
 *
 * @example
 * registerAlias('glass', `
 *   bg: alpha($panel / 72%);
 *   border: 1px solid alpha($ink / 14%);
 *   backdrop-filter: blur(16px);
 * `);
 *
 * css`
 *   glass;
 *   rounded: $xl;
 * `;
 */
export function registerAlias(name: string, value: CipoAliasValue): void {
  runtime.aliasRegistry.set(name, value);
  runtime.configVersion += 1;
}

/**
 * Registers theme tokens and makes shorthand variables available.
 *
 * @param tokens Theme object.
 * @returns Nothing.
 *
 * @example
 * theme({ colors: { brand: '#22c55e' }, spacing: '0.25rem' });
 */
export function theme(tokens: CipoThemeDefinition): void {
  const pairs = flattenTheme(tokens);
  let declarations = EMPTY_STRING;
  const leafAliases = new Map<string, string[]>();

  for (let index = 0; index < pairs.length; index += 1) {
    const [name, rawValue] = pairs[index];
    const value = normalizeDeclarationValue('theme-token', String(rawValue));
    const variableName = '--' + runtime.config.prefix + '-' + name;
    const leaf = name.slice(name.lastIndexOf('-') + 1);

    runtime.themeKeys.add(name);
    declarations += createDeclaration(variableName, value);

    const explicitDollarName = '$' + name.replaceAll('-', '.');
    runtime.tokenAliases.set(explicitDollarName, 'var(' + variableName + ')');

    const existingLeaves = leafAliases.get(leaf) ?? [];
    existingLeaves.push(name);
    leafAliases.set(leaf, existingLeaves);
  }

  for (const [leaf, names] of leafAliases.entries()) {
    if (names.length === 1) {
      runtime.tokenAliases.set('$' + leaf, 'var(--' + runtime.config.prefix + '-' + names[0] + ')');
      runtime.ambiguousTokens.delete('$' + leaf);
      continue;
    }

    runtime.ambiguousTokens.set('$' + leaf, names);
  }

  runtime.themeVersion += 1;
  insertCss(wrapLayer('tokens', runtime.config.themeRootSelector + '{' + declarations + '}'));
}

/**
 * Main CSS tagged template. It preserves the old API and now also understands
 * aliases, helpers, layers, REM conversion and pretty/minified output settings.
 *
 * @param strings Template strings.
 * @param values Interpolated values.
 * @returns CSS artifact whose string value is the generated class list.
 */
export function css(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]): CipoCssArtifact {
  return createCssArtifact(strings, values);
}

/**
 * Minimal HTML tag kept for compatibility. Fábrica owns the real HTML runtime.
 *
 * @param strings Template strings.
 * @param values Interpolated values.
 * @returns HTML string.
 */
export function html(strings: TemplateStringsArray, ...values: readonly unknown[]): string {
  let output = EMPTY_STRING;

  for (let index = 0; index < strings.length; index += 1) {
    output += strings[index];

    if (index < values.length) {
      const value = values[index];
      output += Array.isArray(value) ? value.join(EMPTY_STRING) : String(value ?? EMPTY_STRING);
    }
  }

  return output;
}

/**
 * Inline CSS namespace. inline.css`` preserves editor CSS syntax highlighting
 * and produces a string-safe artifact for style={...} / style="..." usage.
 */
export const inline = {
  /**
   * Compiles a style string with the same features as css`` but returns inline
   * declarations instead of classes.
   *
   * @param strings Template strings.
   * @param values Interpolated values.
   * @returns Inline CSS artifact.
   *
   * @example
   * const style = inline.css`px: 2; color: saturate($primary, 100%);`;
   */
  css(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]): CipoInlineCssArtifact {
    return createInlineCssArtifact(strings, values);
  },
};

/**
 * Injects global CSS while preserving the previous overloads.
 */
export function injectGlobal(strings: TemplateStringsArray, ...values: readonly CipoCssInterpolation[]): string;
export function injectGlobal(options: CipoInjectGlobalOptions, cssText: string): string;
export function injectGlobal(artifact: CipoCssArtifact, ...artifacts: readonly CipoCssArtifact[]): string;
export function injectGlobal(
  first: TemplateStringsArray | CipoInjectGlobalOptions | CipoCssArtifact,
  ...values: readonly (CipoCssInterpolation | CipoCssArtifact | string)[]
): string {
  const warnings: CipoWarning[] = [];
  let important = runtime.config.important;
  let layer: CipoLayerName | false = 'global';
  let rawCss = EMPTY_STRING;

  if (isCssArtifact(first)) {
    rawCss = first.compiledCss;

    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];

      if (isCssArtifact(value)) {
        rawCss += '\n' + value.compiledCss;
      }
    }
  } else if (isInjectGlobalOptions(first)) {
    important = first.important ?? important;
    layer = first.layer ?? layer;
    rawCss = String(values[0] ?? EMPTY_STRING);
  } else {
    rawCss = buildCss(first, values as readonly CipoCssInterpolation[]);
  }

  const transformedCss = transformCss(rawCss, warnings);
  const formattedCss = formatRawCss(important ? addImportantToCssText(transformedCss) : transformedCss);
  const compiledCss = layer ? wrapLayer(layer, formattedCss) : formattedCss;

  insertCss(compiledCss);

  return compiledCss;
}

/**
 * Injects compiled style into a specific element, document or ShadowRoot.
 * Useful for Shadow DOM, userscripts and iframe-like isolated surfaces.
 *
 * @param target DOM target.
 * @param styles Style artifacts.
 * @param options Injection options.
 * @returns Style element used for injection.
 */
export function injectStyle(
  target: HTMLElement | ShadowRoot | Document,
  styles: CipoCssArtifact | CipoInlineCssArtifact | readonly (CipoCssArtifact | CipoInlineCssArtifact)[],
  options: CipoInjectStyleOptions = {},
): HTMLStyleElement {
  const styleList = Array.isArray(styles) ? styles : [styles];
  const cssText = styleList.map(style => isInlineCssArtifact(style) ? String(style) : style.compiledCss).join('\n');
  const dedupeKey = 'cipo-style-' + hashString(cssText);
  const parent = target instanceof Document ? target.head : target;

  if (options.dedupe !== false) {
    const existing = parent.querySelector?.('style[data-cipo-style="' + dedupeKey + '"]');

    if (existing instanceof HTMLStyleElement) {
      return existing;
    }
  }

  const element = document.createElement('style');
  element.dataset.cipoStyle = dedupeKey;

  if (options.nonce) {
    element.nonce = options.nonce;
  }

  element.textContent = cssText;

  if (options.position === 'prepend') {
    parent.prepend(element);
  } else {
    parent.append(element);
  }

  return element;
}

/**
 * Explains a generated atomic class.
 */
export function explain(className: string): CipoExplainResult {
  const atom = runtime.debugAtoms.get(className);

  if (!atom) {
    return { className, found: false };
  }

  return {
    className,
    atom,
    found: true,
    css: compileAtomicRule(atom),
  };
}

/**
 * Reads generated CSS from the runtime style tag.
 */
export function getCssText(): string {
  if (!hasDocument()) {
    return EMPTY_STRING;
  }

  const style = document.getElementById(STYLE_ELEMENT_ID);

  if (!(style instanceof HTMLStyleElement)) {
    return EMPTY_STRING;
  }

  return style.textContent ?? EMPTY_STRING;
}

/**
 * Clears all runtime caches and generated style tags.
 */
export function reset(): void {
  runtime.sheet = null;
  runtime.insertedCss.clear();
  runtime.atomicCache.clear();
  runtime.debugAtoms.clear();
  runtime.sourceCache.clear();
  runtime.inlineCache.clear();
  runtime.themeKeys.clear();
  runtime.tokenAliases.clear();
  runtime.ambiguousTokens.clear();
  runtime.warningSink = [];
  runtime.layerHeaderInserted = false;
  runtime.themeVersion = 0;
  runtime.configVersion += 1;

  if (hasDocument()) {
    document.getElementById(STYLE_ELEMENT_ID)?.remove();
  }
}

/**
 * Creates the browser global API object.
 */
export function createBrowserGlobal(): CipoBrowserGlobal {
  return {
    cipo,
    configure,
    setup,
    theme,
    css,
    inline,
    html,
    injectGlobal,
    injectStyle,
    registerHelper,
    registerAlias,
    explain,
    getCssText,
    reset,
    createBrowserGlobal,
    installBrowserGlobal,
  };
}

/**
 * Installs the browser global API under a configurable global name.
 */
export function installBrowserGlobal(globalName = 'Cipo'): CipoBrowserGlobal {
  const api = createBrowserGlobal();
  const target = globalThis as typeof globalThis & Record<string, unknown>;

  target[globalName] = api;

  return api;
}

/* ============================================================================
 * Callable Styled API
 * ========================================================================== */

function createCipoCallable(): CipoCallable {
  const base = cipoCore as CipoCallable;

  base.css = css;
  base.html = html;
  base.theme = theme;
  base.configure = configure;
  base.setup = setup;
  base.inline = inline;
  base.injectGlobal = injectGlobal;
  base.injectStyle = injectStyle;
  base.registerHelper = registerHelper;
  base.registerAlias = registerAlias;
  base.explain = explain;
  base.getCssText = getCssText;
  base.reset = reset;
  base.createBrowserGlobal = createBrowserGlobal;
  base.installBrowserGlobal = installBrowserGlobal;

  if (typeof Proxy === 'undefined') {
    installTagFactories(base);
    return base;
  }

  return new Proxy(base, {
    get(target, property, receiver) {
      if (property in target) {
        return Reflect.get(target, property, receiver);
      }

      if (typeof property === 'string') {
        return createStyledTagFactory(property);
      }

      return undefined;
    },
  }) as CipoCallable;
}

function installTagFactories(target: CipoCallable): void {
  for (let index = 0; index < HTML_TAGS.length; index += 1) {
    const tag = HTML_TAGS[index];

    Object.defineProperty(target, tag, {
      configurable: true,
      enumerable: false,
      value: createStyledTagFactory(tag),
    });
  }
}

function cipoCore(target: CipoTarget, options?: CipoTargetOptions): CipoStyledBuilder {
  if (isElement(target)) {
    return createDomElementBuilder(target);
  }

  if (typeof target === 'string') {
    return createStyledTagFactory(target, options);
  }

  return createComponentBuilder(target, options);
}

function createDomElementBuilder<ElementType extends Element>(element: ElementType): CipoStyledBuilder<CipoDomStyledResult<ElementType>> {
  return {
    css(strings, ...values) {
      const artifact = createCssArtifact(strings, values);
      applyClassNameToElement(element, artifact.className);

      return {
        element,
        artifact,
        className: artifact.className,
      };
    },
  };
}

function createComponentBuilder<Props extends CipoAnyRecord>(component: CipoComponent<Props>, options?: CipoTargetOptions): CipoStyledBuilder<CipoComponent<Props>> {
  return {
    css(strings, ...values) {
      const artifact = createCssArtifact(strings, values);
      const adapter = resolveAdapter(options?.adapter);

      if (adapter.wrapComponent) {
        return adapter.wrapComponent(component, artifact.className) as CipoComponent<Props>;
      }

      return createGenericWrappedComponent(component, artifact.className, adapter.classProp) as CipoComponent<Props>;
    },
  };
}

function createStyledTagFactory(tag: string, options?: CipoTargetOptions, defaultProps?: CipoAnyRecord): CipoStyledTagFactory {
  return {
    css(strings, ...values) {
      const artifact = createCssArtifact(strings, values);
      const adapter = resolveAdapter(options?.adapter);

      return function CipoStyledTag(props: CipoAnyRecord = {}) {
        const mergedBaseProps = defaultProps ? mergeObjects(defaultProps, props) : props;

        if (adapter.createElement) {
          return adapter.createElement(tag, mergedBaseProps, artifact.className);
        }

        const nextProps = adapter.mergeProps(mergedBaseProps, artifact.className);
        return createPlainComponentPayload(tag, nextProps);
      };
    },
    attrs(nextDefaultProps) {
      return createStyledTagFactory(tag, options, defaultProps ? mergeObjects(defaultProps, nextDefaultProps) : nextDefaultProps);
    },
  };
}

function createPlainComponentPayload(tag: string, props: CipoAnyRecord): CipoAnyRecord {
  return { tag, props };
}

function createGenericWrappedComponent(component: unknown, className: string, classProp: 'class' | 'className'): CipoComponent {
  return function CipoWrappedComponent(props: CipoAnyRecord = {}) {
    const nextProps = mergeClassIntoProps(props, classProp, className);

    if (typeof component === 'function') {
      return (component as CipoComponent)(nextProps);
    }

    return { component, props: nextProps };
  };
}

function createDomElement(tag: string, props: CipoAnyRecord | null | undefined, className: string): Element {
  if (!hasDocument()) {
    return createPlainComponentPayload(tag, mergeClassIntoProps(props, CLASS_PROP, className)) as unknown as Element;
  }

  const element = document.createElement(tag);
  const mergedProps = mergeClassIntoProps(props, CLASS_PROP, className);

  applyPropsToElement(element, mergedProps);

  return element;
}

function applyPropsToElement(element: Element, props: CipoAnyRecord): void {
  for (const key in props) {
    const value = props[key];

    if (value === null || value === undefined || value === false) {
      continue;
    }

    if (key === CHILDREN_PROP) {
      appendChildren(element, value);
      continue;
    }

    if (key === CLASS_NAME_PROP || key === CLASS_PROP) {
      applyClassNameToElement(element, String(value));
      continue;
    }

    if (key === 'style') {
      applyInlineStyleValue(element as HTMLElement, value);
      continue;
    }

    if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
      continue;
    }

    if (value === true) {
      element.setAttribute(key, EMPTY_STRING);
      continue;
    }

    element.setAttribute(key, String(value));
  }
}

function appendChildren(element: Element, children: unknown): void {
  if (Array.isArray(children)) {
    for (let index = 0; index < children.length; index += 1) {
      appendChildren(element, children[index]);
    }

    return;
  }

  if (children === null || children === undefined || children === false) {
    return;
  }

  if (isNode(children)) {
    element.appendChild(children);
    return;
  }

  element.appendChild(document.createTextNode(String(children)));
}

function applyInlineStyleValue(element: HTMLElement, value: unknown): void {
  if (isInlineCssArtifact(value)) {
    element.setAttribute('style', value.cssText);
    return;
  }

  if (typeof value === 'string') {
    element.setAttribute('style', inline.css([value] as unknown as TemplateStringsArray).cssText);
    return;
  }

  if (isPlainObject(value)) {
    element.setAttribute('style', compileStyleObjectToInlineCss(value));
  }
}

function applyClassNameToElement(element: Element, className: string): void {
  if (!className) {
    return;
  }

  const parts = className.split(' ');

  for (let index = 0; index < parts.length; index += 1) {
    const item = parts[index];

    if (item) {
      element.classList.add(item);
    }
  }
}

function mergeClassIntoProps(props: CipoAnyRecord | null | undefined, classProp: 'class' | 'className', className: string): CipoAnyRecord {
  const nextProps = props ? { ...props } : {};
  const existing = nextProps[classProp];

  nextProps[classProp] = existing ? String(existing) + ' ' + className : className;

  return nextProps;
}

function mergeObjects(left: CipoAnyRecord, right: CipoAnyRecord): CipoAnyRecord {
  return { ...left, ...right };
}

function resolveAdapter(adapter?: CipoAdapterName | CipoAdapter): CipoAdapter {
  const selected = adapter ?? runtime.config.adapter;

  if (typeof selected !== 'string') {
    return selected;
  }

  switch (selected) {
    case 'solid':
      return SOLID_ADAPTER;
    case 'react':
      return REACT_ADAPTER;
    case 'preact':
      return PREACT_ADAPTER;
    case 'dom':
    default:
      return DOM_ADAPTER;
  }
}

/* ============================================================================
 * CSS Artifact Build + JIT
 * ========================================================================== */

function createCssArtifact(strings: TemplateStringsArray, values: readonly CipoCssInterpolation[]): CipoCssArtifact {
  const rawCss = buildCss(strings, values);
  const cacheKey = createSourceCacheKey('css', rawCss);

  if (runtime.config.jit.enabled && runtime.config.jit.cache) {
    const cached = runtime.sourceCache.get(cacheKey);

    if (cached) {
      if (runtime.config.jit.debug) {
        console.debug('[Cipó:jit] css cache hit', cacheKey);
      }

      insertCss(cached.compiledCss);
      return cached;
    }
  }

  const warnings: CipoWarning[] = [];
  const transformedCss = transformCss(rawCss, warnings);
  const ast = parseStylesheet(transformedCss, warnings);
  const scopeClassName = runtime.config.prefix + '-s-' + hashString(transformedCss);
  const atoms: CipoAtomicRule[] = [];
  const scopedRules: CipoScopedRule[] = [];

  collectRules(ast, {}, atoms, scopedRules, warnings, scopeClassName);

  const className = joinClassNames(atoms, scopedRules.length > 0 ? scopeClassName : EMPTY_STRING);
  const compiledCss = compileCss(atoms, scopedRules);
  const artifactId = runtime.config.prefix + '-artifact-' + hashString(rawCss);

  const artifact: CipoCssArtifact = {
    kind: 'cipo.css',
    className,
    scopeClassName,
    atoms,
    scopedRules,
    rawCss,
    transformedCss,
    compiledCss,
    debug: { id: artifactId, atoms, scopedRules, ast, warnings, cacheHit: false },
    toString: () => className,
    [Symbol.toPrimitive]: () => className,
    [Symbol.toStringTag]: 'CipoCssArtifact',
  };

  setBoundedCache(runtime.sourceCache, cacheKey, artifact, runtime.config.jit.maxEntries);
  insertCss(compiledCss);

  return artifact;
}

function createInlineCssArtifact(strings: TemplateStringsArray, values: readonly CipoCssInterpolation[]): CipoInlineCssArtifact {
  const rawCss = buildCss(strings, values);
  const cacheKey = createSourceCacheKey('inline', rawCss);

  if (runtime.config.jit.enabled && runtime.config.jit.cache) {
    const cached = runtime.inlineCache.get(cacheKey);

    if (cached) {
      if (runtime.config.jit.debug) {
        console.debug('[Cipó:jit] inline cache hit', cacheKey);
      }

      return cached;
    }
  }

  const warnings: CipoWarning[] = [];
  const transformedCss = transformCss(rawCss, warnings);
  const ast = parseStylesheet(transformedCss, warnings);
  const declarations = collectInlineDeclarations(ast, warnings);
  const cssText = formatInlineDeclarations(declarations);

  const artifact: CipoInlineCssArtifact = {
    kind: 'cipo.inline-css',
    rawCss,
    transformedCss,
    cssText,
    toString: () => cssText,
    [Symbol.toPrimitive]: () => cssText,
    [Symbol.toStringTag]: 'CipoInlineCssArtifact',
  };

  setBoundedCache(runtime.inlineCache, cacheKey, artifact, runtime.config.jit.maxEntries);

  return artifact;
}

function createSourceCacheKey(kind: string, rawCss: string): string {
  return [
    kind,
    runtime.config.prefix,
    runtime.config.important ? 'important' : 'normal',
    runtime.config.minify ? 'min' : 'pretty',
    runtime.config.layers ? 'layers' : 'nolayers',
    runtime.config.rem.enabled ? 'rem' + runtime.config.rem.baseFontSize : 'px',
    runtime.config.colorMode,
    runtime.themeVersion,
    runtime.configVersion,
    normalizeCss(rawCss),
  ].join('|');
}

function setBoundedCache<Value>(cache: Map<string, Value>, key: string, value: Value, maxEntries: number): void {
  if (maxEntries <= 0) {
    return;
  }

  if (cache.size >= maxEntries) {
    const first = cache.keys().next();

    if (!first.done) {
      cache.delete(first.value);
    }
  }

  cache.set(key, value);
}

/* ============================================================================
 * CSS Build + Transform
 * ========================================================================== */

function buildCss(strings: TemplateStringsArray, values: readonly CipoCssInterpolation[]): string {
  let output = EMPTY_STRING;

  for (let index = 0; index < strings.length; index += 1) {
    output += strings[index];

    if (index >= values.length) {
      continue;
    }

    const value = values[index];

    if (isCssArtifact(value)) {
      output += value.rawCss;
      continue;
    }

    if (isInlineCssArtifact(value)) {
      output += value.rawCss;
      continue;
    }

    if (isPlainObject(value)) {
      output += styleObjectToCss(value);
      continue;
    }

    output += String(value ?? EMPTY_STRING);
  }

  return output;
}

function transformCss(input: string, warnings: CipoWarning[]): string {
  const withoutComments = stripComments(input);
  const withLegacyWith = replaceWithDirectives(withoutComments, warnings);
  const withTokens = replaceThemeTokens(withLegacyWith, warnings);
  const withFunctions = replaceFunctionCalls(withTokens, warnings);

  return withFunctions;
}

function stripComments(input: string): string {
  return input.replace(/\/\*[\s\S]*?\*\//g, EMPTY_STRING).replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function replaceThemeTokens(input: string, warnings: CipoWarning[]): string {
  return input.replace(/\$([a-zA-Z][\w.-]*)/g, (match, rawName: string) => {
    const normalizedName = rawName.replaceAll('.', '-');
    const explicitKey = '$' + rawName;
    const dashedExplicitKey = '$' + normalizedName;

    if (runtime.tokenAliases.has(explicitKey)) {
      return runtime.tokenAliases.get(explicitKey) ?? match;
    }

    if (runtime.tokenAliases.has(dashedExplicitKey)) {
      return runtime.tokenAliases.get(dashedExplicitKey) ?? match;
    }

    if (runtime.ambiguousTokens.has('$' + rawName)) {
      warn(warnings, 'ambiguous-token', 'Ambiguous token "$' + rawName + '". Use an explicit namespace.', runtime.ambiguousTokens.get('$' + rawName));
      return match;
    }

    if (runtime.themeKeys.has(normalizedName) || hasCssVariable(normalizedName)) {
      return 'var(--' + runtime.config.prefix + '-' + normalizedName + ')';
    }

    if (rawName.startsWith('colors.')) {
      return 'var(--' + runtime.config.prefix + '-colors-' + rawName.slice('colors.'.length).replaceAll('.', '-') + ')';
    }

    return match;
  });
}

function replaceFunctionCalls(input: string, warnings: CipoWarning[]): string {
  return scanAndReplaceFunctions(input, (name, args, original) => {
    const helperName = name.startsWith('x:') ? name.slice(2) : name;
    const resolver = runtime.helperRegistry.get(helperName);

    if (!resolver) {
      return original;
    }

    const context: CipoHelperContext = {
      name: helperName,
      prefix: runtime.config.prefix,
      colorMode: runtime.config.colorMode,
      remBase: runtime.config.rem.baseFontSize,
    };

    const result = resolver(args, context);

    return replaceFunctionCalls(result, warnings);
  });
}

function replaceWithDirectives(input: string, warnings: CipoWarning[]): string {
  return scanAndReplaceAtFunction(input, 'with', rawArgs => expandLegacyWith(rawArgs, warnings));
}

function expandLegacyWith(rawArgs: string, warnings: CipoWarning[]): string {
  const utilities = splitTopLevel(rawArgs, ',');
  let output = EMPTY_STRING;

  for (let index = 0; index < utilities.length; index += 1) {
    output += expandLegacyUtility(utilities[index].trim(), warnings);
  }

  return output;
}

function expandLegacyUtility(rawUtility: string, warnings: CipoWarning[]): string {
  if (!rawUtility) {
    return EMPTY_STRING;
  }

  if (BUILTIN_ALIAS_MAP[rawUtility]) {
    return BUILTIN_ALIAS_MAP[rawUtility];
  }

  if (runtime.aliasRegistry.has(rawUtility)) {
    return stringifyAliasValue(rawUtility, warnings);
  }

  const call = parseFunctionCall(rawUtility);

  if (!call) {
    warn(warnings, 'unknown-utility', 'Unknown @with utility "' + rawUtility + '".', rawUtility);
    return EMPTY_STRING;
  }

  if (call.name === 'text') {
    return expandTextUtility(call.args.join(','), warnings);
  }

  const alias = PROPERTY_ALIASES[call.name];

  if (alias) {
    const value = call.args.join(',').trim();
    return createDeclaration(alias.property, normalizeDeclarationValue(alias.property, value, alias.scale));
  }

  warn(warnings, 'unknown-utility', 'Unknown @with utility "' + call.name + '".', rawUtility);

  return EMPTY_STRING;
}

/* ============================================================================
 * Helpers
 * ========================================================================== */

function resolveSpacingFunction(rawValue: string): string {
  return 'calc(var(--' + runtime.config.prefix + '-spacing, ' + DEFAULT_SPACING_VALUE + ') * ' + rawValue.trim() + ')';
}

function resolveFluidFunction(rawArgs: string): string {
  const parts = splitTopLevel(rawArgs, ',');
  const min = normalizeDeclarationValue('fluid', parts[0]?.trim() || '1rem');
  const max = normalizeDeclarationValue('fluid', parts[1]?.trim() || '2rem');
  const preferred = normalizeDeclarationValue('fluid', parts[2]?.trim() || 'calc(' + min + ' + 1vw)');

  return 'clamp(' + min + ', ' + preferred + ', ' + max + ')';
}

function resolveAlphaFunction(rawArgs: string, context: CipoHelperContext): string {
  const parts = splitTopLevel(rawArgs, '/');
  const color = parts[0]?.trim() || 'currentColor';
  const amount = parts[1]?.trim() || '50%';

  if (context.colorMode === 'rgba') {
    return 'color-mix(in srgb, ' + color + ' ' + amount + ', transparent)';
  }

  if (context.colorMode === 'hsl') {
    return 'color-mix(in hsl, ' + color + ' ' + amount + ', transparent)';
  }

  if (context.colorMode === 'oklab') {
    return 'color-mix(in oklab, ' + color + ' ' + amount + ', transparent)';
  }

  return 'color-mix(in oklch, ' + color + ' ' + amount + ', transparent)';
}

function resolveColorAdjustFunction(name: string, rawArgs: string): string {
  const parts = splitTopLevel(rawArgs, ',');
  const color = parts[0]?.trim() || 'currentColor';
  const amount = parts[1]?.trim() || '10%';
  const numericAmount = amount.endsWith('%') ? String(Number(amount.slice(0, -1)) / 100) : amount;
  const signedAmount = name === 'darken' ? '-' + numericAmount.replace(/^-/, '') : numericAmount;

  if (runtime.config.colorMode === 'preserve') {
    return color;
  }

  if (name === 'saturate') {
    return 'oklch(from ' + color + ' l calc(c + ' + numericAmount + ') h)';
  }

  if (name === 'desaturate') {
    return 'oklch(from ' + color + ' l calc(c - ' + numericAmount + ') h)';
  }

  return 'oklch(from ' + color + ' calc(l + ' + signedAmount + ') c h)';
}

function resolveMixFunction(rawArgs: string): string {
  const parts = splitTopLevel(rawArgs, ',');
  const left = parts[0]?.trim() || 'currentColor';
  const right = parts[1]?.trim() || 'transparent';
  const amount = parts[2]?.trim() || '50%';
  const mode = runtime.config.colorMode === 'rgba' ? 'srgb' : runtime.config.colorMode === 'preserve' ? 'oklch' : runtime.config.colorMode;

  return 'color-mix(in ' + mode + ', ' + left + ' ' + amount + ', ' + right + ')';
}

function resolveGradientFunction(rawArgs: string): string {
  const parts = splitTopLevel(rawArgs, ',').map(part => part.trim()).filter(Boolean);
  const kind = parts[0] ?? 'linear';

  if (kind === 'radial') {
    return 'radial-gradient(' + parts.slice(1).join(', ') + ')';
  }

  if (kind === 'conic') {
    return 'conic-gradient(' + parts.slice(1).join(', ') + ')';
  }

  return 'linear-gradient(' + parts.slice(1).join(', ') + ')';
}

/* ============================================================================
 * Text Helper
 * ========================================================================== */

function expandTextUtility(value: string, warnings: CipoWarning[]): string {
  const args = splitTopLevel(value, ',');
  const typed = parseTypedArguments(value);
  let output = EMPTY_STRING;
  let inferredColor = EMPTY_STRING;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index].trim();

    if (!arg || arg.includes(':')) {
      continue;
    }

    if (arg === 'underline') {
      output += createDeclaration('text-decoration-line', 'underline');
      continue;
    }

    if (arg === 'no-underline') {
      output += createDeclaration('text-decoration-line', 'none');
      continue;
    }

    if (arg === 'uppercase' || arg === 'lowercase' || arg === 'capitalize') {
      output += createDeclaration('text-transform', arg);
      continue;
    }

    if (isColorLike(arg)) {
      inferredColor = arg;
      continue;
    }

    if (arg.startsWith('gradient(')) {
      output += createTextFillDeclarations(resolveGradientFunction(arg.slice('gradient('.length, -1)));
    }
  }

  if (typed.size) {
    output += createDeclaration('font-size', resolveTextSize(typed.size));
  }

  if (typed.lh || typed.leading) {
    output += createDeclaration('line-height', typed.lh ?? typed.leading ?? EMPTY_STRING);
  }

  if (typed.color || inferredColor) {
    output += createDeclaration('color', normalizeDeclarationValue('color', typed.color ?? inferredColor, 'color'));
  }

  if (typed.weight) {
    output += createDeclaration('font-weight', typed.weight);
  }

  if (typed.align) {
    output += createDeclaration('text-align', typed.align);
  }

  if (typed.decoration) {
    output += createDeclaration('text-decoration-line', typed.decoration);
  }

  if (typed.shadow) {
    output += createDeclaration('text-shadow', resolveShadowValue(typed.shadow));
  }

  if (typed.tracking) {
    output += createDeclaration('letter-spacing', resolveTrackingValue(typed.tracking));
  }

  if (typed.transform) {
    output += createDeclaration('text-transform', typed.transform);
  }

  if (typed.wrap) {
    output += createDeclaration('text-wrap', typed.wrap);
  }

  if (typed.fill) {
    const fill = typed.fill.startsWith('gradient(') ? resolveGradientFunction(typed.fill.slice('gradient('.length, -1)) : typed.fill;
    output += createTextFillDeclarations(fill);
  }

  if (!output) {
    warn(warnings, 'ambiguous-text-utility', 'text() needs typed arguments like text(size: sm, lh: 2, color: red).', value);
  }

  return output;
}

function createTextFillDeclarations(fill: string): string {
  return createDeclaration('background-image', fill)
    + createDeclaration('-webkit-background-clip', 'text')
    + createDeclaration('background-clip', 'text')
    + createDeclaration('color', 'transparent');
}

/* ============================================================================
 * Parser
 * ========================================================================== */

function parseStylesheet(input: string, warnings: CipoWarning[]): readonly CipoAstNode[] {
  return parseBlockBody(input, warnings);
}

function parseBlockBody(input: string, warnings: CipoWarning[]): readonly CipoAstNode[] {
  const nodes: CipoAstNode[] = [];
  let buffer = EMPTY_STRING;
  let index = 0;

  while (index < input.length) {
    const char = input[index];

    if (char !== '{') {
      buffer += char;
      index += 1;
      continue;
    }

    const blockName = buffer.trim();
    buffer = EMPTY_STRING;

    const endIndex = findMatchingBrace(input, index);

    if (endIndex < 0) {
      warn(warnings, 'unclosed-block', 'Block "' + blockName + '" is missing a closing brace.', input.slice(index));
      buffer += input.slice(index);
      break;
    }

    const body = input.slice(index + 1, endIndex);

    nodes.push({
      type: 'block',
      name: blockName,
      body: parseBlockBody(body, warnings),
      source: blockName + '{' + body + '}',
    });

    index = endIndex + 1;
  }

  appendStatements(nodes, buffer, warnings);

  return nodes;
}

function appendStatements(nodes: CipoAstNode[], input: string, warnings: CipoWarning[]): void {
  const chunks = splitTopLevel(input, ';');

  for (let index = 0; index < chunks.length; index += 1) {
    const source = chunks[index].trim();

    if (!source) {
      continue;
    }

    if (source.startsWith('@')) {
      const directive = parseDirective(source, warnings);

      if (directive) {
        nodes.push(directive);
      }

      continue;
    }

    const expandedStatement = expandStatement(source, warnings);

    if (expandedStatement) {
      appendStatements(nodes, expandedStatement, warnings);
      continue;
    }

    const colonIndex = findTopLevelColon(source);

    if (colonIndex <= 0) {
      warn(warnings, 'invalid-declaration', 'Invalid declaration "' + source + '".', source);
      continue;
    }

    const rawProperty = source.slice(0, colonIndex).trim();
    const rawValue = source.slice(colonIndex + 1).trim();
    const normalizedDeclarations = normalizePropertyDeclaration(rawProperty, rawValue);

    for (let childIndex = 0; childIndex < normalizedDeclarations.length; childIndex += 1) {
      nodes.push(normalizedDeclarations[childIndex]);
    }
  }
}

function expandStatement(source: string, warnings: CipoWarning[]): string | null {
  if (BUILTIN_ALIAS_MAP[source]) {
    return BUILTIN_ALIAS_MAP[source];
  }

  if (runtime.aliasRegistry.has(source)) {
    return stringifyAliasValue(source, warnings);
  }

  const call = parseFunctionCall(source);

  if (!call) {
    return null;
  }

  if (call.name === 'text') {
    return expandTextUtility(call.args.join(','), warnings);
  }

  const alias = PROPERTY_ALIASES[call.name];

  if (alias) {
    return createDeclaration(alias.property, normalizeDeclarationValue(alias.property, call.args.join(',').trim(), alias.scale));
  }

  return null;
}

function stringifyAliasValue(name: string, warnings: CipoWarning[]): string {
  const value = runtime.aliasRegistry.get(name);
  const context: CipoAliasContext = { name, prefix: runtime.config.prefix };

  if (typeof value === 'function') {
    const next = value(context);
    return typeof next === 'string' ? next : styleObjectToCss(next);
  }

  if (isPlainObject(value)) {
    return styleObjectToCss(value);
  }

  if (typeof value === 'string') {
    return value;
  }

  warn(warnings, 'invalid-alias', 'Alias "' + name + '" is invalid.', value);
  return EMPTY_STRING;
}

function parseDeclarationsAndDirectives(input: string, warnings: CipoWarning[]): readonly CipoAstNode[] {
  const nodes: CipoAstNode[] = [];
  appendStatements(nodes, input, warnings);
  return nodes;
}

function parseDirective(source: string, warnings: CipoWarning[]): CipoDirectiveNode | null {
  const parsed = parseAtFunctionCall(source);

  if (!parsed) {
    warn(warnings, 'invalid-directive', 'Invalid directive "' + source + '".', source);
    return null;
  }

  return {
    type: 'directive',
    name: parsed.name,
    args: splitTopLevel(parsed.args, ','),
    source,
  };
}

/* ============================================================================
 * AST Collection
 * ========================================================================== */

function collectRules(
  nodes: readonly CipoAstNode[],
  context: CipoRuleContext,
  atoms: CipoAtomicRule[],
  scopedRules: CipoScopedRule[],
  warnings: CipoWarning[],
  scopeClassName: string,
): void {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];

    if (node.type === 'declaration') {
      collectDeclaration(node, context, atoms);
      continue;
    }

    if (node.type === 'directive') {
      collectDirective(node, context, atoms, warnings, scopeClassName);
      continue;
    }

    collectBlock(node, context, atoms, scopedRules, warnings, scopeClassName);
  }
}

function collectDeclaration(declaration: CipoDeclarationNode, context: CipoRuleContext, atoms: CipoAtomicRule[]): void {
  const expanded = expandResponsiveDeclaration(declaration);

  if (!expanded) {
    atoms.push(createAtomicRule(declaration, context));
    return;
  }

  for (let index = 0; index < expanded.length; index += 1) {
    const item = expanded[index];

    atoms.push(createAtomicRule({
      type: 'declaration',
      property: declaration.property,
      value: item.value,
      source: declaration.property + ':' + item.value,
    }, resolveBreakpointContext(context, item.breakpoint)));
  }
}

function collectDirective(
  directive: CipoDirectiveNode,
  context: CipoRuleContext,
  atoms: CipoAtomicRule[],
  warnings: CipoWarning[],
  scopeClassName: string,
): void {
  if (directive.name !== 'with') {
    warn(warnings, 'unknown-directive', 'Unknown directive "@' + directive.name + '".', directive);
    return;
  }

  const expanded = expandLegacyWith(directive.args.join(','), warnings);
  const nestedAst = parseDeclarationsAndDirectives(expanded, warnings);

  collectRules(nestedAst, context, atoms, [], warnings, scopeClassName);
}

function collectBlock(
  block: CipoBlockNode,
  context: CipoRuleContext,
  atoms: CipoAtomicRule[],
  scopedRules: CipoScopedRule[],
  warnings: CipoWarning[],
  scopeClassName: string,
): void {
  const name = block.name.trim();

  if (name.startsWith('x:not(')) {
    const breakpoint = name.replace(/^x:not\(/, EMPTY_STRING).replace(/\)$/, EMPTY_STRING).trim();
    collectRules(block.body, { ...context, notBreakpoint: breakpoint }, atoms, scopedRules, warnings, scopeClassName);
    return;
  }

  if (name.startsWith('x:')) {
    const parts = name.slice(2).split(':').map(part => part.trim()).filter(Boolean);
    let nextContext = context;
    let consumed = false;

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];

      if (part in runtime.config.breakpoints) {
        nextContext = resolveBreakpointContext(nextContext, part);
        consumed = true;
        continue;
      }

      if (part === 'dark') {
        nextContext = { ...nextContext, dark: true };
        consumed = true;
        continue;
      }

      if (isPseudoName(part)) {
        nextContext = { ...nextContext, pseudo: ':' + part };
        consumed = true;
      }
    }

    if (consumed) {
      collectRules(block.body, nextContext, atoms, scopedRules, warnings, scopeClassName);
      return;
    }
  }

  const declarations: CipoDeclarationNode[] = [];

  for (let index = 0; index < block.body.length; index += 1) {
    const node = block.body[index];

    if (node.type === 'declaration') {
      declarations.push(node);
    }
  }

  if (declarations.length === 0) {
    return;
  }

  scopedRules.push({ selector: resolveScopedSelector(scopeClassName, name), declarations, context });
}

/* ============================================================================
 * Declaration Normalization
 * ========================================================================== */

function normalizePropertyDeclaration(rawProperty: string, rawValue: string): CipoDeclarationNode[] {
  const alias = PROPERTY_ALIASES[rawProperty];

  if (!alias) {
    return [{ type: 'declaration', property: rawProperty, value: normalizeDeclarationValue(rawProperty, rawValue), source: rawProperty + ':' + rawValue }];
  }

  const normalizedValue = normalizeDeclarationValue(alias.property, rawValue, alias.scale);

  return [{ type: 'declaration', property: alias.property, value: normalizedValue, source: rawProperty + ':' + rawValue }];
}

function normalizeDeclarationValue(property: string, rawValue: string, scale: AliasScale = 'none'): string {
  const value = rawValue.trim();

  if (!value) {
    return value;
  }

  const withHelpers = replaceFunctionCalls(value, []);

  if (scale === 'spacing' && isPlainNumber(withHelpers)) {
    return resolveSpacingFunction(withHelpers);
  }

  if (scale === 'radius' && RADIUS_TOKENS.has(withHelpers)) {
    return 'var(--' + runtime.config.prefix + '-radius-' + withHelpers + ')';
  }

  if (scale === 'shadow' && SHADOW_TOKENS.has(withHelpers)) {
    return 'var(--' + runtime.config.prefix + '-shadow-' + withHelpers + ')';
  }

  if (scale === 'text' && TEXT_SIZE_TOKENS.has(withHelpers)) {
    return 'var(--' + runtime.config.prefix + '-text-' + withHelpers + ')';
  }

  return normalizePxValues(withHelpers);
}

function normalizePxValues(value: string): string {
  if (!runtime.config.rem.enabled) {
    return value;
  }

  return value.replace(/(-?\d*\.?\d+)px\b/g, (_match, amount: string) => pxToRem(amount + 'px'));
}

function pxToRem(value: string): string {
  const numeric = Number(value.replace('px', '').trim());

  if (!Number.isFinite(numeric)) {
    return value;
  }

  const rem = numeric / runtime.config.rem.baseFontSize;
  const rounded = Math.round(rem * 10000) / 10000;

  return String(rounded).replace(/\.0+$/, '') + 'rem';
}

function resolveTextSize(value: string): string {
  if (TEXT_SIZE_TOKENS.has(value)) {
    return 'var(--' + runtime.config.prefix + '-text-' + value + ')';
  }

  return normalizeDeclarationValue('font-size', value);
}

function resolveShadowValue(value: string): string {
  if (SHADOW_TOKENS.has(value)) {
    return 'var(--' + runtime.config.prefix + '-shadow-' + value + ')';
  }

  return normalizeDeclarationValue('text-shadow', value);
}

function resolveTrackingValue(value: string): string {
  if (/^[a-z][\w-]*$/i.test(value)) {
    return 'var(--' + runtime.config.prefix + '-tracking-' + value + ')';
  }

  return normalizeDeclarationValue('letter-spacing', value);
}

/* ============================================================================
 * Responsive Values
 * ========================================================================== */

function expandResponsiveDeclaration(declaration: CipoDeclarationNode): Array<{ readonly breakpoint: string; readonly value: string }> | null {
  const parts = splitTopLevel(declaration.value, ',');
  const result: Array<{ readonly breakpoint: string; readonly value: string }> = [];
  let hasResponsive = false;

  for (let index = 0; index < parts.length; index += 1) {
    const trimmed = parts[index].trim();
    const parsed = parseFunctionCall(trimmed);

    if (!parsed || !(parsed.name in runtime.config.breakpoints)) {
      result.push({ breakpoint: 'base', value: trimmed });
      continue;
    }

    hasResponsive = true;
    result.push({ breakpoint: parsed.name, value: parsed.args.join(',').trim() });
  }

  return hasResponsive ? result : null;
}

function resolveBreakpointContext(context: CipoRuleContext, breakpoint: string): CipoRuleContext {
  const mediaQuery = runtime.config.breakpoints[breakpoint];

  if (!mediaQuery) {
    return context;
  }

  return { ...context, breakpoint, mediaQuery };
}

/* ============================================================================
 * Atomic CSS
 * ========================================================================== */

function createAtomicRule(declaration: CipoDeclarationNode, context: CipoRuleContext): CipoAtomicRule {
  const property = normalizeCss(declaration.property);
  const value = normalizeCss(declaration.value);
  const normalizedValue = runtime.config.important ? addImportant(value) : value;
  const id = [property, normalizedValue, context.mediaQuery ?? EMPTY_STRING, context.pseudo ?? EMPTY_STRING, context.dark ? 'dark' : EMPTY_STRING, context.notBreakpoint ?? EMPTY_STRING].join('|');
  const cached = runtime.atomicCache.get(id);

  if (cached) {
    return cached;
  }

  const className = runtime.config.prefix + '-a-' + hashString(id);
  const atom: CipoAtomicRule = { id, className, property: declaration.property, value: normalizedValue, context, source: declaration.source };

  runtime.atomicCache.set(id, atom);
  runtime.debugAtoms.set(className, atom);

  return atom;
}

function compileCss(atoms: readonly CipoAtomicRule[], scopedRules: readonly CipoScopedRule[]): string {
  const atomicChunks: string[] = [];
  const scopedChunks: string[] = [];

  for (let index = 0; index < atoms.length; index += 1) {
    atomicChunks.push(compileAtomicRule(atoms[index]));
  }

  for (let index = 0; index < scopedRules.length; index += 1) {
    scopedChunks.push(compileScopedRule(scopedRules[index]));
  }

  const atomicCss = atomicChunks.filter(Boolean).join('\n');
  const scopedCss = scopedChunks.filter(Boolean).join('\n');
  const output = [wrapLayer('atomic', atomicCss), wrapLayer('scoped', scopedCss)].filter(Boolean).join('\n');

  return formatCss(output);
}

function compileAtomicRule(atom: CipoAtomicRule): string {
  const selector = compileSelector(atom.className, atom.context);

  return wrapContext(selector + '{' + createDeclaration(atom.property, atom.value) + '}', atom.context);
}

function compileScopedRule(rule: CipoScopedRule): string {
  let declarations = EMPTY_STRING;

  for (let index = 0; index < rule.declarations.length; index += 1) {
    const declaration = rule.declarations[index];
    const value = runtime.config.important ? addImportant(declaration.value) : declaration.value;

    declarations += createDeclaration(declaration.property, value);
  }

  return wrapContext(rule.selector + '{' + declarations + '}', rule.context);
}

function compileSelector(className: string, context: CipoRuleContext): string {
  let selector = '.' + className;

  if (context.pseudo) {
    selector += context.pseudo;
  }

  if (context.dark) {
    selector = runtime.config.darkSelector + ' ' + selector;
  }

  return selector;
}

function wrapContext(rule: string, context: CipoRuleContext): string {
  let output = rule;

  if (context.mediaQuery) {
    output = '@media ' + context.mediaQuery + '{' + output + '}';
  }

  if (context.notBreakpoint) {
    const query = runtime.config.breakpoints[context.notBreakpoint];

    if (query) {
      output = '@media not all and ' + query + '{' + output + '}';
    }
  }

  return output;
}

/* ============================================================================
 * Inline CSS
 * ========================================================================== */

function collectInlineDeclarations(ast: readonly CipoAstNode[], warnings: CipoWarning[]): CipoDeclarationNode[] {
  const output: CipoDeclarationNode[] = [];

  for (let index = 0; index < ast.length; index += 1) {
    const node = ast[index];

    if (node.type === 'declaration') {
      output.push(node);
      continue;
    }

    if (node.type === 'directive' && node.name === 'with') {
      output.push(...collectInlineDeclarations(parseDeclarationsAndDirectives(expandLegacyWith(node.args.join(','), warnings), warnings), warnings));
    }
  }

  return output;
}

function formatInlineDeclarations(declarations: readonly CipoDeclarationNode[]): string {
  let output = EMPTY_STRING;

  for (let index = 0; index < declarations.length; index += 1) {
    const declaration = declarations[index];
    output += createDeclaration(declaration.property, declaration.value);
  }

  return runtime.config.minify ? normalizeCss(output) : output.replace(/;/g, '; ').trim();
}

function compileStyleObjectToInlineCss(value: Record<string, unknown>): string {
  const cssText = styleObjectToCss(value as CipoStyleObject);

  return inline.css([cssText] as unknown as TemplateStringsArray).cssText;
}

/* ============================================================================
 * Global CSS Important Transformer
 * ========================================================================== */

function addImportantToCssText(cssText: string): string {
  const chunks = splitTopLevelRules(cssText);
  let output = EMPTY_STRING;

  for (let index = 0; index < chunks.length; index += 1) {
    output += addImportantToRule(chunks[index]) + '\n';
  }

  return output.trim();
}

function addImportantToRule(rule: string): string {
  const openIndex = rule.indexOf('{');
  const closeIndex = rule.lastIndexOf('}');

  if (openIndex < 0 || closeIndex <= openIndex) {
    return rule;
  }

  const head = rule.slice(0, openIndex).trim();
  const body = rule.slice(openIndex + 1, closeIndex);

  if (head.startsWith('@')) {
    return head + '{' + addImportantToCssText(body) + '}';
  }

  const declarations = parseDeclarationsAndDirectives(body, []);
  let nextBody = EMPTY_STRING;

  for (let index = 0; index < declarations.length; index += 1) {
    const node = declarations[index];

    if (node.type !== 'declaration') {
      continue;
    }

    nextBody += createDeclaration(node.property, addImportant(node.value));
  }

  return head + '{' + nextBody + '}';
}

function addImportant(value: string): string {
  return /\s!important\s*$/i.test(value) ? value : value + ' !important';
}

/* ============================================================================
 * CSS Formatting and Layers
 * ========================================================================== */

function insertCss(cssText: string): void {
  if (!hasDocument() || !cssText) {
    return;
  }

  const style = ensureStyleElement();

  if (runtime.config.layers && !runtime.layerHeaderInserted) {
    appendCssText(style, DEFAULT_LAYER_DECLARATION + '\n');
    runtime.layerHeaderInserted = true;
  }

  const rules = splitTopLevelRules(cssText);

  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index];
    const normalized = normalizeCss(rule);

    if (!normalized || runtime.insertedCss.has(normalized)) {
      continue;
    }

    runtime.insertedCss.add(normalized);
    appendCssText(style, formatCss(rule) + '\n');
  }
}

function ensureStyleElement(): HTMLStyleElement {
  const existing = document.getElementById(STYLE_ELEMENT_ID);

  if (existing instanceof HTMLStyleElement) {
    return existing;
  }

  const element = document.createElement('style');
  element.id = STYLE_ELEMENT_ID;
  element.dataset.cipo = 'runtime';
  document.head.appendChild(element);

  return element;
}

function appendCssText(style: HTMLStyleElement, cssText: string): void {
  style.appendChild(document.createTextNode(cssText));
}

function wrapLayer(layer: CipoLayerName, cssText: string): string {
  if (!runtime.config.layers || !cssText) {
    return cssText;
  }

  return '@layer cipo.' + layer + '{' + cssText + '}';
}

function formatRawCss(cssText: string): string {
  return runtime.config.minify ? normalizeCss(cssText) : cssText.trim();
}

function formatCss(cssText: string): string {
  if (runtime.config.minify) {
    return normalizeCss(cssText);
  }

  return prettyCss(cssText);
}

function prettyCss(cssText: string): string {
  let output = EMPTY_STRING;
  let depth = 0;
  let token = EMPTY_STRING;
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < cssText.length; index += 1) {
    const char = cssText[index];

    if (quote) {
      token += char;
      if (char === quote && cssText[index - 1] !== '\\') quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      token += char;
      continue;
    }

    if (char === '{') {
      output += indent(depth) + token.trim() + ' {\n';
      depth += 1;
      token = EMPTY_STRING;
      continue;
    }

    if (char === '}') {
      if (token.trim()) {
        output += indent(depth) + token.trim() + '\n';
      }
      depth = Math.max(0, depth - 1);
      output += indent(depth) + '}\n';
      token = EMPTY_STRING;
      continue;
    }

    if (char === ';') {
      output += indent(depth) + token.trim() + ';\n';
      token = EMPTY_STRING;
      continue;
    }

    token += char;
  }

  if (token.trim()) {
    output += indent(depth) + token.trim();
  }

  return output.trim();
}

function indent(depth: number): string {
  return '  '.repeat(depth);
}

function createDeclaration(property: string, value: string): string {
  return property + ':' + value + ';';
}

/* ============================================================================
 * Scanner Helpers
 * ========================================================================== */

function scanAndReplaceFunctions(input: string, replacer: (name: string, args: string, original: string) => string): string {
  let output = EMPTY_STRING;
  let index = 0;

  while (index < input.length) {
    const start = findNextFunctionStart(input, index);

    if (!start) {
      output += input.slice(index);
      break;
    }

    output += input.slice(index, start.nameStart);

    const endIndex = findMatchingParen(input, start.openIndex);

    if (endIndex < 0) {
      output += input.slice(start.nameStart);
      break;
    }

    const original = input.slice(start.nameStart, endIndex + 1);
    const args = input.slice(start.openIndex + 1, endIndex);
    output += replacer(start.name, args, original);
    index = endIndex + 1;
  }

  return output;
}

function scanAndReplaceAtFunction(input: string, name: string, replacer: (args: string) => string): string {
  let output = EMPTY_STRING;
  let index = 0;
  const needle = '@' + name + '(';

  while (index < input.length) {
    const start = input.indexOf(needle, index);

    if (start < 0) {
      output += input.slice(index);
      break;
    }

    output += input.slice(index, start);

    const openIndex = start + needle.length - 1;
    const endIndex = findMatchingParen(input, openIndex);

    if (endIndex < 0) {
      output += input.slice(start);
      break;
    }

    output += replacer(input.slice(openIndex + 1, endIndex));

    let nextIndex = endIndex + 1;
    if (input[nextIndex] === ';') {
      nextIndex += 1;
    }

    index = nextIndex;
  }

  return output;
}

function findNextFunctionStart(input: string, fromIndex: number): { readonly name: string; readonly nameStart: number; readonly openIndex: number } | null {
  let quote: '"' | "'" | null = null;

  for (let index = fromIndex; index < input.length; index += 1) {
    const char = input[index];

    if (quote) {
      if (char === quote && input[index - 1] !== '\\') quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char !== '(') {
      continue;
    }

    let cursor = index - 1;
    while (cursor >= fromIndex && /[\w:-]/.test(input[cursor])) {
      cursor -= 1;
    }

    const nameStart = cursor + 1;
    const name = input.slice(nameStart, index);

    if (!name || /^[0-9]/.test(name)) {
      continue;
    }

    return { name, nameStart, openIndex: index };
  }

  return null;
}

function findMatchingParen(input: string, openIndex: number): number {
  let depth = 0;
  let quote: '"' | "'" | null = null;

  for (let index = openIndex; index < input.length; index += 1) {
    const char = input[index];

    if (quote) {
      if (char === quote && input[index - 1] !== '\\') quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;

    if (depth === 0) {
      return index;
    }
  }

  return -1;
}

/* ============================================================================
 * Utility Helpers
 * ========================================================================== */

function normalizeRemConfig(rem: boolean | CipoRemConfig | undefined, baseFontSize: number | undefined): Required<CipoRemConfig> | null {
  if (rem === undefined && baseFontSize === undefined) {
    return null;
  }

  if (typeof rem === 'boolean') {
    return { enabled: rem, baseFontSize: baseFontSize ?? runtime.config.rem.baseFontSize };
  }

  return {
    enabled: rem?.enabled ?? runtime.config.rem.enabled,
    baseFontSize: rem?.baseFontSize ?? baseFontSize ?? runtime.config.rem.baseFontSize,
  };
}

function normalizeJitConfig(jit: boolean | CipoJitConfig | undefined): Required<CipoJitConfig> | null {
  if (jit === undefined) {
    return null;
  }

  if (typeof jit === 'boolean') {
    return { ...runtime.config.jit, enabled: jit };
  }

  return {
    enabled: jit.enabled ?? runtime.config.jit.enabled,
    cache: jit.cache ?? runtime.config.jit.cache,
    maxEntries: jit.maxEntries ?? runtime.config.jit.maxEntries,
    debug: jit.debug ?? runtime.config.jit.debug,
  };
}

function flattenTheme(tokens: CipoThemeDefinition, path: readonly string[] = []): Array<readonly [string, string | number]> {
  const output: Array<readonly [string, string | number]> = [];
  const entries = Object.entries(tokens);

  for (let index = 0; index < entries.length; index += 1) {
    const [key, value] = entries[index];
    const nextPath = path.length === 0 ? [key] : [...path, key];

    if (isPlainObject(value)) {
      output.push(...flattenTheme(value as CipoThemeDefinition, nextPath));
      continue;
    }

    output.push([nextPath.join('-'), value]);
  }

  return output;
}

function styleObjectToCss(styleObject: CipoStyleObject): string {
  let output = EMPTY_STRING;
  const entries = Object.entries(styleObject);

  for (let index = 0; index < entries.length; index += 1) {
    const [key, value] = entries[index];

    if (value === null || value === undefined) {
      continue;
    }

    if (isPlainObject(value)) {
      output += key + '{' + styleObjectToCss(value as CipoStyleObject) + '}';
      continue;
    }

    const alias = PROPERTY_ALIASES[key];
    const property = alias?.property ?? toKebabCase(key);
    const scale = alias?.scale ?? 'none';

    output += createDeclaration(property, normalizeDeclarationValue(property, String(value), scale));
  }

  return output;
}

function parseFunctionCall(input: string): null | { readonly name: string; readonly args: readonly string[] } {
  const openIndex = input.indexOf('(');
  const closeIndex = input.lastIndexOf(')');

  if (openIndex < 0 || closeIndex <= openIndex) {
    return null;
  }

  const endIndex = findMatchingParen(input, openIndex);

  if (endIndex !== closeIndex) {
    return null;
  }

  return {
    name: input.slice(0, openIndex).trim(),
    args: splitTopLevel(input.slice(openIndex + 1, closeIndex), ','),
  };
}

function parseAtFunctionCall(input: string): null | { readonly name: string; readonly args: string } {
  if (!input.startsWith('@')) {
    return null;
  }

  const openIndex = input.indexOf('(');
  const closeIndex = input.lastIndexOf(')');

  if (openIndex < 0 || closeIndex <= openIndex) {
    return null;
  }

  const name = input.slice(1, openIndex).trim();
  const endIndex = findMatchingParen(input, openIndex);

  if (!name || endIndex !== closeIndex) {
    return null;
  }

  return { name, args: input.slice(openIndex + 1, closeIndex) };
}

function parseTypedArguments(input: string): Record<string, string> {
  const result: Record<string, string> = {};
  const parts = splitTopLevel(input, ',');

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const colonIndex = findTopLevelColon(part);

    if (colonIndex <= 0) {
      continue;
    }

    result[part.slice(0, colonIndex).trim()] = part.slice(colonIndex + 1).trim();
  }

  return result;
}

function splitTopLevel(input: string, separator: string): string[] {
  const output: string[] = [];
  let buffer = EMPTY_STRING;
  let depth = 0;
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (quote) {
      buffer += char;
      if (char === quote && input[index - 1] !== '\\') quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      buffer += char;
      continue;
    }

    if (char === '(' || char === '[') depth += 1;
    else if (char === ')' || char === ']') depth -= 1;

    if (char === separator && depth === 0) {
      if (buffer.trim()) output.push(buffer.trim());
      buffer = EMPTY_STRING;
      continue;
    }

    buffer += char;
  }

  if (buffer.trim()) output.push(buffer.trim());
  return output;
}

function splitTopLevelRules(input: string): string[] {
  const output: string[] = [];
  let start = 0;
  let depth = 0;
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (quote) {
      if (char === quote && input[index - 1] !== '\\') quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '{') depth += 1;
    else if (char === '}') depth -= 1;

    if (depth === 0 && char === '}') {
      output.push(input.slice(start, index + 1).trim());
      start = index + 1;
    }
  }

  const tail = input.slice(start).trim();
  if (tail) output.push(tail);

  return output.filter(Boolean);
}

function findMatchingBrace(input: string, startIndex: number): number {
  let depth = 0;
  let quote: '"' | "'" | null = null;

  for (let index = startIndex; index < input.length; index += 1) {
    const char = input[index];

    if (quote) {
      if (char === quote && input[index - 1] !== '\\') quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '{') depth += 1;
    else if (char === '}') depth -= 1;

    if (depth === 0) return index;
  }

  return -1;
}

function findTopLevelColon(input: string): number {
  let depth = 0;
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (quote) {
      if (char === quote && input[index - 1] !== '\\') quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '(' || char === '[') depth += 1;
    else if (char === ')' || char === ']') depth -= 1;
    else if (char === ':' && depth === 0) return index;
  }

  return -1;
}

function resolveScopedSelector(scopeClassName: string, selector: string): string {
  const normalized = selector.trim();
  if (!normalized) return '.' + scopeClassName;
  if (normalized.includes('&')) return normalized.replaceAll('&', '.' + scopeClassName);
  return '.' + scopeClassName + ' ' + normalized;
}

function joinClassNames(atoms: readonly CipoAtomicRule[], scopeClassName: string): string {
  const seen = new Set<string>();
  let output = EMPTY_STRING;

  if (scopeClassName) {
    seen.add(scopeClassName);
    output += scopeClassName;
  }

  for (let index = 0; index < atoms.length; index += 1) {
    const className = atoms[index].className;

    if (seen.has(className)) continue;

    seen.add(className);
    output += output ? ' ' + className : className;
  }

  return output;
}

function normalizeCss(input: string): string {
  return input.replace(/\s+/g, ' ').replace(/\s*([{}:;,>+~])\s*/g, '$1').trim();
}

function hashString(input: string): string {
  let hash = HASH_SEED;

  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(index)) & HASH_MASK;
  }

  return (hash >>> 0).toString(36);
}

function toKebabCase(input: string): string {
  return input.replace(/[A-Z]/g, match => '-' + match.toLowerCase());
}

function warn(warnings: CipoWarning[], code: string, message: string, context?: unknown): void {
  const warning = { code, message, context };
  warnings.push(warning);
  runtime.warningSink.push(warning);
  runtime.config.onWarning?.(warning);

  if (runtime.config.debug) {
    console.warn('[Cipó:' + code + '] ' + message, context ?? EMPTY_STRING);
  }
}

function hasCssVariable(tokenName: string): boolean {
  if (!hasDocument()) return false;

  const variableName = '--' + runtime.config.prefix + '-' + tokenName;
  const root = document.querySelector(runtime.config.themeRootSelector) ?? document.documentElement;

  return getComputedStyle(root).getPropertyValue(variableName).trim().length > 0;
}

function hasDocument(): boolean {
  return typeof document !== 'undefined' && Boolean(document.head);
}

function isCssArtifact(value: unknown): value is CipoCssArtifact {
  return isPlainObject(value) && value.kind === 'cipo.css';
}

function isInlineCssArtifact(value: unknown): value is CipoInlineCssArtifact {
  return isPlainObject(value) && value.kind === 'cipo.inline-css';
}

function isInjectGlobalOptions(value: unknown): value is CipoInjectGlobalOptions {
  return isPlainObject(value) && ('important' in value || 'layer' in value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isElement(value: unknown): value is Element {
  return typeof Element !== 'undefined' && value instanceof Element;
}

function isNode(value: unknown): value is Node {
  return typeof Node !== 'undefined' && value instanceof Node;
}

function isPseudoName(name: string): boolean {
  switch (name) {
    case 'hover':
    case 'focus':
    case 'active':
    case 'disabled':
    case 'checked':
    case 'focus-visible':
    case 'focus-within':
    case 'visited':
    case 'first-child':
    case 'last-child':
    case 'before':
    case 'after':
      return true;
    default:
      return false;
  }
}

function isPlainNumber(value: string): boolean {
  return /^-?\d*\.?\d+$/.test(value);
}

function isColorLike(value: string): boolean {
  return value.startsWith('$')
    || value.startsWith('var(')
    || value.startsWith('#')
    || value.startsWith('rgb')
    || value.startsWith('hsl')
    || value.startsWith('oklch')
    || value.startsWith('oklab')
    || value === 'transparent'
    || value === 'currentColor';
}

/* ============================================================================
 * Public Callable Instance
 * ========================================================================== */

export const cipo = createCipoCallable();

/* ============================================================================
 * Browser Global Install
 * ========================================================================== */

if (typeof window !== 'undefined') {
  window.Cipo = createBrowserGlobal();
  window.RodK = window.Cipo;
}
