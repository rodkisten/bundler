import type { MaquinaToken } from "@rodkisten/maquina/types";

export interface MaquinaVisualLine {
  readonly number: number;
  readonly tokens: readonly MaquinaToken[];
}

/**
 * Splits an already-tokenized source into logical lines without losing token
 * kinds across multiline strings and comments.
 */
export function createVisualLines(
  tokens: readonly MaquinaToken[],
  firstLine = 0,
): MaquinaVisualLine[] {
  const lines: MaquinaToken[][] = [[]];

  for (const token of tokens) {
    const parts = token.value.split("\n");

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index] ?? "";

      if (part) {
        lines[lines.length - 1]?.push({
          value: part,
          kind: token.kind,
        });
      }

      if (index < parts.length - 1) {
        lines.push([]);
      }
    }
  }

  return lines.map((lineTokens, index) => ({
    number: firstLine + index + 1,
    tokens: lineTokens,
  }));
}

export function getLineNumberGutterWidth(
  lineCount: number,
  enabled: boolean,
): string {
  if (!enabled) return "0px";

  const digits = Math.max(2, String(Math.max(1, lineCount)).length);

  return `calc(${digits}ch + 28px)`;
}
