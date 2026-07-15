/**
 * @packageDocumentation
 * Nascente category module. Public consumers should generally import from the package barrel.
 */

const WORDS = /[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+/g;

/***************************************************************************************************
 * String utilities
 **************************************************************************************************/

/**
 * Splits an identifier-like string into word tokens.
 *
 * @remarks
 * **Replaces:** Repeated chained regex replacements followed by split.
 *
 * **Performance:** Runs one precompiled global regular expression and allocates only the match result required by the API.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const words = (s: string) => s.match(WORDS) ?? [];

/**
 * Transforms a string using the `deburr` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const deburr = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Transforms a string using the `capitalize` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const capitalize = (s: string) => s ? upperFirst(s.toLowerCase()) : s;

/**
 * Transforms a string using the `upperFirst` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const upperFirst = (s: string) => s ? s[0]!.toUpperCase() + s.slice(1) : s;

/**
 * Transforms a string using the `lowerFirst` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const lowerFirst = (s: string) => s ? s[0]!.toLowerCase() + s.slice(1) : s;

/**
 * Transforms a string using the `camelCase` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const camelCase = (s: string) => { const w = words(deburr(s)); return w.map((x, i) => i ? capitalize(x) : x.toLowerCase()).join(''); };

/**
 * Transforms a string using the `pascalCase` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const pascalCase = (s: string) => words(deburr(s)).map(capitalize).join('');

/**
 * Transforms a string using the `kebabCase` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const kebabCase = (s: string) => words(deburr(s)).map(x => x.toLowerCase()).join('-');

/**
 * Transforms a string using the `snakeCase` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const snakeCase = (s: string) => words(deburr(s)).map(x => x.toLowerCase()).join('_');

/**
 * Transforms a string using the `constantCase` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const constantCase = (s: string) => snakeCase(s).toUpperCase();

/**
 * Transforms a string using the `startCase` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const startCase = (s: string) => words(deburr(s)).map(capitalize).join(' ');

/**
 * Transforms a string using the `lowerCase` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const lowerCase = (s: string) => words(deburr(s)).join(' ').toLowerCase();

/**
 * Transforms a string using the `upperCase` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const upperCase = (s: string) => words(deburr(s)).join(' ').toUpperCase();

/**
 * Transforms a string using the `reverseString` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const reverseString = (s: string) => Array.from(s).reverse().join('');

/**
 * Transforms a string using the `pad` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const pad = (s: string, n: number, c = ' ') => (c.repeat(Math.max(0, Math.floor((n - s.length) / 2))) + s + c.repeat(Math.max(0, Math.ceil((n - s.length) / 2)))).slice(0, n);

/**
 * Transforms a string using the `trim` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const trim = (s: string, c?: string) => c ? trimEnd(trimStart(s, c), c) : s.trim();

/**
 * Transforms a string using the `trimStart` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const trimStart = (s: string, c?: string) => c ? s.replace(new RegExp('^' + escapeRegExp(c) + '+'), '') : s.trimStart();

/**
 * Transforms a string using the `trimEnd` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const trimEnd = (s: string, c?: string) => c ? s.replace(new RegExp(escapeRegExp(c) + '+$'), '') : s.trimEnd();

/**
 * Transforms a string using the `escapeRegExp` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const HTML: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const HTML_REVERSE: Readonly<Record<string, string>> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

/**
 * Transforms a string using the `escape` convention.
 *
 * @remarks
 * **Replaces:** Repeated hand-written string/regex pipelines.
 *
 * **Performance:** Centralizes the transformation and reuses precompiled helpers where possible. String performance is input-dependent because normalization and regular expressions can dominate runtime.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const escape = (s: string) => s.replace(/[&<>"']/g, c => HTML[c]!);

/**
 * Decodes the HTML entities emitted by `escape`.
 *
 * @remarks
 * **Replaces:** `Object.entries(entities).find(...)` for every match.
 *
 * **Performance:** Should use direct entity lookup so each replacement is expected O(1), avoiding repeated entry-array allocation and linear scans.
 *
 * Nascente favors predictable control flow for hot paths, with special attention to allocation pressure on Safari/WebKit and mobile devices. Native engine optimizations evolve, so this is a performance-oriented implementation, not a universal guarantee of being faster for every input.
 */
export const unescape = (s: string) => s.replace(/&(amp|lt|gt|quot|#39);/g, entity => HTML_REVERSE[entity] ?? entity);
