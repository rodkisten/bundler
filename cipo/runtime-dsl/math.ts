import { runtime } from '../runtime'
import { toKebabMixed } from '../utils'
import { findTopLevelChar, isIdentifierStart, readIdentifierEnd } from './shared'

export function normalizeRuntimeVariableMath(input: string): string {
  let output = "";
  let start = 0;

  for (let index = 0; index <= input.length; index += 1) {
    if (index < input.length && input[index] !== "\n" && input[index] !== ";")
      continue;
    const chunk = input.slice(start, index);
    output += normalizeRuntimeDeclarationChunk(chunk) + (input[index] || "");
    start = index + 1;
  }

  return output;
}

function normalizeRuntimeDeclarationChunk(chunk: string): string {
  if (chunk.indexOf("{") >= 0 || chunk.indexOf("}") >= 0) return chunk;
  const colon = findTopLevelChar(chunk, ":");
  if (colon <= 0) return chunk;
  const before = chunk.slice(0, colon + 1);
  const value = chunk.slice(colon + 1).trim();
  if (!value) return chunk;
  return `${before} ${normalizeRuntimeExpression(value)}`;
}

export function normalizeRuntimeExpression(value: string): string {
  const withVars = replaceRuntimeVars(value.trim());
  if (withVars.startsWith("calc(")) return withVars;
  if (!hasTopLevelMath(withVars)) return withVars;
  return `calc(${withVars})`;
}

function replaceRuntimeVars(value: string): string {
  let output = "";
  for (let index = 0; index < value.length; index += 1) {
    if (
      value[index] === "$" &&
      value[index + 1] === "$" &&
      isIdentifierStart(value[index + 2] || "")
    ) {
      const start = index + 2;
      const end = readIdentifierEnd(value, start);
      const name = toKebabMixed(value.slice(start, end).replace(/[._]+/g, "-"));
      output += `var(--${runtime.config.prefix}-${name})`;
      index = end - 1;
      continue;
    }
    output += value[index];
  }
  return output;
}

function hasTopLevelMath(value: string): boolean {
  let depth = 0;
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      if (char === quote && value[index - 1] !== "\\") quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(" || char === "[") {
      depth += 1;
      continue;
    }
    if (char === ")" || char === "]") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth === 0 && (char === "+" || char === "*" || char === "/"))
      return true;
    if (
      depth === 0 &&
      char === "-" &&
      index > 0 &&
      /\s/.test(value[index - 1] || "") &&
      /\s/.test(value[index + 1] || "")
    )
      return true;
  }
  return false;
}
