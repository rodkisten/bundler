import { runtime } from "./runtime";
import type {
  CipoCssArtifact,
  CipoCssInterpolation,
  CipoCssResult,
  CipoStyleObject,
  CipoStylesheetArtifact,
  CipoWarning,
} from "./types";
import { buildCss, transformCss } from "./transform";
import { normalizeTemplateChunk } from "./safe-template";
import { parseStylesheet } from "./parser";
import {
  compileAtomicCss,
  compileSheetCss,
  compileScopedSheetCss,
  wrapSheetLayer,
  createArtifactCacheKey,
  createAtomicArtifact,
  createStylesheetArtifact,
  getCachedArtifact,
  setCachedArtifact,
  shouldCompileAsStylesheet,
  injectSheetInto,
} from "./compiler";
import { insertCss } from "./injection";
import { configureFromCss } from "./config-css";
import { inline } from "./inline";
import { splitPolymorphicCssSource, type PolymorphicCssSource } from "./css-mode";

/***************************************************************************************************
 * Public Types
 **************************************************************************************************/

type PolymorphicTemplateCacheEntry = {
  readonly values: readonly CipoCssInterpolation[];
  readonly rawCss: string;
  readonly source: PolymorphicCssSource;
};

let polymorphicTemplateCache = new WeakMap<TemplateStringsArray, PolymorphicTemplateCacheEntry>();

/** Clears template-identity mode detection cache. Intended for tests/benchmarks. */
export function clearPolymorphicTemplateCache(): void {
  polymorphicTemplateCache = new WeakMap();
}

/***************************************************************************************************
 * Public API
 **************************************************************************************************/

/**
 * Main polymorphic CSS tagged template.
 *
 * @remarks
 * This function keeps the old `css`` ` API intact while adding a stylesheet
 * mode.
 *
 * The detection is intentionally conservative:
 *
 * - If the template has top-level declarations, standalone aliases, or
 *   component-scoped selectors, Cipó keeps the old atomic/component behavior.
 * - If the template is made only of full top-level selectors or stylesheet
 *   at-rules, Cipó returns a stylesheet artifact whose string value is the
 *   transformed stylesheet text.
 *
 * This means nested selectors still work in component mode:
 *
 * ```ts
 * const card = css`
 *   px: 4;
 *
 *   .title {
 *     color: $brand;
 *   }
 * `
 * ```
 *
 * And full stylesheets work when the root is a stylesheet:
 *
 * ```ts
 * const sheet = css`
 *   .title {
 *     color: $brand;
 *   }
 * `
 * ```
 *
 * @param strings - Template strings.
 * @param values - Template interpolations.
 * @returns Either an atomic CSS artifact or a stylesheet artifact.
 *
 * @example Atomic/component mode
 * ```ts
 * const card = css`
 *   glass;
 *   px: 4;
 *   py: 3;
 *   bg: $panel;
 *   rounded: $xl;
 *
 *   x:hover {
 *     bg: alpha($brand / 18%);
 *   }
 * `
 *
 * String(card)
 * // "cipo-s-abc cipo-a-def cipo-a-ghi ..."
 * ```
 *
 * @example Stylesheet mode
 * ```ts
 * const sheet = css`
 *   .card {
 *     px: 4;
 *     bg: $panel;
 *
 *     &:hover {
 *       bg: alpha($brand / 18%);
 *     }
 *   }
 * `
 *
 * String(sheet)
 * // ".card { padding-inline: ... } .card:hover { background: ... }"
 * ```
 *
 * @example Explicit global stylesheet
 * ```ts
 * const sheet = css`
 *   :root {
 *     --app-radius: 16px;
 *   }
 *
 *   body {
 *     margin: 0;
 *   }
 * `
 *
 * String(sheet)
 * // ":root { --app-radius: 1rem; } body { margin: 0; }"
 * ```
 */
export function css(
  first: TemplateStringsArray | CipoStyleObject,
  ...values: readonly CipoCssInterpolation[]
): CipoCssResult {
  return compilePolymorphicCss(first, values, false);
}

Object.assign(css, {
  configure(
    strings: TemplateStringsArray,
    ...values: readonly CipoCssInterpolation[]
  ) {
    return configureFromCss(buildCss(strings, values));
  },
  withImportant(
    first: TemplateStringsArray | CipoStyleObject,
    ...values: readonly CipoCssInterpolation[]
  ): CipoCssResult {
    return compilePolymorphicCss(first, values, true);
  },
});

/**
 * Explicit atomic CSS namespace.
 *
 * @remarks
 * `atomic.css``...`` ` always returns a class-list artifact and injects generated
 * atomic rules. It skips stylesheet detection for maximum runtime predictability.
 *
 * @example
 * ```ts
 * const card = atomic.css`
 *   px: 4
 *   bg: $brand
 * `
 * String(card)
 * // "cipo-a-..."
 * ```
 */
export const atomic = {
  css: Object.assign(
    function atomicCss(
      strings: TemplateStringsArray,
      ...values: readonly CipoCssInterpolation[]
    ): CipoCssArtifact {
      return compileAtomicCss(strings, values, false);
    },
    {
      withImportant(
        strings: TemplateStringsArray,
        ...values: readonly CipoCssInterpolation[]
      ): CipoCssArtifact {
        return compileAtomicCss(strings, values, true);
      },
    },
  ),
};

/**
 * Explicit stylesheet namespace.
 *
 * @remarks
 * `sheet.css``...`` ` compiles a complete stylesheet and returns CSS text. It
 * preserves selectors, supports nesting, expands aliases/helpers/tokens and does
 * not atomize declarations.
 *
 * @example
 * ```ts
 * const styleText = sheet.css`
 *   :root { $$panel: rgb(0 0 0 / .8) }
 *   .card { $glassCard; x:hover { bg: alpha($brand / 20%) } }
 * `
 * String(styleText)
 * // complete transformed CSS
 * ```
 */
export const sheet = {
  css: Object.assign(
    function sheetCss(
      strings: TemplateStringsArray,
      ...values: readonly CipoCssInterpolation[]
    ): CipoStylesheetArtifact {
      return compileSheetCss(strings, values, false);
    },
    {
      withImportant(
        strings: TemplateStringsArray,
        ...values: readonly CipoCssInterpolation[]
      ): CipoStylesheetArtifact {
        return compileSheetCss(strings, values, true);
      },
      insertInto(target: HTMLElement | ShadowRoot | Document) {
        return Object.assign(
          function sheetCssInto(
            strings: TemplateStringsArray,
            ...values: readonly CipoCssInterpolation[]
          ): CipoStylesheetArtifact {
            const artifact = compileSheetCss(strings, values, false);
            injectSheetInto(target, artifact.cssText);
            return artifact;
          },
          {
            withImportant(
              strings: TemplateStringsArray,
              ...values: readonly CipoCssInterpolation[]
            ): CipoStylesheetArtifact {
              const artifact = compileSheetCss(strings, values, true);
              injectSheetInto(target, artifact.cssText);
              return artifact;
            },
          },
        );
      },
      scoped(selector: string) {
        return Object.assign(
          function scopedSheetCss(
            strings: TemplateStringsArray,
            ...values: readonly CipoCssInterpolation[]
          ): CipoStylesheetArtifact {
            return compileScopedSheetCss(selector, strings, values, false);
          },
          {
            withImportant(
              strings: TemplateStringsArray,
              ...values: readonly CipoCssInterpolation[]
            ): CipoStylesheetArtifact {
              return compileScopedSheetCss(selector, strings, values, true);
            },
          },
        );
      },
      layer(name: string) {
        return Object.assign(
          function layerSheetCss(
            strings: TemplateStringsArray,
            ...values: readonly CipoCssInterpolation[]
          ): CipoStylesheetArtifact {
            return wrapSheetLayer(
              name,
              compileSheetCss(strings, values, false),
            );
          },
          {
            withImportant(
              strings: TemplateStringsArray,
              ...values: readonly CipoCssInterpolation[]
            ): CipoStylesheetArtifact {
              return wrapSheetLayer(
                name,
                compileSheetCss(strings, values, true),
              );
            },
          },
        );
      },
      debug(
        strings: TemplateStringsArray,
        ...values: readonly CipoCssInterpolation[]
      ): CipoStylesheetArtifact {
        const artifact = compileSheetCss(strings, values, false);
        if (runtime.config.debug && typeof console !== "undefined")
          console.debug("[Cipo sheet]", artifact.debug);
        return artifact;
      },
    },
  ),
};

/**
 * Compiles the legacy polymorphic css`` API.
 *
 * @param strings - Template strings.
 * @param values - Template values.
 * @param important - Whether to force a single !important on every declaration.
 * @returns CSS result.
 */
function compilePolymorphicCss(
  first: TemplateStringsArray | CipoStyleObject,
  values: readonly CipoCssInterpolation[],
  important: boolean,
): CipoCssResult {
  if (!Array.isArray(first))
    return important
      ? inline.css.withImportant(first, ...values)
      : inline.css(first, ...values);

  const { rawCss, source: polymorphic } = getPolymorphicTemplateSource(
    first as TemplateStringsArray,
    values,
  );

  if (polymorphic.inline)
    return important
      ? inline.css.withImportant([
          polymorphic.css,
        ] as unknown as TemplateStringsArray)
      : inline.css([polymorphic.css] as unknown as TemplateStringsArray);

  if (polymorphic.configCss) {
    const result = configureFromCss(polymorphic.configCss);
    if (!polymorphic.css.trim()) return result;
  }

  const cacheKey = createArtifactCacheKey(
    polymorphic.css,
    important ? "important" : "auto",
  );
  const cacheable = runtime.config.atomic.minUses <= 1;
  const cached = cacheable ? getCachedArtifact(cacheKey) : undefined;

  if (cached) return cached;

  const warnings: CipoWarning[] = [];
  const transformedCss = transformCss(polymorphic.css, warnings);
  const ast = parseStylesheet(transformedCss, warnings);

  if (shouldCompileAsStylesheet(polymorphic.css, transformedCss, ast)) {
    const artifact = createStylesheetArtifact(
      polymorphic.css,
      transformedCss,
      ast,
      warnings,
      important,
    );
    setCachedArtifact(cacheKey, artifact);
    return artifact;
  }

  const artifact = createAtomicArtifact(
    polymorphic.css,
    transformedCss,
    ast,
    warnings,
    important,
  );
  insertCss(artifact.compiledCss);
  if (cacheable) setCachedArtifact(cacheKey, artifact);
  return artifact;
}

function getPolymorphicTemplateSource(
  strings: TemplateStringsArray,
  values: readonly CipoCssInterpolation[],
): { readonly rawCss: string; readonly source: PolymorphicCssSource } {
  const cached = polymorphicTemplateCache.get(strings);

  if (cached && canReuseInterpolationValues(cached.values, values)) {
    return cached;
  }

  const rawCss = normalizeTemplateChunk(buildCss(strings, values));
  const source = splitPolymorphicCssSource(rawCss);
  const entry: PolymorphicTemplateCacheEntry = {
    values: values.length === 0 ? EMPTY_INTERPOLATIONS : values.slice(),
    rawCss,
    source,
  };
  polymorphicTemplateCache.set(strings, entry);
  return entry;
}

const EMPTY_INTERPOLATIONS: readonly CipoCssInterpolation[] = Object.freeze([]);

function canReuseInterpolationValues(
  previous: readonly CipoCssInterpolation[],
  next: readonly CipoCssInterpolation[],
): boolean {
  if (previous.length !== next.length) return false;
  for (let index = 0; index < previous.length; index += 1) {
    const value = next[index];
    if ((typeof value === "object" && value !== null) || !Object.is(previous[index], value)) {
      return false;
    }
  }
  return true;
}

/**
 * Checks whether a css`` result is an atomic/class-list artifact.
 *
 * @param artifact - Polymorphic css result.
 * @returns Whether the artifact can be used as a class list.
 *
 * @example
 * ```ts
 * const result = css`px: 4;`
 * if (isAtomicCssArtifact(result)) {
 *   result.className
 * }
 * ```
 */
export function isAtomicCssArtifact(
  artifact: CipoCssResult,
): artifact is CipoCssArtifact {
  return Boolean(
    artifact && "kind" in artifact && artifact.kind === "cipo.css",
  );
}

/**
 * Asserts that a polymorphic css`` result is safe for styled/component APIs.
 *
 * @remarks
 * Styled APIs require a class-list artifact. Passing a full stylesheet such as
 * `.card { ... }` would not produce a className, so this function throws a clear
 * runtime error instead of failing with `undefined` later.
 *
 * @param artifact - Polymorphic css result.
 * @returns Atomic CSS artifact.
 */
export function assertAtomicCssArtifact(
  artifact: CipoCssResult,
): CipoCssArtifact {
  if (isAtomicCssArtifact(artifact)) return artifact;

  throw new TypeError(
    "Cipó styled APIs require declaration/component CSS. Full stylesheets return CSS text and cannot be used as className artifacts.",
  );
}

/**
 * Checks whether a css`` result is a stylesheet artifact.
 *
 * @param artifact - Polymorphic css result.
 * @returns Whether the artifact stringifies to stylesheet text.
 */
export function isStylesheetArtifact(
  artifact: CipoCssResult,
): artifact is CipoStylesheetArtifact {
  return Boolean(
    artifact && "kind" in artifact && artifact.kind === "cipo.stylesheet",
  );
}
