/**
 * Shared markers, tuple tags, and regexes for the Fábrica HTML compiler.
 * Keeping these named avoids duplicated magic strings across parse/emit/runtime.
 */

export const FABRICA_VALUE_PREFIX = "%%fabrica_value_";
export const FABRICA_VALUE_SUFFIX = "%%";
export const FABRICA_SPREAD_PREFIX = "%%fabrica_spread_";
export const FABRICA_SPREAD_SUFFIX = "%%";

/** Compact AST node kinds emitted by compile-time transforms. */
export const NODE_ELEMENT = 0 as const;
export const NODE_TEXT = 1 as const;
export const NODE_VALUE = 2 as const;

/** Compact AST prop kinds alongside the element tuple. */
export const PROP_STATIC = 0 as const;
export const PROP_VALUE = 1 as const;
export const PROP_COMPOUND = 2 as const;
export const PROP_SPREAD = 3 as const;

export const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
/** Separator used when hashing template string arrays for the runtime cache. */
export const TEMPLATE_CACHE_KEY_SEPARATOR = "\u001f";

export const OPEN_TAG_RE = /^([A-Za-z][A-Za-z0-9:-]*)([\s\S]*)$/;
export const ATTR_TOKEN_RE =
  /([^\s"'<>/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'<>`=]+))?/g;
export const VALUE_MARKER_RE = /%%fabrica_value_(\d+)%%/g;
export const VALUE_MARKER_EXACT_RE = /^%%fabrica_value_(\d+)%%$/;
export const SPREAD_MARKER_EXACT_RE = /^%%fabrica_spread_(\d+)%%$/;
export const LEGACY_SPREAD_MARKER_RE = /^\.\.\.%%fabrica_value_(\d+)%%$/;
export const VOID_TAG_RE =
  /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;
export const SVG_TAG_RE =
  /^(svg|path|circle|rect|line|polyline|polygon|ellipse|g|defs|symbol|use|text|tspan|linearGradient|radialGradient|stop|clipPath|mask)$/i;
export const EXPLICIT_SPREAD_TAIL_RE = /\.\.\.\s*$/;
export const ATTR_EQUALS_TAIL_RE =
  /([.?@:a-zA-Z_][\w:.-]*)\s*=\s*(?:"[^"]*|'[^']*)?$/;
export const IMPLICIT_SPREAD_NEXT_RE =
  /^\s*(?:\/?>|[.?@:a-zA-Z_][\w:.-]*\s*=|[a-zA-Z_][\w:.-]*(?:\s|\/?>))/;
export const TAG_BOUNDARY_BEFORE_RE = /[$\w.]/;
export const UPPERCASE_TAG_RE = /^[A-Z]/
export const DIRECT_COMPONENT_IDENT_RE = /^[A-Z_$][\w$]*$/;
export const EVENT_PROP_CAMEL_RE = /^on[A-Z]/
export const EVENT_PROP_LEGACY_RE = /^on[a-z]+(?:[.:_-]|$)/;
export const IMPORT_CREATE_ELEMENT_RE =
  /import\s+\{[^}]*\bcreateCompiledElement\b[^}]*\}\s+from\s+['"][^'"]+['"]/;
export const IMPORT_CREATE_TEMPLATE_RE =
  /import\s+\{[^}]*\bcreateCompiledTemplate\b[^}]*\}\s+from\s+['"][^'"]+['"]/;
