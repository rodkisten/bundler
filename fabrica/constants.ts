/** Comment marker prefix used for child template interpolations. */
export const TEXT_MARKER_PREFIX = "fabrica:text:";

/** Attribute marker prefix used while compiling template interpolations. */
export const ATTR_MARKER_PREFIX = "__fabrica_attr_";

/** Attribute marker suffix used while compiling template interpolations. */
export const ATTR_MARKER_SUFFIX = "__";

/** Stable start boundary for dynamic child parts. */
export const PART_START = "fabrica:start";

/** Stable end boundary for dynamic child parts. */
export const PART_END = "fabrica:end";

/** Supported SVG tags for expression-based element creation. */
export const SVG_TAGS = new Set<string>([
  "svg",
  "path",
  "circle",
  "rect",
  "line",
  "polyline",
  "polygon",
  "ellipse",
  "g",
  "defs",
  "symbol",
  "use",
  "text",
  "tspan",
  "linearGradient",
  "radialGradient",
  "stop",
  "clipPath",
  "mask",
]);

/** SVG namespace used when creating SVG elements from shorthand expressions. */
export const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
