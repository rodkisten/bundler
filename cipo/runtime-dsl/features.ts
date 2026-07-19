import type { CipoWarning } from '../types'
import { splitTopLevel, toKebabMixed } from '../utils'
import { createOklchUtilityColor } from './colors'
import {
  findMatching,
  findTopLevelChar,
  isEscapedAt,
  isIdentifierPart,
  isIdentifierStart,
  readIdentifierEnd,
  skipSpaces,
} from './shared'

export function expandRuntimeDesignFeatures(
  input: string,
  warnings: CipoWarning[],
): string {
  let output = rewriteRuntimeFeatureBlocks(input, warnings);
  output = expandPaletteCalls(output, warnings);
  output = expandContextProviderCalls(output, warnings);
  return output;
}

function rewriteRuntimeFeatureBlocks(
  input: string,
  warnings: CipoWarning[],
): string {
  let output = "";
  let index = 0;
  let quote: '"' | "'" | null = null;
  let blockComment = false;

  while (index < input.length) {
    const char = input[index];

    const next = input[index + 1] || "";

    if (blockComment) {
      output += char;
      if (char === "*" && next === "/") {
        output += next;
        blockComment = false;
        index += 2;
      } else {
        index += 1;
      }
      continue;
    }

    if (quote) {
      output += char;
      if (char === quote && !isEscapedAt(input, index)) quote = null;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      output += "/*";
      blockComment = true;
      index += 2;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      output += char;
      index += 1;
      continue;
    }

    if (
      !isIdentifierStart(char || "") ||
      (index > 0 && isIdentifierPart(input[index - 1] || ""))
    ) {
      output += char;
      index += 1;
      continue;
    }

    const nameEnd = readIdentifierEnd(input, index);
    const name = input.slice(index, nameEnd);
    let cursor = skipSpaces(input, nameEnd);
    let args = "";

    if (input[cursor] === "(") {
      const closeParen = findMatching(input, cursor, "(", ")");
      if (closeParen < 0) {
        output += input.slice(index, nameEnd);
        index = nameEnd;
        continue;
      }
      args = input.slice(cursor + 1, closeParen);
      cursor = skipSpaces(input, closeParen + 1);
    }

    if (input[cursor] !== "{") {
      output += input.slice(index, nameEnd);
      index = nameEnd;
      continue;
    }

    const closeBrace = findMatching(input, cursor, "{", "}");
    if (closeBrace < 0) {
      output += input.slice(index);
      break;
    }

    const body = input.slice(cursor + 1, closeBrace);
    // Variant choice names are structural, so do not rewrite names such as `dark`
    // before the variant parser has separated choice names from their bodies.
    const rewrittenBody = name === "variant"
      ? body
      : rewriteRuntimeFeatureBlocks(body, warnings);
    const replacement = renderRuntimeFeatureBlock(
      name,
      args,
      rewrittenBody,
      warnings,
    );

    if (replacement !== null) output += replacement;
    else output += `${input.slice(index, cursor + 1)}${rewrittenBody}}`;

    index = closeBrace + 1;
  }

  return output;
}

function renderRuntimeFeatureBlock(
  name: string,
  args: string,
  body: string,
  warnings: CipoWarning[],
): string | null {
  if (name === "dark" && !args.trim()) return `x:dark{${body}}`;
  if (name === "slot") return renderSlotBlock(args, body, warnings);
  if (name === "variant") return renderVariantBlock(args, body, warnings);
  if (name === "compound") return renderCompoundBlock(args, body, warnings);
  return null;
}

function renderSlotBlock(
  rawName: string,
  body: string,
  warnings: CipoWarning[],
): string {
  const slotName = sanitizeRuntimeIdentifier(
    rawName.trim().replace(/^['"]|['"]$/g, ""),
  );
  if (!slotName) {
    warnings.push({
      code: "cipo-slot-empty",
      message: "Runtime slot() needs a slot name.",
    });
    return body;
  }
  return `[data-slot="${slotName}"]{${body}}`;
}

function renderVariantBlock(
  rawName: string,
  body: string,
  warnings: CipoWarning[],
): string {
  const variantName = sanitizeRuntimeIdentifier(
    rawName.trim().replace(/^['"]|['"]$/g, ""),
  );
  if (!variantName) {
    warnings.push({
      code: "cipo-variant-empty",
      message: "Runtime variant() needs a variant name.",
    });
    return body;
  }

  const choices = readTopLevelNamedBlocks(body, warnings);
  if (choices.length === 0) {
    warnings.push({
      code: "cipo-variant-empty-body",
      message: `Runtime variant(${variantName}) has no choices.`,
    });
    return "";
  }

  let output = "";
  const variantKebab = toKebabMixed(variantName);
  for (let index = 0; index < choices.length; index += 1) {
    const choice = choices[index]!;
    const choiceName = sanitizeRuntimeIdentifier(choice.name.trim());
    if (!choiceName) continue;
    const choiceKebab = toKebabMixed(choiceName);
    const choiceBody = rewriteRuntimeFeatureBlocks(choice.body, warnings);
    output += `&[data-${variantKebab}="${choiceKebab}"], &.${variantKebab}-${choiceKebab}{${choiceBody}}\n`;
  }
  return output;
}

function renderCompoundBlock(
  rawArgs: string,
  body: string,
  warnings: CipoWarning[],
): string {
  const parts = splitTopLevel(rawArgs, ",");
  let attrSelector = "&";
  let classSelector = "&";
  let count = 0;

  for (let index = 0; index < parts.length; index += 1) {
    const part = (parts[index] || "").trim();
    if (!part) continue;
    const colon = findTopLevelChar(part, ":");
    if (colon <= 0) continue;
    const key = toKebabMixed(
      sanitizeRuntimeIdentifier(part.slice(0, colon).trim()),
    );
    const value = toKebabMixed(
      sanitizeRuntimeIdentifier(
        part
          .slice(colon + 1)
          .trim()
          .replace(/^['"]|['"]$/g, ""),
      ),
    );
    if (!key || !value) continue;
    attrSelector += `[data-${key}="${value}"]`;
    classSelector += `.${key}-${value}`;
    count += 1;
  }

  if (count === 0) {
    warnings.push({
      code: "cipo-compound-empty",
      message: "Runtime compound() needs at least one key/value pair.",
    });
    return body;
  }

  return `${attrSelector}, ${classSelector}{${body}}`;
}

type RuntimeNamedBlock = { readonly name: string; readonly body: string };

function readTopLevelNamedBlocks(input: string, warnings: CipoWarning[]): RuntimeNamedBlock[] {
  const blocks: RuntimeNamedBlock[] = [];
  let index = 0;

  while (index < input.length) {
    while (index < input.length && /\s|;/.test(input[index] || "")) index += 1;
    const nameStart = index;
    while (index < input.length && input[index] !== "{") index += 1;
    if (index >= input.length) {
      if (input.slice(nameStart).trim()) {
        warnings.push({
          code: "cipo-variant-choice-malformed",
          message: "Runtime variant() contains a choice without a block body.",
        });
      }
      break;
    }
    const name = input.slice(nameStart, index).trim();
    const close = findMatching(input, index, "{", "}");
    if (close < 0) {
      warnings.push({
        code: "cipo-variant-choice-unclosed",
        message: `Runtime variant choice "${name}" is missing a closing brace.`,
      });
      break;
    }
    blocks[blocks.length] = { name, body: input.slice(index + 1, close) };
    index = close + 1;
  }

  return blocks;
}

function expandPaletteCalls(input: string, warnings: CipoWarning[]): string {
  let output = "";
  let index = 0;

  while (index < input.length) {
    const start = findFunctionCall(input, index, "palette");
    if (start < 0) {
      output += input.slice(index);
      break;
    }

    output += input.slice(index, start);
    const open = skipSpaces(input, start + "palette".length);
    const close = findMatching(input, open, "(", ")");
    if (close < 0) {
      warnings.push({
        code: "cipo-palette-unclosed",
        message: "Unclosed runtime palette(...) call.",
      });
      output += input.slice(start);
      break;
    }

    output += renderPaletteCall(input.slice(open + 1, close));
    index = close + 1;
  }

  return output;
}

function renderPaletteCall(rawArgs: string): string {
  const parts = splitTopLevel(rawArgs, ",");
  const name =
    sanitizeRuntimeIdentifier((parts[0] || "palette").trim()) || "palette";
  const source =
    toKebabMixed(sanitizeRuntimeIdentifier((parts[1] || name).trim())) ||
    toKebabMixed(name);
  const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  let output = "";

  for (let index = 0; index < shades.length; index += 1) {
    const shade = shades[index]!;
    output += `$$${toKebabMixed(name)}-${shade}: ${createOklchUtilityColor(source, shade)}\n`;
  }

  return output;
}

function expandContextProviderCalls(input: string, warnings: CipoWarning[]): string {
  let output = "";
  let index = 0;

  while (index < input.length) {
    const start = findFunctionCall(input, index, "provide");
    if (start < 0) {
      output += input.slice(index);
      break;
    }

    output += input.slice(index, start);
    const open = skipSpaces(input, start + "provide".length);
    const close = findMatching(input, open, "(", ")");
    if (close < 0) {
      warnings.push({
        code: "cipo-provide-unclosed",
        message: "Unclosed runtime provide(...) call.",
      });
      output += input.slice(start);
      break;
    }

    const rendered = renderContextProvider(input.slice(open + 1, close));
    if (!rendered) {
      warnings.push({
        code: "cipo-provide-invalid",
        message: "Runtime provide() requires a non-empty name:value pair.",
      });
    } else {
      output += rendered;
    }
    index = close + 1;
  }

  return output;
}

function renderContextProvider(rawArgs: string): string {
  const colon = findTopLevelChar(rawArgs, ":");
  if (colon <= 0) return "";
  const name = toKebabMixed(
    sanitizeRuntimeIdentifier(rawArgs.slice(0, colon).trim()),
  );
  const value = rawArgs.slice(colon + 1).trim();
  if (!name || !value) return "";
  return `$$context-${name}: ${value}`;
}

function findFunctionCall(
  input: string,
  startIndex: number,
  name: string,
): number {
  let quote: '"' | "'" | null = null;
  let blockComment = false;

  for (let index = startIndex; index < input.length; index += 1) {
    const char = input[index] || "";
    const next = input[index + 1] || "";

    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (char === quote && !isEscapedAt(input, index)) quote = null;
      continue;
    }

    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (input.slice(index, index + name.length) !== name) continue;
    const before = input[index - 1] || "";
    const after = input[index + name.length] || "";
    if (
      (before && isIdentifierPart(before)) ||
      (after && isIdentifierPart(after))
    ) {
      continue;
    }

    const open = skipSpaces(input, index + name.length);
    if (input[open] === "(") return index;
  }

  return -1;
}

function sanitizeRuntimeIdentifier(input: string): string {
  return input
    .replace(/^[.$*#]+/, "")
    .replace(/[^a-zA-Z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
