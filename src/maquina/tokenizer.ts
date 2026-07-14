import type { MaquinaLanguage, MaquinaToken } from "./types";

const KEYWORDS = new Set(["await","async","break","case","catch","class","const","continue","debugger","default","delete","do","else","export","extends","false","finally","for","from","function","if","import","in","instanceof","let","new","null","of","return","static","super","switch","this","throw","true","try","typeof","undefined","var","void","while","with","yield"]);

export function tokenizeMaquina(source: string, language: MaquinaLanguage): MaquinaToken[] {
  if (!source) return [];
  if (language === "html") return tokenizeMarkup(source);
  if (language === "css") return tokenizeCss(source);
  if (language === "javascript" || language === "json") return tokenizeScript(source, language === "json");
  return [{ value: source, kind: "plain" }];
}

function tokenizeScript(source: string, json: boolean): MaquinaToken[] {
  const pattern = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|`(?:\\.|[^`])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:true|false|null|undefined)\b|\b\d+(?:\.\d+)?\b|\b[$A-Z_a-z][$\w]*\b|[{}()[\].,;:+\-*/%=<>!?&|]+)/g;
  return collect(source, pattern, (value) => {
    if (value.startsWith("//") || value.startsWith("/*")) return "comment";
    if (/^[`"']/.test(value)) return "string";
    if (/^\d/.test(value)) return "number";
    if (/^(true|false|null|undefined)$/.test(value)) return "boolean";
    if (!json && KEYWORDS.has(value)) return "keyword";
    if (/^[{}()[\].,;:+\-*/%=<>!?&|]+$/.test(value)) return "punctuation";
    return "property";
  });
}

function tokenizeMarkup(source: string): MaquinaToken[] {
  const pattern = /(<!--[\s\S]*?-->|<\/?[A-Za-z][\w:-]*|\s+[A-Za-z_:][\w:.-]*(?=\s*=)|"[^"]*"|'[^']*'|\/?>)/g;
  return collect(source, pattern, (value) => {
    if (value.startsWith("<!--")) return "comment";
    if (value.startsWith("<")) return "tag";
    if (/^\s+[A-Za-z_:]/.test(value)) return "attribute";
    if (/^["']/.test(value)) return "string";
    return "punctuation";
  });
}

function tokenizeCss(source: string): MaquinaToken[] {
  const pattern = /(\/\*[\s\S]*?\*\/|--[\w-]+|#[\da-fA-F]{3,8}|"[^"]*"|'[^']*'|\b\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%|s|ms|deg)?\b|[.#]?[A-Za-z_-][\w-]*(?=\s*[:{])|[{}:;(),])/g;
  return collect(source, pattern, (value) => {
    if (value.startsWith("/*")) return "comment";
    if (/^["']/.test(value)) return "string";
    if (/^\d|^#/.test(value)) return "number";
    if (/^--/.test(value)) return "property";
    if (/^[{}:;(),]$/.test(value)) return "punctuation";
    return value.endsWith(":") ? "property" : "tag";
  });
}

function collect(source: string, pattern: RegExp, classify: (value: string) => MaquinaToken["kind"]): MaquinaToken[] {
  const tokens: MaquinaToken[] = [];
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) tokens.push({ value: source.slice(cursor, index), kind: "plain" });
    tokens.push({ value: match[0], kind: classify(match[0]) });
    cursor = index + match[0].length;
  }
  if (cursor < source.length) tokens.push({ value: source.slice(cursor), kind: "plain" });
  return tokens;
}
