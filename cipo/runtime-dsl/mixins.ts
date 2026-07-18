import type { CipoWarning } from '../types'
import { splitTopLevel } from '../utils'
import { findMatching, findTopLevelChar, isIdentifierPart, isIdentifierStart, isParamBoundary, readIdentifierEnd, skipSpaces } from './shared'

type RuntimeMixin = {
  readonly name: string;
  readonly params: readonly RuntimeMixinParam[];
  readonly body: string;
};

type RuntimeMixinParam = {
  readonly name: string;
  readonly type: string;
  readonly fallback: string;
};

type RuntimeMixinState = {
  readonly source: string;
  readonly mixins: Record<string, RuntimeMixin>;
};

export function extractRuntimeMixins(
  input: string,
  warnings: CipoWarning[],
): RuntimeMixinState {
  let output = "";
  const mixins: Record<string, RuntimeMixin> = Object.create(null);
  let index = 0;

  while (index < input.length) {
    const start = input.indexOf("$$", index);
    if (start < 0) {
      output += input.slice(index);
      break;
    }

    output += input.slice(index, start);

    const nameStart = start + 2;
    const nameEnd = readIdentifierEnd(input, nameStart);
    const name = input.slice(nameStart, nameEnd);
    let cursor = skipSpaces(input, nameEnd);

    if (!name || input[cursor] !== "(") {
      output += input.slice(start, nameEnd);
      index = nameEnd;
      continue;
    }

    const closeParen = findMatching(input, cursor, "(", ")");
    if (closeParen < 0) {
      output += input.slice(start);
      break;
    }

    cursor = skipSpaces(input, closeParen + 1);
    if (input[cursor] !== "{") {
      output += input.slice(start, closeParen + 1);
      index = closeParen + 1;
      continue;
    }

    const closeBrace = findMatching(input, cursor, "{", "}");
    if (closeBrace < 0) {
      warnings.push({
        code: "cipo-mixin-unclosed",
        message: `Unclosed runtime mixin: ${name}`,
      });
      output += input.slice(start);
      break;
    }

    mixins[name] = {
      name,
      params: parseMixinParams(input.slice(input.indexOf("(", start) + 1, closeParen)),
      body: input.slice(cursor + 1, closeBrace),
    };
    index = closeBrace + 1;
  }

  return { source: output, mixins };
}

function parseMixinParams(raw: string): RuntimeMixinParam[] {
  const parts = splitTopLevel(raw, ",");
  const params: RuntimeMixinParam[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = (parts[index] || "").trim();
    if (!part) continue;
    const colon = findTopLevelChar(part, ":");
    const equals = findTopLevelChar(part, "=");
    const nameEnd = colon > 0 ? colon : equals > 0 ? equals : part.length;
    const name = part
      .slice(0, nameEnd)
      .trim()
      .replace(/^[$*]+/, "");
    const type =
      colon > 0
        ? part.slice(colon + 1, equals > colon ? equals : part.length).trim()
        : "";
    const fallback = equals > 0 ? part.slice(equals + 1).trim() : "";
    if (name) params.push({ name, type, fallback });
  }

  return params;
}

export function expandRuntimeMixinCalls(
  input: string,
  mixins: Record<string, RuntimeMixin>,
  warnings: CipoWarning[],
): string {
  let current = input;

  for (let pass = 0; pass < 8; pass += 1) {
    const next = expandRuntimeMixinCallsOnePass(current, mixins, warnings);
    if (next === current) return next;
    current = next;
  }

  return current;
}

function expandRuntimeMixinCallsOnePass(
  input: string,
  mixins: Record<string, RuntimeMixin>,
  warnings: CipoWarning[],
): string {
  let output = "";
  let index = 0;

  while (index < input.length) {
    const start = findNextMixinCall(input, index, mixins);
    if (start < 0) {
      output += input.slice(index);
      break;
    }

    output += input.slice(index, start);
    const nameEnd = readIdentifierEnd(input, start);
    const name = input.slice(start, nameEnd);
    const open = skipSpaces(input, nameEnd);
    const close = findMatching(input, open, "(", ")");

    if (close < 0) {
      warnings.push({
        code: "cipo-mixin-call-unclosed",
        message: `Unclosed runtime mixin call: ${name}`,
      });
      output += input.slice(start);
      break;
    }

    output += renderRuntimeMixin(mixins[name]!, input.slice(open + 1, close));
    index = close + 1;
  }

  return output;
}

function findNextMixinCall(
  input: string,
  startIndex: number,
  mixins: Record<string, RuntimeMixin>,
): number {
  let quote: '"' | "'" | null = null;

  for (let index = startIndex; index < input.length; index += 1) {
    const char = input[index];
    if (quote) {
      if (char === quote && input[index - 1] !== "\\") quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (!isIdentifierStart(char || "")) continue;
    if (index > 0 && isIdentifierPart(input[index - 1] || "")) continue;

    const end = readIdentifierEnd(input, index);
    const name = input.slice(index, end);
    if (!mixins[name]) {
      index = end;
      continue;
    }
    const open = skipSpaces(input, end);
    if (input[open] === "(") return index;
    index = end;
  }

  return -1;
}

function renderRuntimeMixin(mixin: RuntimeMixin, rawArgs: string): string {
  const args = splitTopLevel(rawArgs, ",");
  const values: Record<string, string> = Object.create(null);

  for (let index = 0; index < mixin.params.length; index += 1) {
    const param = mixin.params[index]!;
    values[param.name] = (args[index] || param.fallback || "")
      .trim()
      .replace(/^['"]|['"]$/g, "");
  }

  let body = stripRuntimeIfBlocks(mixin.body, values);

  for (let index = 0; index < mixin.params.length; index += 1) {
    const param = mixin.params[index]!;
    const value = values[param.name] || "";
    body = replaceParam(body, param.name, value);
  }

  return body;
}

function stripRuntimeIfBlocks(
  input: string,
  values: Record<string, string>,
): string {
  let output = "";
  let index = 0;

  while (index < input.length) {
    const start = findIfKeyword(input, index);
    if (start < 0) {
      output += input.slice(index);
      break;
    }

    output += input.slice(index, start);
    const conditionStart = skipSpaces(input, start + 2);
    const open = findRuntimeIfBlockOpen(input, conditionStart);
    if (open < 0) {
      output += input.slice(start);
      break;
    }
    const close = findMatching(input, open, "{", "}");
    if (close < 0) {
      output += input.slice(start);
      break;
    }

    const condition = input.slice(conditionStart, open).trim();
    if (evaluateRuntimeCondition(condition, values))
      output += input.slice(open + 1, close);
    index = close + 1;
  }

  return output;
}

function findIfKeyword(input: string, startIndex: number): number {
  for (let index = startIndex; index < input.length - 1; index += 1) {
    if (input[index] !== "i" || input[index + 1] !== "f") continue;
    const previous = input[index - 1] || "";
    const next = input[index + 2] || "";
    if (
      (previous && isIdentifierPart(previous)) ||
      (next && isIdentifierPart(next))
    )
      continue;
    return index;
  }
  return -1;
}

function findRuntimeIfBlockOpen(input: string, startIndex: number): number {
  let depth = 0;
  let quote: '"' | "'" | null = null;
  for (let index = startIndex; index < input.length; index += 1) {
    const char = input[index];
    if (quote) {
      if (char === quote && input[index - 1] !== "\\") quote = null;
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
    if (char === "{" && depth === 0) return index;
  }
  return -1;
}

function evaluateRuntimeCondition(
  condition: string,
  values: Record<string, string>,
): boolean {
  const equals = findTopLevelChar(condition, "=");
  if (equals < 0) return false;
  const left = condition
    .slice(0, equals)
    .trim()
    .replace(/^[$*]+/, "");
  const right = condition
    .slice(equals + 1)
    .trim()
    .replace(/^['"]|['"]$/g, "");
  return String(values[left] || "") === right;
}

function replaceParam(input: string, name: string, value: string): string {
  let output = "";
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (
      (char === "*" || char === "$") &&
      input.slice(index + 1, index + 1 + name.length) === name
    ) {
      const before = input[index - 1] || "";
      const after = input[index + 1 + name.length] || "";
      if (isParamBoundary(before) && isParamBoundary(after)) {
        output += value;
        index += name.length;
        continue;
      }
    }
    output += char;
  }
  return output;
}
