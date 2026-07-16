import type {
  MaquinaLanguage,
  MaquinaToken,
} from "@rodkisten/maquina/types";

/**
 * JavaScript keywords are kept in a Set because identifier classification is
 * the only branch that needs arbitrary string membership lookup.
 *
 * All other token classes are identified using character codes or direct
 * string comparisons to avoid running secondary regular expressions.
 */
const SCRIPT_KEYWORDS = new Set([
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "finally",
  "for",
  "from",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "let",
  "new",
  "of",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

/**
 * Patterns are compiled once at module initialization.
 *
 * Shared global RegExp instances are safe here because tokenization is fully
 * synchronous and each tokenizer explicitly resets `lastIndex` before use.
 */
const SCRIPT_TOKEN_PATTERN =
  /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:true|false|null|undefined)\b|\b\d+(?:\.\d+)?\b|\b[$A-Z_a-z][$\w]*\b|[{}()[\].,;:+\-*/%=<>!?&|]+)/g;

const MARKUP_TOKEN_PATTERN =
  /(<!--[\s\S]*?-->|<\/?[A-Za-z][\w:-]*|\s+[A-Za-z_:][\w:.-]*(?=\s*=)|"[^"]*"|'[^']*'|\/?>)/g;

const CSS_TOKEN_PATTERN =
  /(\/\*[\s\S]*?\*\/|--[\w-]+|#[\da-fA-F]{3,8}|"[^"]*"|'[^']*'|\b\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%|s|ms|deg)?\b|[.#]?[A-Za-z_-][\w-]*(?=\s*[:{])|[{}:;(),])/g;

/* Character codes used in hot classification paths. */
const CHAR_DOUBLE_QUOTE = 34;
const CHAR_HASH = 35;
const CHAR_DOLLAR = 36;
const CHAR_SINGLE_QUOTE = 39;
const CHAR_SLASH = 47;
const CHAR_ZERO = 48;
const CHAR_NINE = 57;
const CHAR_COLON = 58;
const CHAR_LESS_THAN = 60;
const CHAR_A = 65;
const CHAR_Z = 90;
const CHAR_BACKTICK = 96;
const CHAR_LOWER_A = 97;
const CHAR_LOWER_Z = 122;
const CHAR_UNDERSCORE = 95;
const CHAR_HYPHEN = 45;

/**
 * Tokenizes source code using a language-specific single-pass scanner.
 *
 * The implementation intentionally avoids:
 * - `String.matchAll()`, which creates an iterator.
 * - Per-token classifier closures.
 * - Secondary regular expressions during classification.
 * - Temporary token arrays.
 *
 * Each language scans directly into the final result array.
 */
export function tokenizeMaquina(
  source: string,
  language: MaquinaLanguage,
): MaquinaToken[] {
  if (source.length === 0) return [];

  switch (language) {
    case "html":
      return tokenizeMarkup(source);

    case "css":
      return tokenizeCss(source);

    case "javascript":
      return tokenizeScript(source, false);

    case "json":
      return tokenizeScript(source, true);

    default:
      return [{
        value: source,
        kind: "plain",
      }];
  }
}

/**
 * Tokenizes JavaScript and JSON.
 *
 * JSON shares the scanner with JavaScript but skips JavaScript keyword lookup.
 * This keeps both grammars on the same fast lexical path.
 */
function tokenizeScript(
  source: string,
  json: boolean,
): MaquinaToken[] {
  const tokens: MaquinaToken[] = [];
  const pattern = SCRIPT_TOKEN_PATTERN;

  pattern.lastIndex = 0;

  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    const value = match[0];
    const index = match.index;

    if (index > cursor) {
      tokens.push({
        value: source.slice(cursor, index),
        kind: "plain",
      });
    }

    tokens.push({
      value,
      kind: classifyScriptToken(value, json),
    });

    cursor = pattern.lastIndex;
  }

  if (cursor < source.length) {
    tokens.push({
      value: source.slice(cursor),
      kind: "plain",
    });
  }

  return tokens;
}

/**
 * Classifies an already matched script token without additional RegExp calls.
 */
function classifyScriptToken(
  value: string,
  json: boolean,
): MaquinaToken["kind"] {
  const first = value.charCodeAt(0);

  if (first === CHAR_SLASH) {
    return "comment";
  }

  if (
    first === CHAR_DOUBLE_QUOTE ||
    first === CHAR_SINGLE_QUOTE ||
    first === CHAR_BACKTICK
  ) {
    return "string";
  }

  if (isDigit(first)) {
    return "number";
  }

  switch (value) {
    case "true":
    case "false":
    case "null":
    case "undefined":
      return "boolean";
  }

  /*
   * Identifiers are the only remaining tokens beginning with an identifier
   * character. Everything else matched by the script pattern is punctuation.
   */
  if (isIdentifierStart(first)) {
    if (!json && SCRIPT_KEYWORDS.has(value)) {
      return "keyword";
    }

    return "property";
  }

  return "punctuation";
}

/**
 * Tokenizes HTML-like markup in one pass.
 *
 * Leading whitespace is intentionally retained in attribute tokens because
 * doing so preserves exact source formatting in the highlight overlay.
 */
function tokenizeMarkup(
  source: string,
): MaquinaToken[] {
  const tokens: MaquinaToken[] = [];
  const pattern = MARKUP_TOKEN_PATTERN;

  pattern.lastIndex = 0;

  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    const value = match[0];
    const index = match.index;

    if (index > cursor) {
      tokens.push({
        value: source.slice(cursor, index),
        kind: "plain",
      });
    }

    const first = value.charCodeAt(0);

    let kind: MaquinaToken["kind"];

    if (
      first === CHAR_LESS_THAN &&
      value.length >= 4 &&
      value.charCodeAt(1) === 33
    ) {
      kind = "comment";
    } else if (first === CHAR_LESS_THAN) {
      kind = "tag";
    } else if (
      first === CHAR_DOUBLE_QUOTE ||
      first === CHAR_SINGLE_QUOTE
    ) {
      kind = "string";
    } else if (isWhitespace(first)) {
      kind = "attribute";
    } else {
      kind = "punctuation";
    }

    tokens.push({
      value,
      kind,
    });

    cursor = pattern.lastIndex;
  }

  if (cursor < source.length) {
    tokens.push({
      value: source.slice(cursor),
      kind: "plain",
    });
  }

  return tokens;
}

/**
 * Tokenizes CSS in one pass.
 *
 * Property and selector classification inspects the next significant source
 * character instead of running another regular expression. This also fixes an
 * issue in the previous implementation where normal declarations such as
 * `color` were generally classified as tags because the matched token itself
 * does not include the trailing colon.
 */
function tokenizeCss(
  source: string,
): MaquinaToken[] {
  const tokens: MaquinaToken[] = [];
  const pattern = CSS_TOKEN_PATTERN;

  pattern.lastIndex = 0;

  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    const value = match[0];
    const index = match.index;

    if (index > cursor) {
      tokens.push({
        value: source.slice(cursor, index),
        kind: "plain",
      });
    }

    tokens.push({
      value,
      kind: classifyCssToken(
        source,
        value,
        pattern.lastIndex,
      ),
    });

    cursor = pattern.lastIndex;
  }

  if (cursor < source.length) {
    tokens.push({
      value: source.slice(cursor),
      kind: "plain",
    });
  }

  return tokens;
}

/**
 * Classifies CSS tokens using character inspection only.
 */
function classifyCssToken(
  source: string,
  value: string,
  end: number,
): MaquinaToken["kind"] {
  const first = value.charCodeAt(0);

  if (
    first === CHAR_SLASH &&
    value.charCodeAt(1) === 42
  ) {
    return "comment";
  }

  if (
    first === CHAR_DOUBLE_QUOTE ||
    first === CHAR_SINGLE_QUOTE
  ) {
    return "string";
  }

  if (
    first === CHAR_HASH ||
    isDigit(first)
  ) {
    return "number";
  }

  if (
    first === CHAR_HYPHEN &&
    value.charCodeAt(1) === CHAR_HYPHEN
  ) {
    return "property";
  }

  if (
    value.length === 1 &&
    isCssPunctuation(first)
  ) {
    return "punctuation";
  }

  /*
   * The lexical pattern only emits identifier-like tokens here when followed
   * by either ":" or "{". Looking ahead once therefore distinguishes a CSS
   * declaration property from a selector without another RegExp execution.
   */
  return nextNonWhitespaceCharCode(source, end) === CHAR_COLON
    ? "property"
    : "tag";
}

/**
 * Returns the first non-whitespace character code at or after `from`.
 *
 * A numeric result avoids allocating a one-character string through indexing.
 */
function nextNonWhitespaceCharCode(
  source: string,
  from: number,
): number {
  for (
    let index = from, length = source.length;
    index < length;
    index += 1
  ) {
    const code = source.charCodeAt(index);

    if (!isWhitespace(code)) {
      return code;
    }
  }

  return -1;
}

function isDigit(code: number): boolean {
  return code >= CHAR_ZERO && code <= CHAR_NINE;
}

function isIdentifierStart(code: number): boolean {
  return (
    code === CHAR_DOLLAR ||
    code === CHAR_UNDERSCORE ||
    (code >= CHAR_A && code <= CHAR_Z) ||
    (code >= CHAR_LOWER_A && code <= CHAR_LOWER_Z)
  );
}

/**
 * Covers ASCII whitespace relevant to source token lookahead.
 *
 * Checking `code <= 32` is faster than a whitespace RegExp and safely includes
 * spaces, tabs, carriage returns, and newlines used by these grammars.
 */
function isWhitespace(code: number): boolean {
  return code <= 32;
}

function isCssPunctuation(code: number): boolean {
  switch (code) {
    case 40: // (
    case 41: // )
    case 44: // ,
    case 58: // :
    case 59: // ;
    case 123: // {
    case 125: // }
      return true;

    default:
      return false;
  }
}
