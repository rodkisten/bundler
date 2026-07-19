import { runtime } from '../runtime'
import { createDeclaration, findTopLevelColon, parseFunctionCall, splitTopLevel } from '../utils'
import type { ValueNormalizer } from './contracts'
import { TEXT_SIZE_TOKENS } from './presets'



const TEXT_ALIGN_VALUES = new Set(['start', 'end', 'left', 'right', 'center', 'justify', 'match-parent'])
const TEXT_DECORATION_VALUES = new Set(['none', 'underline', 'overline', 'line-through', 'blink'])
const TEXT_TRANSFORM_VALUES = new Set(['none', 'capitalize', 'uppercase', 'lowercase', 'full-width', 'full-size-kana'])
const TEXT_WRAP_VALUES = new Set(['wrap', 'nowrap', 'balance', 'pretty', 'stable'])

/** Standard CSS named colors accepted by the standalone text color shorthand. */
const NAMED_CSS_COLORS = new Set(`
aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown
burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan
darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid
darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet
deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro
ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki
lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray
lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue
lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple
mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream
mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen
paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown
royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow
springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen
`.trim().split(/\s+/))

/** Creates the typography shorthand expander around the core value normalizer. */
export function createTextExpander(normalizeValue: ValueNormalizer): (args: string) => string {
  /**
   * Expands the typography helper into standard CSS declarations.
   *
   * @param args - text(...) arguments.
   * @returns CSS declarations.
   */
  function expandText(args: string): string {
    const parts = splitTopLevel(args, ",");
    const typed: Record<string, string> = {};
    let output = "";

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index] ?? "";
      const call = parseFunctionCall(part);
      const colonIndex = findTopLevelColon(part);

      if (colonIndex > 0 && !call) {
        typed[part.slice(0, colonIndex).trim()] = part
          .slice(colonIndex + 1)
          .trim();
        continue;
      }

      const token = part.trim();
      if (!token) continue;

      if (token === "underline")
        output += createDeclaration("text-decoration-line", "underline");
      else if (token === "no-underline")
        output += createDeclaration("text-decoration-line", "none");
      else if (token === "nowrap")
        output += createDeclaration("white-space", "nowrap");
      else if (token === "pre" || token === "pre-wrap" || token === "pre-line")
        output += createDeclaration("white-space", token);
      else if (token === "normal")
        output += createDeclaration("white-space", "normal");
      else if (token === "balance" || token === "pretty" || token === "stable")
        output += createDeclaration("text-wrap", token);
      else if (
        token === "uppercase" ||
        token === "lowercase" ||
        token === "capitalize"
      )
        output += createDeclaration("text-transform", token);
      else if (isColorLike(token))
        output += createDeclaration(
          "color",
          normalizeValue("color", token, "color"),
        );
      else if (parseFunctionCall(token)?.name.toLowerCase() === 'gradient') {
        output += createDeclaration(
          "background-image",
          normalizeValue("background-image", token),
        );
        output += createDeclaration("-webkit-background-clip", "text");
        output += createDeclaration("background-clip", "text");
        output += createDeclaration("color", "transparent");
      }
    }

    if (typed.size)
      output += createDeclaration(
        "font-size",
        TEXT_SIZE_TOKENS.has(typed.size)
          ? `var(--${runtime.config.prefix}-text-${typed.size})`
          : normalizeValue("font-size", typed.size),
      );
    if (typed.lh || typed.leading)
      output += createDeclaration("line-height", typed.lh ?? typed.leading ?? "");
    if (typed.weight) output += createDeclaration("font-weight", typed.weight);
    if (typed.color)
      output += createDeclaration(
        "color",
        normalizeValue("color", typed.color, "color"),
      );
    if (typed.align && TEXT_ALIGN_VALUES.has(typed.align)) {
      output += createDeclaration('text-align', typed.align)
    }
    if (typed.decoration && TEXT_DECORATION_VALUES.has(typed.decoration)) {
      output += createDeclaration('text-decoration-line', typed.decoration)
    }
    if (typed.shadow)
      output += createDeclaration(
        "text-shadow",
        normalizeValue("text-shadow", typed.shadow, "shadow"),
      );
    if (typed.tracking)
      output += createDeclaration(
        "letter-spacing",
        normalizeValue("letter-spacing", typed.tracking),
      );
    if (typed.transform && TEXT_TRANSFORM_VALUES.has(typed.transform)) {
      output += createDeclaration('text-transform', typed.transform)
    }
    if (typed.wrap && TEXT_WRAP_VALUES.has(typed.wrap)) {
      output += createDeclaration('text-wrap', typed.wrap)
    }
    if (typed.fill) {
      output += createDeclaration(
        "background-image",
        normalizeValue("background-image", typed.fill),
      );
      output += createDeclaration("-webkit-background-clip", "text");
      output += createDeclaration("background-clip", "text");
      output += createDeclaration("color", "transparent");
    }

    return output;
  }

  function isColorLike(value: string): boolean {
    return (
      value.startsWith("$") ||
      value.startsWith("#") ||
      value.startsWith("rgb") ||
      value.startsWith("hsl") ||
      value.startsWith("oklch") ||
      value.startsWith("oklab") ||
      value === 'transparent' ||
      value === 'currentColor' ||
      NAMED_CSS_COLORS.has(value.toLowerCase())
    );
  }

  return expandText
}
