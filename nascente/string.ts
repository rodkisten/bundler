/**
 * @packageDocumentation
 * Nascente category module. Public consumers should generally import from the package barrel.
 */

const WORDS = /[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+/g;

/***************************************************************************************************
 * String utilities
 **************************************************************************************************/


/**
 * Tests case-insensitive containment with an allocation-free ASCII fast path.
 *
 * @remarks
 * **Replaces:** `value.toLowerCase().includes(search.toLowerCase())` in repeated filtering paths.
 *
 * **Performance:** Typical DevTools filters, URLs, HTTP methods, selectors, and identifiers are ASCII. For those
 * inputs this function compares folded UTF-16 code units directly and creates no lowercase copies. If either
 * input contains non-ASCII code units, it falls back to JavaScript's Unicode-aware lowercase behavior so the
 * public semantics remain compatible with the common native pipeline.
 */
export function includesIgnoreCase(value: string, search: string): boolean {
    if (search.length === 0) return true;
    if (search.length > value.length) return false;

    for (let index = 0; index < search.length; index++) {
        if (search.charCodeAt(index) > 0x7f) return value.toLowerCase().includes(search.toLowerCase());
    }
    for (let index = 0; index < value.length; index++) {
        if (value.charCodeAt(index) > 0x7f) return value.toLowerCase().includes(search.toLowerCase());
    }

    const searchLength = search.length;
    const lastStart = value.length - searchLength;
    for (let startIndex = 0; startIndex <= lastStart; startIndex++) {
        let offset = 0;
        for (; offset < searchLength; offset++) {
            let valueCode = value.charCodeAt(startIndex + offset);
            let searchCode = search.charCodeAt(offset);
            if (valueCode >= 65 && valueCode <= 90) valueCode += 32;
            if (searchCode >= 65 && searchCode <= 90) searchCode += 32;
            if (valueCode !== searchCode) break;
        }
        if (offset === searchLength) return true;
    }
    return false;
}

/**
 * Splits on ASCII whitespace without invoking the regular-expression engine.
 *
 * @remarks
 * Intended for HTML class names and other browser tokens whose separators are ASCII space, tab, LF, CR, or
 * form-feed. It replaces `value.trim().split(/\s+/).filter(Boolean)` with one scan and no empty segments.
 */
export function splitAsciiWhitespace(value: string): string[] {
    const result: string[] = [];
    let tokenStart = -1;
    for (let index = 0; index <= value.length; index++) {
        const code = index < value.length ? value.charCodeAt(index) : 32;
        const isWhitespace = code === 32 || code === 9 || code === 10 || code === 13 || code === 12;
        if (!isWhitespace) {
            if (tokenStart < 0) tokenStart = index;
            continue;
        }
        if (tokenStart >= 0) {
            result.push(value.slice(tokenStart, index));
            tokenStart = -1;
        }
    }
    return result;
}

/**
 * Splits once at the first separator occurrence instead of allocating every segment.
 *
 * @remarks
 * **Replaces:** destructuring patterns such as `const [head, ...tail] = value.split(separator)` when only the
 * first boundary matters. The second tuple item contains the untouched remainder and may itself contain the
 * separator.
 */
export function splitOnce(value: string, separator: string): readonly [head: string, tail: string] {
    const separatorIndex = value.indexOf(separator);
    if (separatorIndex < 0) return [value, ""];
    return [value.slice(0, separatorIndex), value.slice(separatorIndex + separator.length)];
}

/**
 * Splits a string and removes empty segments in place.
 *
 * @remarks
 * **Replaces:** `value.split(separator).filter(Boolean)`.
 *
 * **Performance:** Reuses the array allocated by the native split operation and compacts it with read/write
 * indexes instead of allocating a second filtered array or invoking a predicate callback for every segment.
 */
export function splitNonEmpty(value: string, separator: string | RegExp): string[] {
    const parts = value.split(separator);
    let writeIndex = 0;
    for (let readIndex = 0; readIndex < parts.length; readIndex++) {
        const part = parts[readIndex]!;
        if (part) parts[writeIndex++] = part;
    }
    parts.length = writeIndex;
    return parts;
}

/**
 * Splits, trims, and removes empty segments by compacting the native split result in place.
 *
 * @remarks
 * **Replaces:** `value.split(separator).map(part => part.trim()).filter(Boolean)`. Only the array created by
 * `String.prototype.split` is retained; trimmed segments overwrite their original slots and the tail is truncated.
 */
export function splitTrimmedNonEmpty(value: string, separator: string | RegExp): string[] {
    const parts = value.split(separator);
    let writeIndex = 0;
    for (let readIndex = 0; readIndex < parts.length; readIndex++) {
        const trimmedPart = parts[readIndex]!.trim();
        if (trimmedPart) parts[writeIndex++] = trimmedPart;
    }
    parts.length = writeIndex;
    return parts;
}

/**
 * Splits text into lines without running a regular expression.
 *
 * @remarks
 * **Replaces:** `value.split(/\\r?\\n/)` in hot parsing and formatting paths.
 *
 * **Performance:** Performs one character scan, recognizes both LF and CRLF, and allocates only the returned
 * line strings. This avoids regular-expression execution overhead that can be noticeable for large source bodies
 * in mobile Safari/WebKit.
 */
export function splitLines(value: string): string[] {
    const lines: string[] = [];
    let lineStart = 0;
    for (let index = 0; index < value.length; index++) {
        if (value.charCodeAt(index) !== 10) continue;
        const lineEnd = index > lineStart && value.charCodeAt(index - 1) === 13 ? index - 1 : index;
        lines.push(value.slice(lineStart, lineEnd));
        lineStart = index + 1;
    }
    const finalEnd = value.length > lineStart && value.charCodeAt(value.length - 1) === 13 ? value.length - 1 : value.length;
    lines.push(value.slice(lineStart, finalEnd));
    return lines;
}

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
