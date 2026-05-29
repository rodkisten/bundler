/*
 * ============================================================================
 * Cipó Runtime Usage Examples
 * ============================================================================
 *
 * 1. Basic atomic CSS
 *
 * const button = css`
 *   color: white;
 *   background: #111827;
 *   padding: 12px 16px;
 *   border-radius: 12px;
 * `;
 *
 * html`
 *   <button class="${button}">
 *     Save
 *   </button>
 * `;
 *
 * ----------------------------------------------------------------------------
 *
 * 2. Configure runtime
 *
 * configure({
 *   prefix: "rod",
 *   debug: false,
 *   breakpoints: {
 *     base: null,
 *     sm: "(min-width: 640px)",
 *     md: "(min-width: 768px)",
 *     lg: "(min-width: 1024px)",
 *   },
 * });
 *
 * ----------------------------------------------------------------------------
 *
 * 3. Theme tokens
 *
 * theme({
 *   colors: {
 *     brand: "#22c55e",
 *     ink: "#0f172a",
 *   },
 *   space: {
 *     md: "16px",
 *   },
 * });
 *
 * const title = css`
 *   color: $theme.colors.brand;
 *   margin-bottom: $theme.space.md;
 * `;
 *
 * ----------------------------------------------------------------------------
 *
 * 4. Utility directive
 *
 * const card = css`
 *   @with(
 *     bg(#111827),
 *     color(white),
 *     px(16px),
 *     py(12px),
 *     rounded(18px)
 *   );
 * `;
 *
 * ----------------------------------------------------------------------------
 *
 * 5. Spacing helper
 *
 * const stack = css`
 *   gap: x:spacing(4);
 *   padding: x:spacing(6);
 * `;
 *
 * ----------------------------------------------------------------------------
 *
 * 6. Alpha helper
 *
 * const glass = css`
 *   background: x:alpha($theme.colors.brand / 18%);
 * `;
 *
 * ----------------------------------------------------------------------------
 *
 * 7. Responsive rules
 *
 * const panel = css`
 *   width: 100%;
 *
 *   x:md {
 *     width: 720px;
 *   }
 *
 *   x:lg {
 *     width: 960px;
 *   }
 * `;
 *
 * ----------------------------------------------------------------------------
 *
 * 8. Inverted responsive rules
 *
 * const mobileOnly = css`
 *   display: block;
 *
 *   x:not(md) {
 *     font-size: 14px;
 *   }
 * `;
 *
 * ----------------------------------------------------------------------------
 *
 * 9. Scoped child selector
 *
 * const list = css`
 *   padding: 0;
 *
 *   li {
 *     list-style: none;
 *     padding: 8px;
 *   }
 * `;
 *
 * ----------------------------------------------------------------------------
 *
 * 10. Scoped self selector with &
 *
 * const link = css`
 *   color: #38bdf8;
 *
 *   &:hover {
 *     color: #7dd3fc;
 *   }
 *
 *   &[aria-current="page"] {
 *     font-weight: 700;
 *   }
 * `;
 *
 * ----------------------------------------------------------------------------
 *
 * 11. Style object interpolation
 *
 * const box = css`
 *   ${{
 *     display: "grid",
 *     placeItems: "center",
 *     minHeight: "100dvh",
 *   }}
 * `;
 *
 * ----------------------------------------------------------------------------
 *
 * 12. Compose artifacts
 *
 * const base = css`
 *   border-radius: 12px;
 * `;
 *
 * const danger = css`
 *   ${base}
 *   background: #ef4444;
 *   color: white;
 * `;
 *
 * ----------------------------------------------------------------------------
 *
 * 13. HTML arrays
 *
 * const items = ["Home", "Settings", "Profile"];
 *
 * html`
 *   <nav>
 *     ${items.map(item => html`
 *       <a>${item}</a>
 *     `)}
 *   </nav>
 * `;
 *
 * ----------------------------------------------------------------------------
 *
 * 14. Read generated CSS
 *
 * const generated = getCssText();
 * console.log(generated);
 *
 * ----------------------------------------------------------------------------
 *
 * 15. Reset runtime
 *
 * reset();
 *
 * ----------------------------------------------------------------------------
 *
 * 16. Browser global install
 *
 * installBrowserGlobal("RodK");
 *
 * window.RodK.css`
 *   color: red;
 * `;
 *
 * ============================================================================
 */

const STYLE_ID = "cipo-runtime-style";
const HASH_SEED = 5381;
const HASH_MASK = 0xffffffff;
const DEFAULT_PREFIX = "cipo";

type Primitive = string | number | boolean | null | undefined;
type CssValue = Primitive | CssArtifact | StyleObject;
type CssTemplateValues = readonly CssValue[];
type Breakpoints = Readonly<Record<string, string | null>>;

interface StyleObject {
  readonly [property: string]: string | number | StyleObject | null | undefined;
}

interface RuntimeConfig {
  readonly prefix?: string;
  readonly debug?: boolean;
  readonly breakpoints?: Breakpoints;
}

interface RuntimeState {
  config: {
    prefix: string;
    debug: boolean;
    breakpoints: Breakpoints;
  };
  insertedCss: Set<string>;
  atomicCache: Map<string, AtomicRule>;
  sheet: CSSStyleSheet | null;
}

interface AtomicRule {
  readonly property: string;
  readonly value: string;
  readonly className: string;
  readonly breakpoint?: string;
  readonly notBreakpoint?: string;
}

interface ScopedRule {
  readonly selector: string;
  readonly cssText: string;
}

interface CssArtifact {
  readonly kind: "cipo.css";
  readonly className: string;
  readonly scopeClassName: string;
  readonly atoms: readonly AtomicRule[];
  readonly scopedRules: readonly ScopedRule[];
  readonly rawCss: string;
  readonly compiledCss: string;
  toString(): string;
  [Symbol.toPrimitive](): string;
  readonly [Symbol.toStringTag]: string;
}

interface ThemeDefinition {
  readonly [key: string]: string | number | ThemeDefinition;
}

interface ParsedDeclaration {
  readonly property: string;
  readonly value: string;
}

interface ParsedNestedRule {
  readonly type: "media" | "not-media" | "selector";
  readonly value: string;
  readonly declarations: readonly ParsedDeclaration[];
}

interface ParsedRule {
  readonly declarations: readonly ParsedDeclaration[];
  readonly nested: readonly ParsedNestedRule[];
}

const runtime: RuntimeState = {
  config: {
    prefix: DEFAULT_PREFIX,
    debug: true,
    breakpoints: {
      base: null,
      sm: null,
      md: "(min-width: 768px)",
      lg: "(min-width: 1024px)",
      xl: "(min-width: 1280px)",
    },
  },
  insertedCss: new Set<string>(),
  atomicCache: new Map<string, AtomicRule>(),
  sheet: null,
};

export function configure(config: RuntimeConfig): void {
  runtime.config = {
    prefix: config.prefix ?? runtime.config.prefix,
    debug: config.debug ?? runtime.config.debug,
    breakpoints: {
      ...runtime.config.breakpoints,
      ...(config.breakpoints ?? {}),
    },
  };
}

export function theme(tokens: ThemeDefinition): void {
  const pairs = flattenTheme(tokens);
  let declarations = "";

  for (let index = 0; index < pairs.length; index += 1) {
    const [name, value] = pairs[index];
    declarations += `--${runtime.config.prefix}-${name}:${String(value)};`;
  }

  insertCss(`:root{${declarations}}`);
}

export function css(
  strings: TemplateStringsArray,
  ...values: CssTemplateValues
): CssArtifact {
  const rawCss = buildCss(strings, values);
  const expandedCss = transformCss(rawCss);
  const parsed = parseCss(expandedCss);
  const scopeClassName = `${runtime.config.prefix}-s-${hashString(expandedCss)}`;

  const atoms: AtomicRule[] = [];
  const scopedRules: ScopedRule[] = [];

  for (const rule of parsed) {
    for (const declaration of rule.declarations) {
      atoms.push(createAtomicRule(declaration));
    }

    for (const nested of rule.nested) {
      if (nested.type === "selector") {
        scopedRules.push({
          selector: resolveScopedSelector(scopeClassName, nested.value),
          cssText: declarationsToCssText(nested.declarations),
        });

        continue;
      }

      for (const declaration of nested.declarations) {
        atoms.push(
          createAtomicRule(declaration, {
            breakpoint: nested.type === "media" ? nested.value : undefined,
            notBreakpoint: nested.type === "not-media" ? nested.value : undefined,
          }),
        );
      }
    }
  }

  const className = joinClassNames(atoms, scopedRules.length > 0 ? scopeClassName : "");
  const compiledCss = buildCompiledCss(atoms, scopedRules);

  insertCss(compiledCss);

  return {
    kind: "cipo.css",
    className,
    scopeClassName,
    atoms,
    scopedRules,
    rawCss,
    compiledCss,
    toString: () => className,
    [Symbol.toPrimitive]: () => className,
    [Symbol.toStringTag]: "CipoCssArtifact",
  };
}

export function html(
  strings: TemplateStringsArray,
  ...values: readonly unknown[]
): string {
  let output = "";

  for (let index = 0; index < strings.length; index += 1) {
    output += strings[index];

    if (index >= values.length) {
      continue;
    }

    const value = values[index];
    output += Array.isArray(value) ? value.join("") : String(value ?? "");
  }

  return output;
}

export function getCssText(): string {
  if (!hasDocument()) {
    return "";
  }

  const style = document.getElementById(STYLE_ID);

  if (!(style instanceof HTMLStyleElement)) {
    return "";
  }

  return style.textContent ?? "";
}

export function reset(): void {
  runtime.insertedCss.clear();
  runtime.atomicCache.clear();
  runtime.sheet = null;

  if (hasDocument()) {
    document.getElementById(STYLE_ID)?.remove();
  }
}

function buildCss(strings: TemplateStringsArray, values: CssTemplateValues): string {
  let output = "";

  for (let index = 0; index < strings.length; index += 1) {
    output += strings[index];

    if (index >= values.length) {
      continue;
    }

    const value = values[index];

    if (isCssArtifact(value)) {
      output += value.rawCss;
    } else if (isPlainObject(value)) {
      output += styleObjectToCss(value);
    } else {
      output += String(value ?? "");
    }
  }

  return output;
}

function transformCss(input: string): string {
  return replaceWithDirectives(
    replaceAlphaFunctions(replaceSpacingFunctions(replaceThemeTokens(input))),
  );
}

function replaceThemeTokens(input: string): string {
  return input.replace(/\$theme\.([a-zA-Z0-9._-]+)/g, (_match, tokenPath: string) => {
    return `var(--${runtime.config.prefix}-${tokenPath.replaceAll(".", "-")})`;
  });
}

function replaceSpacingFunctions(input: string): string {
  return input.replace(/x:spacing\((.*?)\)/g, (_match, value: string) => {
    return `calc(var(--spacing) * ${value.trim()})`;
  });
}

function replaceAlphaFunctions(input: string): string {
  return input.replace(/x:alpha\((.*?)\s*\/\s*(.*?)\)/g, (_match, color: string, alpha: string) => {
    return `color-mix(in oklab, ${color.trim()} ${alpha.trim()}, transparent)`;
  });
}

function replaceWithDirectives(input: string): string {
  return input.replace(/@with\(([\s\S]*?)\);?/g, (_match, content: string) => {
    return expandUtilities(content);
  });
}

function expandUtilities(input: string): string {
  const utilities = splitTopLevel(input, ",");
  let output = "";

  for (const utility of utilities) {
    const normalized = utility.trim();

    if (!normalized) {
      continue;
    }

    const value = extractFunctionArguments(normalized);

    if (normalized.startsWith("bg(")) output += `background:${value};`;
    else if (normalized.startsWith("color(")) output += `color:${value};`;
    else if (normalized.startsWith("py(")) output += `padding-block:${value};`;
    else if (normalized.startsWith("px(")) output += `padding-inline:${value};`;
    else if (normalized.startsWith("rounded(")) output += `border-radius:${value};`;
    else if (normalized === "hidden") output += "display:none;";
  }

  return output;
}

function parseCss(input: string): readonly ParsedRule[] {
  const declarations: ParsedDeclaration[] = [];
  const nested: ParsedNestedRule[] = [];

  for (const block of parseBlocks(input)) {
    if (block.type === "declaration") {
      declarations.push(block.value);
      continue;
    }

    nested.push({
      type: block.type,
      value: block.name,
      declarations: parseDeclarations(block.body),
    });
  }

  return [{ declarations, nested }];
}

function parseBlocks(input: string): Array<
  | { readonly type: "declaration"; readonly value: ParsedDeclaration }
  | { readonly type: "media" | "not-media" | "selector"; readonly name: string; readonly body: string }
> {
  const output: Array<
    | { readonly type: "declaration"; readonly value: ParsedDeclaration }
    | { readonly type: "media" | "not-media" | "selector"; readonly name: string; readonly body: string }
  > = [];

  let buffer = "";
  let index = 0;

  while (index < input.length) {
    const char = input[index];

    if (char !== "{") {
      buffer += char;
      index += 1;
      continue;
    }

    const name = buffer.trim();
    buffer = "";

    const endIndex = findMatchingBrace(input, index);

    if (endIndex < 0) {
      buffer += input.slice(index);
      break;
    }

    const body = input.slice(index + 1, endIndex);

    if (name.startsWith("x:not(")) {
      output.push({
        type: "not-media",
        name: name.replace(/^x:not\(/, "").replace(/\)$/, "").trim(),
        body,
      });
    } else if (name.startsWith("x:")) {
      output.push({
        type: "media",
        name: name.slice(2).trim(),
        body,
      });
    } else {
      output.push({
        type: "selector",
        name,
        body,
      });
    }

    index = endIndex + 1;
  }

  for (const declaration of parseDeclarations(buffer)) {
    output.push({ type: "declaration", value: declaration });
  }

  return output;
}

function parseDeclarations(input: string): ParsedDeclaration[] {
  const items = splitTopLevel(input, ";");
  const output: ParsedDeclaration[] = [];

  for (const item of items) {
    const normalized = item.trim();

    if (!normalized) {
      continue;
    }

    const colonIndex = findTopLevelColon(normalized);

    if (colonIndex <= 0) {
      continue;
    }

    const property = normalized.slice(0, colonIndex).trim();
    const value = normalized.slice(colonIndex + 1).trim();

    if (property && value) {
      output.push({ property, value });
    }
  }

  return output;
}

function createAtomicRule(
  declaration: ParsedDeclaration,
  options: {
    readonly breakpoint?: string;
    readonly notBreakpoint?: string;
  } = {},
): AtomicRule {
  const normalizedProperty = normalizeCss(declaration.property);
  const normalizedValue = normalizeCss(declaration.value);
  const cacheKey = `${normalizedProperty}|${normalizedValue}|${options.breakpoint ?? ""}|${options.notBreakpoint ?? ""}`;
  const cached = runtime.atomicCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const rule: AtomicRule = {
    property: declaration.property,
    value: declaration.value,
    className: `${runtime.config.prefix}-a-${hashString(cacheKey)}`,
    breakpoint: options.breakpoint,
    notBreakpoint: options.notBreakpoint,
  };

  runtime.atomicCache.set(cacheKey, rule);
  return rule;
}

function buildCompiledCss(atoms: readonly AtomicRule[], scopedRules: readonly ScopedRule[]): string {
  let output = "";

  for (const atom of atoms) {
    const rule = `.${atom.className}{${atom.property}:${atom.value};}`;
    const wrapped = wrapRule(atom, rule);

    output += wrapped;
    output += "\n";
  }

  for (const scopedRule of scopedRules) {
    output += `${scopedRule.selector}{${scopedRule.cssText}}\n`;
  }

  return output.trim();
}

function wrapRule(atom: AtomicRule, rule: string): string {
  if (atom.notBreakpoint) {
    const mediaQuery = runtime.config.breakpoints[atom.notBreakpoint];
    return mediaQuery ? `@media not all and ${mediaQuery}{${rule}}` : rule;
  }

  if (atom.breakpoint) {
    const mediaQuery = runtime.config.breakpoints[atom.breakpoint];
    return mediaQuery ? `@media ${mediaQuery}{${rule}}` : rule;
  }

  return rule;
}

function insertCss(cssText: string): void {
  const normalized = normalizeCss(cssText);

  if (!normalized || runtime.insertedCss.has(normalized) || !hasDocument()) {
    return;
  }

  runtime.insertedCss.add(normalized);

  const style = ensureStyleElement();
  style.appendChild(document.createTextNode(`\n${cssText}\n`));
}

function ensureStyleElement(): HTMLStyleElement {
  const existing = document.getElementById(STYLE_ID);

  if (existing instanceof HTMLStyleElement) {
    return existing;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.dataset.cipo = "runtime";
  document.head.appendChild(style);

  return style;
}

function flattenTheme(tokens: ThemeDefinition, path: readonly string[] = []): Array<readonly [string, string | number]> {
  const output: Array<readonly [string, string | number]> = [];

  for (const [key, value] of Object.entries(tokens)) {
    const nextPath = [...path, key];

    if (isPlainObject(value)) {
      output.push(...flattenTheme(value as ThemeDefinition, nextPath));
      continue;
    }

    output.push([nextPath.join("-"), value]);
  }

  return output;
}

function styleObjectToCss(styleObject: StyleObject): string {
  let output = "";

  for (const [key, value] of Object.entries(styleObject)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (isPlainObject(value)) {
      output += `${key}{${styleObjectToCss(value as StyleObject)}}`;
      continue;
    }

    output += `${toKebabCase(key)}:${String(value)};`;
  }

  return output;
}

function declarationsToCssText(declarations: readonly ParsedDeclaration[]): string {
  let output = "";

  for (const declaration of declarations) {
    output += `${declaration.property}:${declaration.value};`;
  }

  return output;
}

function resolveScopedSelector(scopeClassName: string, selector: string): string {
  const normalized = selector.trim();

  if (!normalized) {
    return `.${scopeClassName}`;
  }

  if (normalized.includes("&")) {
    return normalized.replaceAll("&", `.${scopeClassName}`);
  }

  return `.${scopeClassName} ${normalized}`;
}

function joinClassNames(atoms: readonly AtomicRule[], scopeClassName: string): string {
  const seen = new Set<string>();
  let output = "";

  if (scopeClassName) {
    seen.add(scopeClassName);
    output += scopeClassName;
  }

  for (const atom of atoms) {
    if (seen.has(atom.className)) {
      continue;
    }

    seen.add(atom.className);
    output += output ? ` ${atom.className}` : atom.className;
  }

  return output;
}

function extractFunctionArguments(input: string): string {
  const start = input.indexOf("(");
  const end = input.lastIndexOf(")");

  if (start < 0 || end <= start) {
    return "";
  }

  return input.slice(start + 1, end).trim();
}

function splitTopLevel(input: string, separator: string): string[] {
  const output: string[] = [];
  let buffer = "";
  let depth = 0;
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (quote) {
      buffer += char;

      if (char === quote && input[index - 1] !== "\\") {
        quote = null;
      }

      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      buffer += char;
      continue;
    }

    if (char === "(" || char === "[") depth += 1;
    else if (char === ")" || char === "]") depth -= 1;

    if (char === separator && depth === 0) {
      output.push(buffer.trim());
      buffer = "";
      continue;
    }

    buffer += char;
  }

  if (buffer.trim()) {
    output.push(buffer.trim());
  }

  return output;
}

function findMatchingBrace(input: string, startIndex: number): number {
  let depth = 0;

  for (let index = startIndex; index < input.length; index += 1) {
    const char = input[index];

    if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;

    if (depth === 0) {
      return index;
    }
  }

  return -1;
}

function findTopLevelColon(input: string): number {
  let depth = 0;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (char === "(" || char === "[") depth += 1;
    else if (char === ")" || char === "]") depth -= 1;
    else if (char === ":" && depth === 0) return index;
  }

  return -1;
}

function normalizeCss(input: string): string {
  return input.replace(/\s+/g, " ").replace(/\s*([{}:;,>+~])\s*/g, "$1").trim();
}

function hashString(input: string): string {
  let hash = HASH_SEED;

  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(index)) & HASH_MASK;
  }

  return (hash >>> 0).toString(36);
}

function toKebabCase(input: string): string {
  return input.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
}

function hasDocument(): boolean {
  return typeof document !== "undefined" && Boolean(document.head);
}

function isCssArtifact(value: unknown): value is CssArtifact {
  return isPlainObject(value) && value.kind === "cipo.css";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function installBrowserGlobal(globalName = "RodK"): void {
  const target = globalThis as typeof globalThis & Record<string, unknown>;

  target[globalName] = {
    configure,
    theme,
    html,
    css,
    getCssText,
    reset,
  };
}
