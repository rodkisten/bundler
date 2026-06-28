import MarkdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import { full as markdownItEmoji } from "markdown-it-emoji";
import markdownItTaskLists from "markdown-it-task-lists";
import type { Heading } from "./doc-types";
import { createCodeFrame } from "./code-frame";
import { escapeHtml } from "./html-utils";

type MarkdownItInstance = MarkdownIt;

type MarkdownToken = {
  type: string;
  tag: string;
  content: string;
  attrGet(name: string): string | null;
  attrSet(name: string, value: string): void;
};

export function renderMarkdown(markdown: string): { html: string; headings: Heading[] } {
  const headingSlugger = createSlugger();
  const renderSlugger = createSlugger();
  const md = createGithubFlavoredMarkdown(renderSlugger.slug);
  const tokens = md.parse(markdown, {});
  const headings = collectHeadings(tokens, headingSlugger.slug);

  return {
    html: md.renderer.render(tokens, md.options, {}),
    headings,
  };
}

function createGithubFlavoredMarkdown(slugify: (value: string) => string): MarkdownItInstance {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    breaks: false,
  })
    .enable(["table", "strikethrough"])
    .use(markdownItAnchor, {
      level: [1, 2, 3, 4, 5, 6],
      slugify,
      permalink: markdownItAnchor.permalink.linkInsideHeader({
        symbol: "#",
        class: "heading-anchor",
        placement: "after",
        ariaHidden: true,
      }),
    })
    .use(markdownItTaskLists, {
      enabled: true,
      label: true,
      labelAfter: true,
    })
    .use(markdownItEmoji);

  md.renderer.rules.fence = (tokens, index) => {
    const token = tokens[index]!;
    const language = normalizeFenceLanguage(token.info);

    return createCodeFrame({
      code: token.content,
      language,
      title: language === "plaintext" ? "Code" : language,
      tone: "source",
    });
  };

  md.renderer.rules.code_block = (tokens, index) => {
    const token = tokens[index]!;

    return createCodeFrame({
      code: token.content,
      language: "plaintext",
      title: "Code",
      tone: "source",
    });
  };

  md.renderer.rules.table_open = () => `<div class="table-wrap"><table class="gfm-table" data-sortable-table>\n`;
  md.renderer.rules.table_close = () => `</table></div>\n`;

  md.renderer.rules.th_open = (tokens, index) => {
    const token = tokens[index]!;
    const align = readTokenTextAlign(token);
    const alignAttribute = align ? ` data-align="${escapeHtml(align)}"` : "";

    return `<th scope="col" aria-sort="none" data-sort-direction="none"${alignAttribute}><button class="table-sort-button" type="button"><span class="table-sort-label">`;
  };

  md.renderer.rules.th_close = () => `</span><span class="table-sort-icon" aria-hidden="true"></span></button></th>`;

  md.renderer.rules.td_open = (tokens, index, options, env, self) => {
    const token = tokens[index]!;
    const align = readTokenTextAlign(token);
    const alignAttribute = align ? ` data-align="${escapeHtml(align)}"` : "";

    return `<td${self.renderAttrs(token)}${alignAttribute}>`;
  };

  md.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const token = tokens[index]!;
    const href = token.attrGet("href") || "";

    if (/^https?:\/\//i.test(href)) {
      token.attrSet("target", "_blank");
      token.attrSet("rel", "noreferrer");
    }

    return self.renderToken(tokens, index, options);
  };

  return md;
}

function collectHeadings(tokens: MarkdownToken[], slugify: (value: string) => string): Heading[] {
  const headings: Heading[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (token.type !== "heading_open") continue;

    const level = Number(token.tag.slice(1));
    const inline = tokens[index + 1];
    if (!inline || inline.type !== "inline") continue;

    const text = stripMarkdownInline(inline.content);
    headings.push({
      id: slugify(text),
      level,
      text,
    });
  }

  return headings;
}

function createSlugger(): { slug(value: string): string } {
  const counts = new Map<string, number>();

  return {
    slug(value: string): string {
      const base = slugifyHeading(value);
      const count = counts.get(base) || 0;
      counts.set(base, count + 1);
      return count === 0 ? base : `${base}-${count + 1}`;
    },
  };
}

function slugifyHeading(value: string): string {
  return (
    stripMarkdownInline(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section"
  );
}

function stripMarkdownInline(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/!\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[`*_~#[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFenceLanguage(info: string): string {
  const language = info.trim().split(/\s+/)[0]?.toLowerCase() || "plaintext";
  if (language === "ts" || language === "tsx") return "ts";
  if (language === "js" || language === "jsx" || language === "mjs") return "js";
  if (language === "yml") return "yaml";
  return language;
}

function readTokenTextAlign(token: MarkdownToken): "left" | "center" | "right" | null {
  const style = token.attrGet("style") || "";
  const match = style.match(/text-align\s*:\s*(left|center|right)/i);
  return match ? (match[1]!.toLowerCase() as "left" | "center" | "right") : null;
}
