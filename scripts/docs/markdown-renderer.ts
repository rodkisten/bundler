import type { Heading, TableBlock } from "./doc-types";
import { createCodeFrame } from "./code-frame";
import { escapeHtml } from "./html-utils";

export function renderMarkdown(markdown: string): { html: string; headings: Heading[] } {
  const headings: Heading[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];

  let paragraph: string[] = [];
  let list: "ul" | "ol" | null = null;
  let codeFence: { language: string; lines: string[] } | null = null;
  let quote: string[] = [];

  const closeParagraph = () => {
    if (paragraph.length === 0) return;
    html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const closeList = () => {
    if (!list) return;
    html.push(`</${list}>`);
    list = null;
  };

  const closeQuote = () => {
    if (quote.length === 0) return;
    html.push(`<blockquote>${quote.map((line) => `<p>${renderInline(line)}</p>`).join("")}</blockquote>`);
    quote = [];
  };

  const closeFlow = () => {
    closeParagraph();
    closeList();
    closeQuote();
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] || "";
    const fenceMatch = line.match(/^```\s*([\w-]*)\s*$/);

    if (fenceMatch) {
      if (codeFence) {
        html.push(createCodeFrame({
          code: codeFence.lines.join("\n"),
          language: codeFence.language || "plaintext",
          title: codeFence.language || "Code",
          tone: "source",
        }));
        codeFence = null;
      } else {
        closeFlow();
        codeFence = { language: fenceMatch[1] || "plaintext", lines: [] };
      }

      continue;
    }

    if (codeFence) {
      codeFence.lines.push(line);
      continue;
    }

    const table = readMarkdownTable(lines, index);
    if (table) {
      closeFlow();
      html.push(renderMarkdownTable(table.block));
      index = table.nextIndex - 1;
      continue;
    }

    if (line.trim().length === 0) {
      closeFlow();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      closeFlow();

      const level = headingMatch[1]!.length;
      const text = stripMarkdown(headingMatch[2]!.replace(/#+$/, "").trim());
      const id = uniqueHeadingId(text, headings);

      headings.push({ id, level, text });
      html.push(`<h${level} id="${escapeHtml(id)}">${renderInline(text)}</h${level}>`);
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      closeFlow();
      html.push("<hr />");
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      closeParagraph();
      closeList();
      quote.push(quoteMatch[1] || "");
      continue;
    }

    const unorderedMatch = line.match(/^\s*[-*+]\s+(.+)$/);
    const orderedMatch = line.match(/^\s*\d+\.\s+(.+)$/);

    if (unorderedMatch || orderedMatch) {
      closeParagraph();
      closeQuote();

      const nextList = unorderedMatch ? "ul" : "ol";
      if (list !== nextList) {
        closeList();
        list = nextList;
        html.push(`<${list}>`);
      }

      html.push(`<li>${renderInline((unorderedMatch?.[1] || orderedMatch?.[1] || "").trim())}</li>`);
      continue;
    }

    closeList();
    closeQuote();
    paragraph.push(line.trim());
  }

  closeFlow();

  return { html: html.join("\n"), headings };
}

function readMarkdownTable(lines: string[], startIndex: number): { block: TableBlock; nextIndex: number } | null {
  const headerLine = lines[startIndex] || "";
  const separatorLine = lines[startIndex + 1] || "";

  if (!isMarkdownTableSeparator(separatorLine) || !headerLine.includes("|")) {
    return null;
  }

  const headers = splitMarkdownTableRow(headerLine);
  const separatorCells = splitMarkdownTableRow(separatorLine);

  if (headers.length === 0 || separatorCells.length === 0) {
    return null;
  }

  const aligns = separatorCells.map(parseTableAlign);
  const rows: string[][] = [];
  let nextIndex = startIndex + 2;

  while (nextIndex < lines.length) {
    const rowLine = lines[nextIndex] || "";
    if (!rowLine.includes("|") || rowLine.trim().length === 0) break;

    rows.push(splitMarkdownTableRow(rowLine));
    nextIndex += 1;
  }

  return {
    block: {
      headers,
      aligns,
      rows,
    },
    nextIndex,
  };
}

function isMarkdownTableSeparator(line: string): boolean {
  const cells = splitMarkdownTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function splitMarkdownTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let current = "";
  let escaped = false;

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      current += char;
      escaped = true;
      continue;
    }

    if (char === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseTableAlign(value: string): "left" | "center" | "right" {
  const trimmed = value.trim();

  if (trimmed.startsWith(":") && trimmed.endsWith(":")) return "center";
  if (trimmed.endsWith(":")) return "right";

  return "left";
}

function renderMarkdownTable(table: TableBlock): string {
  const columnCount = table.headers.length;

  const head = table.headers
    .map((header, index) => `<th style="text-align:${table.aligns[index] || "left"}">${renderInline(header)}</th>`)
    .join("");

  const rows = table.rows
    .map((row) => {
      const cells = Array.from({ length: columnCount }, (_value, index) => row[index] || "");
      return `<tr>${cells.map((cell, index) => `<td style="text-align:${table.aligns[index] || "left"}">${renderInline(cell)}</td>`).join("")}</tr>`;
    })
    .join("");

  return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderInline(value: string): string {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\[([^\]]+)]\(([^\s)]+)\)/g, '<a href="$2">$1</a>');
}

function stripMarkdown(value: string): string {
  return value.replace(/[`*_~#[\]()]/g, "").trim();
}

function uniqueHeadingId(text: string, headings: Heading[]): string {
  const base =
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section";

  const matching = headings.filter((heading) => heading.id === base || heading.id.startsWith(`${base}-`)).length;

  return matching === 0 ? base : `${base}-${matching + 1}`;
}
