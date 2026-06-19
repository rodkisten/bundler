import type { RootEntry } from "./config";
import type { SourceExample } from "./example-extractor";

export type GeneratedDoc = {
  title: string;
  slug: string;
  sourcePath: string;
  href: string;
  kind: "readme" | "markdown";
};

export type GeneratedCodePage = {
  title: string;
  slug: string;
  href: string;
  sourcePath: string;
  language: string;
  kind: "source" | "test" | "pipeline";
};

export type LandingInput = {
  entries: RootEntry[];
  outputs: string[];
  namespace: string;
  examples?: Record<string, SourceExample[]>;
  docs?: GeneratedDoc[];
  sources?: GeneratedCodePage[];
  tests?: GeneratedCodePage[];
  pipelines?: GeneratedCodePage[];
};

export type MarkdownPageInput = {
  title: string;
  sourcePath: string;
  markdown: string;
  navItems: GeneratedDoc[];
};

export type CodePageInput = {
  title: string;
  sourcePath: string;
  code: string;
  language: string;
  navItems: GeneratedCodePage[];
  kind: GeneratedCodePage["kind"];
};

type Heading = {
  id: string;
  level: number;
  text: string;
};

type TableBlock = {
  headers: string[];
  aligns: Array<"left" | "center" | "right">;
  rows: string[][];
};

/**
 * Creates the generated documentation landing page.
 *
 * @remarks
 * The template uses a responsive forest/mata design with layered gradients,
 * glass panels, noise, blur, soft masks and mobile-safe code blocks. It also
 * links generated README, Markdown, source, test and pipeline pages so the
 * published output becomes a full docs portal instead of a lonely index file.
 *
 * @param input - Landing page data.
 * @returns HTML document.
 *
 * @example
 * ```ts
 * createIndexHtml({ entries, outputs, namespace: "Rod", examples, docs });
 * ```
 */
export function createIndexHtml(input: LandingInput): string {
  const cards = input.entries.map((entry) => createToolCard(entry, input.outputs, input.examples?.[entry.name] || [])).join("\n");
  const toolCount = input.entries.length;
  const docs = input.docs || [];
  const sources = input.sources || [];
  const tests = input.tests || [];
  const pipelines = input.pipelines || [];

  return `<!doctype html>
<html lang="en">
<head>
${createHead("Rod Browser Tools")}
</head>
<body>
  ${createBackdrop()}
  <main class="shell">
    <section class="hero">
      <p class="eyebrow">Rod ecosystem · mata runtime</p>
      <h1>Browser tools growing from one forest floor.</h1>
      <p class="lede">A mobile-first bundle system for Broto, Fábrica, Fabrica Elements and Cipó: reactive roots, UI vines, element branches and CSS canopy, published as standalone IIFE and ESM builds.</p>
      <div class="architecture" aria-label="Architecture overview">
        ${createArchitectureMap()}
      </div>
      <div class="stats">
        <span><strong>${toolCount}</strong> tools</span>
        <span><strong>${docs.length}</strong> docs pages</span>
        <span><strong>${tests.length}</strong> test files</span>
        <span><strong>${sources.length}</strong> source files</span>
        <span><strong>IIFE</strong> normal + min</span>
        <span><strong>ESM</strong> normal + min</span>
      </div>
    </section>
    ${createPortalSection("Docs", "Markdown and README pages found in package folders.", docs)}
    ${createPortalSection("Tests", "Package test files rendered beside the published bundle.", tests)}
    ${createPortalSection("Source", "Source files used to produce the browser output.", sources)}
    ${createPortalSection("Pipeline", "Build and publish workflow files that explain how this output was produced.", pipelines)}
    <section class="grid" id="bundles">
${cards}
    </section>
  </main>
  ${createScripts()}
</body>
</html>`;
}

export function createMarkdownPageHtml(input: MarkdownPageInput): string {
  const rendered = renderMarkdown(input.markdown);
  const title = escapeHtml(input.title);

  return `<!doctype html>
<html lang="en">
<head>
${createHead(`${input.title} · Rod Docs`)}
</head>
<body data-page-kind="markdown">
  ${createBackdrop()}
  <button class="sidebar-toggle" type="button" data-sidebar-toggle aria-label="Open navigation" aria-expanded="false">☰</button>
  <div class="sidebar-scrim" data-sidebar-close aria-hidden="true"></div>
  <main class="doc-layout">
    ${createDocSidebar("Docs", input.navItems, input.sourcePath, rendered.headings)}
    <article class="doc-page searchable-content">
      <a class="back-link" href="../index.html">← Home</a>
      <p class="eyebrow">Markdown · ${escapeHtml(input.sourcePath)}</p>
      <h1>${title}</h1>
      <div class="markdown-body">${rendered.html}</div>
    </article>
  </main>
  ${createScripts()}
</body>
</html>`;
}

export function createCodePageHtml(input: CodePageInput): string {
  const title = escapeHtml(input.title);
  const language = escapeHtml(input.language || "plaintext");
  const label = input.kind === "pipeline" ? "Pipeline" : input.kind === "test" ? "Tests" : "Source";

  return `<!doctype html>
<html lang="en">
<head>
${createHead(`${input.title} · Rod ${label}`)}
</head>
<body data-page-kind="code" data-code-kind="${escapeHtml(input.kind)}">
  ${createBackdrop()}
  <button class="sidebar-toggle" type="button" data-sidebar-toggle aria-label="Open navigation" aria-expanded="false">☰</button>
  <div class="sidebar-scrim" data-sidebar-close aria-hidden="true"></div>
  <main class="doc-layout code-layout">
    ${createCodeSidebar(label, input.navItems, input.sourcePath)}
    <article class="doc-page code-doc-page searchable-content">
      <a class="back-link" href="../index.html">← Home</a>
      <p class="eyebrow">${escapeHtml(label)} · ${escapeHtml(input.sourcePath)}</p>
      <h1>${title}</h1>
      ${createCodeFrame({
        code: input.code,
        language,
        title: input.sourcePath,
        tone: input.kind,
        className: "code-page-frame",
      })}
    </article>
  </main>
  ${createScripts()}
</body>
</html>`;
}

function createHead(title: string): string {
  return `  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=Playfair+Display:wght@700;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/tokyo-night-dark.min.css" />
  <style>${createStyles()}</style>`;
}

function createBackdrop(): string {
  return `<div class="forest-noise" aria-hidden="true"></div>
  <div class="canopy canopy-one" aria-hidden="true"></div>
  <div class="canopy canopy-two" aria-hidden="true"></div>
  <div class="canopy canopy-three" aria-hidden="true"></div>`;
}

function createArchitectureMap(): string {
  const groups = [
    ["Broto", "signal · computed · effect · batch · store · graph · scheduler · resources"],
    ["Fábrica", "html · parser · renderer · directives · DOM parts · components · hydration"],
    ["Fabrica Elements", "createElement · adapters · props · refs · children · wrappers"],
    ["Cipó", "css runtime · aliases · tokens · atomic engine · stylesheet compiler"],
  ] as const;

  return groups.map(([name, body]) => `<article><strong>${escapeHtml(name)}</strong><span>${escapeHtml(body)}</span></article>`).join("");
}

function createPortalSection(title: string, description: string, items: Array<GeneratedDoc | GeneratedCodePage>): string {
  if (items.length === 0) return "";
  const links = items
    .slice(0, 24)
    .map((item) => `<a href="./${escapeHtml(item.href)}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.sourcePath)}</span></a>`)
    .join("");
  const more = items.length > 24 ? `<p class="portal-more">+${items.length - 24} more items available in generated pages.</p>` : "";

  return `<section class="portal-section">
    <div>
      <p class="eyebrow">${escapeHtml(title)}</p>
      <h2>${escapeHtml(description)}</h2>
    </div>
    <div class="portal-links">${links}</div>
    ${more}
  </section>`;
}

function createToolCard(entry: RootEntry, outputs: string[], examples: SourceExample[]): string {
  const files = outputs.filter((output) => output.startsWith(`${entry.name}.`));
  const links = files
    .filter((file) => file.endsWith(".js"))
    .map((file) => `<a href="./${escapeHtml(file)}">${escapeHtml(file)}</a>`)
    .join("");
  const requireLine = `// @require https://OWNER.github.io/REPO/${entry.name}.iife.js\nconst ${entry.globalName} = window.${entry.globalName};`;
  const importLine = `import * as ${entry.globalName} from "https://OWNER.github.io/REPO/${entry.name}.esm.js";`;
  const tags = entry.tool.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  const exampleBlocks = examples.slice(0, 16).map(createExampleBlock).join("");

  return `      <article class="card searchable-content">
        <div class="card-top">
          <p class="tool-name">${escapeHtml(entry.tool.name)}</p>
          <code>window.${escapeHtml(entry.globalName)}</code>
        </div>
        <p class="description">${escapeHtml(entry.tool.description)}</p>
        <div class="tags">${tags || "<span>browser</span><span>iife</span>"}</div>
        <div class="links">${links}</div>
        <div class="code-stack">
          ${createCodeFrame({ code: requireLine, language: "js", title: "Userscript require", tone: "source" })}
          ${createCodeFrame({ code: importLine, language: "js", title: "ESM import", tone: "source" })}
        </div>
        ${exampleBlocks ? `<details class="examples" open><summary>Examples from source comments</summary>${exampleBlocks}</details>` : ""}
      </article>`;
}

function createExampleBlock(example: SourceExample): string {
  return `<section class="example-block" data-group="${escapeHtml(example.groupId)}">
    ${example.isFirstInGroup && example.groupComment ? `<div class="example-group"><strong>${escapeHtml(example.groupTitle)}</strong><p>${escapeHtml(example.groupComment)}</p></div>` : ""}
    <header><strong>${escapeHtml(example.title)}</strong><span>${escapeHtml(example.file)}</span></header>
    ${example.comment ? `<p class="example-comment">${escapeHtml(example.comment)}</p>` : ""}
    ${createCodeFrame({ code: example.code, language: "ts", title: example.title, tone: "test" })}
  </section>`;
}

function createCodeFrame(input: {
  code: string;
  language: string;
  title: string;
  tone?: GeneratedCodePage["kind"];
  className?: string;
}): string {
  const language = input.language || "plaintext";
  const tone = input.tone || "source";
  const title = input.title || language;

  return `<figure class="code-frame ${escapeHtml(input.className || "")}" data-code-frame data-wrap="false" data-code-tone="${escapeHtml(tone)}">
    <figcaption class="code-frame-bar">
      <span class="code-frame-dots" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="code-frame-title">${escapeHtml(title)}</span>
      <span class="code-frame-meta">${escapeHtml(language)}</span>
      <span class="code-frame-actions">
        <button class="code-action" type="button" data-code-wrap aria-pressed="false" title="Toggle word wrap">
          <span aria-hidden="true">↩</span>
          <span>Wrap</span>
        </button>
        <button class="code-action" type="button" data-code-copy title="Copy code">
          <span aria-hidden="true">⧉</span>
          <span data-copy-label>Copy</span>
        </button>
      </span>
    </figcaption>
    <pre><code class="language-${escapeHtml(language)}">${escapeHtml(input.code)}</code></pre>
  </figure>`;
}

function createDocSidebar(title: string, items: GeneratedDoc[], currentPath: string, headings: Heading[]): string {
  const itemLinks = items
    .map((item) => `<a class="${item.sourcePath === currentPath ? "active" : ""}" href="../${escapeHtml(item.href)}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.sourcePath)}</span></a>`)
    .join("");
  const headingLinks = headings
    .filter((heading) => heading.level <= 3)
    .slice(0, 48)
    .map((heading) => `<a class="toc-level-${heading.level}" href="#${escapeHtml(heading.id)}">${escapeHtml(heading.text)}</a>`)
    .join("");

  return `<aside class="doc-sidebar" data-doc-sidebar>
    <a class="brand" href="../index.html">Rod Docs</a>
    <label class="search-box"><span>Search</span><input data-doc-search type="search" placeholder="Find in this jungle…" /></label>
    <nav class="side-list" aria-label="${escapeHtml(title)} navigation">${itemLinks}</nav>
    ${headingLinks ? `<nav class="toc" aria-label="Page table of contents"><p>On this page</p>${headingLinks}</nav>` : ""}
  </aside>`;
}

function createCodeSidebar(title: string, items: GeneratedCodePage[], currentPath: string): string {
  const itemLinks = items
    .map((item) => `<a class="${item.sourcePath === currentPath ? "active" : ""}" href="../${escapeHtml(item.href)}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.sourcePath)}</span></a>`)
    .join("");

  return `<aside class="doc-sidebar code-sidebar" data-doc-sidebar>
    <a class="brand" href="../index.html">Rod ${escapeHtml(title)}</a>
    <label class="search-box"><span>Search</span><input data-doc-search type="search" placeholder="Search this file…" /></label>
    <nav class="side-list" aria-label="${escapeHtml(title)} navigation">${itemLinks}</nav>
  </aside>`;
}

function renderMarkdown(markdown: string): { html: string; headings: Heading[] } {
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
    if (!rowLine.includes("|") || rowLine.trim().length === 0) {
      break;
    }

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
  const base = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
  const matching = headings.filter((heading) => heading.id === base || heading.id.startsWith(`${base}-`)).length;
  return matching === 0 ? base : `${base}-${matching + 1}`;
}

function createScripts(): string {
  return `<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js"></script>
  <script>
    window.hljs && window.hljs.highlightAll();

    const sidebarStorageKey = "rod.docs.sidebar.open";
    const wrapStorageKey = "rod.docs.code.wrap";
    const toggle = document.querySelector("[data-sidebar-toggle]");
    const sidebar = document.querySelector("[data-doc-sidebar]");
    const scrim = document.querySelector("[data-sidebar-close]");

    function setSidebarOpen(open) {
      document.documentElement.classList.toggle("sidebar-open", open);
      if (toggle) toggle.setAttribute("aria-expanded", String(open));
      try {
        window.localStorage.setItem(sidebarStorageKey, open ? "1" : "0");
      } catch {}
    }

    if (toggle && sidebar) {
      toggle.addEventListener("click", () => {
        setSidebarOpen(!document.documentElement.classList.contains("sidebar-open"));
      });

      scrim && scrim.addEventListener("click", () => setSidebarOpen(false));

      for (const link of sidebar.querySelectorAll("a")) {
        link.addEventListener("click", () => {
          if (window.matchMedia("(max-width: 980px)").matches) {
            setSidebarOpen(false);
          }
        });
      }

      window.addEventListener("keydown", (event) => {
        if (event.key === "Escape") setSidebarOpen(false);
      });
    }

    function setCodeFrameWrap(frame, enabled) {
      frame.dataset.wrap = enabled ? "true" : "false";
      const button = frame.querySelector("[data-code-wrap]");
      if (button) button.setAttribute("aria-pressed", String(enabled));
    }

    let initialWrap = false;
    try {
      initialWrap = window.localStorage.getItem(wrapStorageKey) === "1";
    } catch {}

    for (const frame of document.querySelectorAll("[data-code-frame]")) {
      setCodeFrameWrap(frame, initialWrap);

      const wrapButton = frame.querySelector("[data-code-wrap]");
      const copyButton = frame.querySelector("[data-code-copy]");
      const copyLabel = frame.querySelector("[data-copy-label]");
      const code = frame.querySelector("code");

      if (wrapButton) {
        wrapButton.addEventListener("click", () => {
          const enabled = frame.dataset.wrap !== "true";
          setCodeFrameWrap(frame, enabled);
          try {
            window.localStorage.setItem(wrapStorageKey, enabled ? "1" : "0");
          } catch {}
        });
      }

      if (copyButton && code) {
        copyButton.addEventListener("click", async () => {
          const text = code.textContent || "";
          try {
            await navigator.clipboard.writeText(text);
          } catch {
            const textarea = document.createElement("textarea");
            textarea.value = text;
            textarea.setAttribute("readonly", "");
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            textarea.style.pointerEvents = "none";
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            textarea.remove();
          }

          copyButton.classList.add("copied");
          if (copyLabel) copyLabel.textContent = "Copied";

          window.setTimeout(() => {
            copyButton.classList.remove("copied");
            if (copyLabel) copyLabel.textContent = "Copy";
          }, 1400);
        });
      }
    }

    for (const input of document.querySelectorAll("[data-doc-search]")) {
      input.addEventListener("input", () => {
        const query = input.value.trim().toLowerCase();
        for (const node of document.querySelectorAll(".searchable-content, .example-block, .side-list a, .portal-links a")) {
          const visible = !query || node.textContent.toLowerCase().includes(query);
          node.hidden = !visible;
        }
      });
    }
  </script>`;
}

function createStyles(): string {
  return `:root {
  color-scheme: dark;
  --bg: #03110c;
  --bg-2: #061a11;
  --soil: #130f0a;
  --moss: #a8ff60;
  --leaf: #34d399;
  --fern: #22c55e;
  --deep: #052e1b;
  --water: #5eead4;
  --gold: #f7c948;
  --orchid: #d8b4fe;
  --text: #f4fff6;
  --muted: #a8cbb5;
  --panel: rgb(8 36 24 / .62);
  --panel-strong: rgb(13 54 35 / .76);
  --line: rgb(209 250 229 / .16);
  --line-strong: rgb(168 255 96 / .32);
  --code-bg: #050816;
  --code-bg-2: #08111f;
  --code-fg: #e6edf7;
  --code-line: rgb(147 197 253 / .20);
  --source-accent: #38bdf8;
  --test-accent: #f59e0b;
  --pipeline-accent: #c084fc;
  --shadow: 0 32px 120px rgb(0 0 0 / .42);
  --radius: 30px;
}

* {
  box-sizing: border-box;
}

html {
  min-width: 0;
  background: var(--bg);
  scroll-behavior: smooth;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

body {
  margin: 0;
  min-width: 0;
  min-height: 100dvh;
  overflow-x: hidden;
  color: var(--text);
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  background:
    radial-gradient(circle at 12% 8%, rgb(168 255 96 / .20), transparent 24rem),
    radial-gradient(circle at 92% 12%, rgb(94 234 212 / .18), transparent 28rem),
    radial-gradient(circle at 58% 105%, rgb(247 201 72 / .14), transparent 32rem),
    linear-gradient(145deg, var(--bg), var(--deep) 48%, var(--soil));
}

body[data-page-kind="code"] {
  --panel: rgb(8 20 38 / .72);
  --panel-strong: rgb(8 19 35 / .86);
  --line: rgb(147 197 253 / .18);
  --line-strong: rgb(56 189 248 / .40);
  --moss: var(--source-accent);
  --leaf: #60a5fa;
  --water: #93c5fd;
  --gold: #f0abfc;
  --muted: #b7c7de;
  --code-bg: #020617;
  --code-bg-2: #08111f;
  --code-fg: #e5f0ff;
  background:
    radial-gradient(circle at 10% 8%, rgb(56 189 248 / .22), transparent 24rem),
    radial-gradient(circle at 90% 10%, rgb(99 102 241 / .20), transparent 28rem),
    radial-gradient(circle at 58% 105%, rgb(192 132 252 / .14), transparent 32rem),
    linear-gradient(145deg, #020617, #071426 52%, #120b2f);
}

body[data-code-kind="test"] {
  --moss: var(--test-accent);
  --line-strong: rgb(245 158 11 / .40);
  --water: #fbbf24;
  --gold: #fde68a;
}

body[data-code-kind="pipeline"] {
  --moss: var(--pipeline-accent);
  --line-strong: rgb(192 132 252 / .44);
  --water: #d8b4fe;
  --gold: #f0abfc;
}

body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: .45;
  background:
    linear-gradient(120deg, transparent 0 35%, rgb(255 255 255 / .035) 40%, transparent 46% 100%),
    repeating-linear-gradient(90deg, rgb(255 255 255 / .025) 0 1px, transparent 1px 58px),
    repeating-linear-gradient(0deg, rgb(255 255 255 / .018) 0 1px, transparent 1px 58px);
  mask-image: linear-gradient(to bottom, black, transparent 86%);
}

a {
  color: inherit;
}

.forest-noise {
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: .18;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.7'/%3E%3C/svg%3E");
}

.canopy {
  position: fixed;
  width: min(44vw, 34rem);
  aspect-ratio: 1;
  border-radius: 999px;
  filter: blur(62px) saturate(135%);
  opacity: .30;
  pointer-events: none;
  animation: drift 15s ease-in-out infinite alternate;
}

.canopy-one {
  left: -12rem;
  top: 12rem;
  background: var(--fern);
}

.canopy-two {
  right: -10rem;
  top: 2rem;
  background: var(--water);
  animation-delay: -5s;
}

.canopy-three {
  left: 44%;
  bottom: -16rem;
  background: var(--gold);
  animation-delay: -8s;
}

.shell {
  width: min(1220px, calc(100% - 32px));
  margin: 0 auto;
  padding: clamp(24px, 6vw, 78px) 0;
  position: relative;
  min-width: 0;
}

.hero,
.portal-section,
.card,
.doc-sidebar,
.doc-page {
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
  backdrop-filter: blur(24px) saturate(150%);
}

.hero {
  position: relative;
  overflow: hidden;
  padding: clamp(28px, 6vw, 62px);
  border-radius: clamp(28px, 5vw, 46px);
  background:
    linear-gradient(135deg, rgb(255 255 255 / .13), rgb(255 255 255 / .035)),
    radial-gradient(circle at 15% 0%, rgb(168 255 96 / .14), transparent 34rem),
    var(--panel);
}

.hero::after {
  content: "";
  position: absolute;
  inset: auto -10% -36% -10%;
  height: 16rem;
  background: radial-gradient(ellipse at center, rgb(168 255 96 / .18), transparent 65%);
  pointer-events: none;
}

.eyebrow {
  margin: 0 0 18px;
  color: var(--moss);
  text-transform: uppercase;
  letter-spacing: .22em;
  font-size: 12px;
  font-weight: 900;
}

h1 {
  margin: 0;
  max-width: 920px;
  font-family: "Playfair Display", Georgia, serif;
  font-size: clamp(48px, 9vw, 118px);
  line-height: .86;
  letter-spacing: -.075em;
  background: linear-gradient(115deg, #fff 8%, var(--moss), var(--water), var(--gold));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

h2 {
  margin: 0;
  font-size: clamp(24px, 4vw, 44px);
  line-height: 1;
  letter-spacing: -.05em;
}

.lede {
  max-width: 800px;
  color: var(--muted);
  font-size: clamp(16px, 2vw, 22px);
  line-height: 1.62;
  margin: 22px 0 0;
}

.architecture {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 28px;
}

.architecture article {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 14px;
  background: rgb(0 0 0 / .18);
}

.architecture strong {
  display: block;
  color: var(--text);
  font-size: 14px;
  margin-bottom: 6px;
}

.architecture span {
  display: block;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
}

.stats {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 28px;
}

.stats span,
.tags span {
  border: 1px solid var(--line);
  background: rgb(255 255 255 / .065);
  border-radius: 999px;
  padding: 10px 14px;
  color: var(--muted);
  backdrop-filter: blur(16px);
}

.stats strong {
  color: white;
}

.portal-section {
  margin-top: 18px;
  border-radius: var(--radius);
  background: linear-gradient(145deg, var(--panel), rgb(0 0 0 / .16));
  padding: clamp(18px, 4vw, 28px);
}

.portal-section h2 {
  max-width: 760px;
}

.portal-links {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
  gap: 10px;
  margin-top: 18px;
}

.portal-links a,
.side-list a {
  display: grid;
  gap: 4px;
  text-decoration: none;
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 12px;
  background: rgb(0 0 0 / .18);
  min-width: 0;
}

.portal-links a:hover,
.side-list a:hover,
.side-list a.active {
  border-color: var(--line-strong);
  background: rgb(168 255 96 / .09);
}

body[data-page-kind="code"] .portal-links a:hover,
body[data-page-kind="code"] .side-list a:hover,
body[data-page-kind="code"] .side-list a.active {
  background: rgb(56 189 248 / .10);
}

.portal-links span,
.side-list span {
  color: var(--muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.portal-more {
  color: var(--muted);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  gap: 18px;
  margin-top: 18px;
  min-width: 0;
}

.card {
  min-width: 0;
  border-radius: var(--radius);
  background: linear-gradient(180deg, var(--panel), rgb(0 0 0 / .14));
  padding: clamp(18px, 3vw, 24px);
}

.card:hover {
  border-color: var(--line-strong);
}

.card-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  min-width: 0;
}

.tool-name {
  margin: 0;
  font-weight: 900;
  font-size: 22px;
}

code,
pre,
kbd,
samp {
  font-family: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

.card-top code {
  max-width: 55%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--water);
  border: 1px solid var(--line);
  padding: 8px 10px;
  border-radius: 14px;
  background: rgb(0 0 0 / .28);
}

.description {
  color: var(--muted);
  line-height: 1.62;
}

.tags,
.links {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 16px 0;
}

.tags span {
  font-size: 12px;
  padding: 7px 10px;
}

.links a {
  color: white;
  text-decoration: none;
  border: 1px solid var(--line);
  border-radius: 13px;
  padding: 8px 10px;
  background: linear-gradient(135deg, rgb(168 255 96 / .14), rgb(94 234 212 / .10));
}

pre {
  width: 100%;
  max-width: 100%;
  margin: 0;
  overflow: auto;
  background: transparent !important;
  -webkit-overflow-scrolling: touch;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

pre code {
  display: block;
  width: max-content;
  min-width: 100%;
  max-width: none;
  padding: 18px;
  color: var(--code-fg);
  font-size: 12px;
  line-height: 1.58;
  white-space: pre;
  overflow-wrap: normal;
  word-break: normal;
  background: transparent;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

.code-frame {
  position: relative;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  margin: 12px 0 0;
  overflow: hidden;
  border: 1px solid var(--code-line);
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgb(255 255 255 / .060), transparent 92px),
    radial-gradient(circle at 0 0, rgb(56 189 248 / .16), transparent 18rem),
    linear-gradient(145deg, var(--code-bg-2), var(--code-bg));
  box-shadow:
    0 24px 70px rgb(0 0 0 / .34),
    inset 0 1px 0 rgb(255 255 255 / .08);
}

.code-frame::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: .55;
  background:
    linear-gradient(90deg, rgb(255 255 255 / .055), transparent 12% 88%, rgb(255 255 255 / .035)),
    radial-gradient(circle at 100% 0, rgb(255 255 255 / .08), transparent 18rem);
  mask-image: linear-gradient(to bottom, black, transparent 68%);
}

.code-frame[data-code-tone="test"] {
  --code-line: rgb(245 158 11 / .26);
  --code-bg: #120b04;
  --code-bg-2: #1b1207;
}

.code-frame[data-code-tone="pipeline"] {
  --code-line: rgb(192 132 252 / .28);
  --code-bg: #10081c;
  --code-bg-2: #1a1029;
}

.code-frame-bar {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  gap: 10px;
  align-items: center;
  min-height: 48px;
  padding: 10px 12px;
  border-bottom: 1px solid rgb(255 255 255 / .08);
  background:
    linear-gradient(180deg, rgb(255 255 255 / .075), rgb(255 255 255 / .025)),
    rgb(0 0 0 / .18);
  backdrop-filter: blur(18px) saturate(150%);
}

.code-frame-dots {
  display: inline-flex;
  gap: 6px;
}

.code-frame-dots i {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--moss);
  box-shadow: 0 0 18px color-mix(in srgb, var(--moss), transparent 40%);
}

.code-frame-dots i:nth-child(2) {
  background: var(--water);
}

.code-frame-dots i:nth-child(3) {
  background: var(--gold);
}

.code-frame-title {
  min-width: 0;
  color: var(--text);
  font-size: 12px;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.code-frame-meta {
  color: var(--muted);
  border: 1px solid rgb(255 255 255 / .10);
  border-radius: 999px;
  padding: 5px 8px;
  background: rgb(0 0 0 / .22);
  font-family: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace;
  font-size: 11px;
  text-transform: uppercase;
}

.code-frame-actions {
  display: inline-flex;
  gap: 6px;
}

.code-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  border: 1px solid rgb(255 255 255 / .12);
  border-radius: 12px;
  color: var(--text);
  background: rgb(255 255 255 / .055);
  padding: 0 10px;
  font: inherit;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
  transition:
    transform .16s ease,
    border-color .16s ease,
    background .16s ease,
    color .16s ease;
}

.code-action:hover {
  transform: translateY(-1px);
  border-color: var(--line-strong);
  background: rgb(255 255 255 / .10);
}

.code-action[aria-pressed="true"],
.code-action.copied {
  color: #06110c;
  border-color: transparent;
  background: linear-gradient(135deg, var(--moss), var(--water));
}

.code-frame[data-wrap="true"] pre code {
  width: 100%;
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.code-stack,
.examples,
.example-block {
  min-width: 0;
}

.examples {
  margin-top: 16px;
  border-top: 1px solid var(--line);
  padding-top: 14px;
}

.examples summary {
  cursor: pointer;
  color: var(--moss);
  font-weight: 900;
}

.example-block {
  margin-top: 14px;
}

.example-group {
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 12px;
  background: rgb(0 0 0 / .18);
  margin-bottom: 10px;
}

.example-group strong {
  color: var(--moss);
}

.example-group p,
.example-comment {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.58;
  white-space: pre-line;
  margin: 8px 0 0;
}

.example-block header {
  display: flex;
  gap: 8px;
  justify-content: space-between;
  align-items: baseline;
  color: var(--muted);
  font-size: 12px;
  min-width: 0;
}

.example-block header strong {
  color: var(--text);
}

.example-block header span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-layout {
  width: min(1420px, calc(100% - 28px));
  margin: 0 auto;
  padding: clamp(18px, 4vw, 42px) 0;
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 18px;
  position: relative;
}

.doc-sidebar {
  position: sticky;
  top: 16px;
  align-self: start;
  max-height: calc(100dvh - 32px);
  overflow: auto;
  border-radius: 26px;
  padding: 16px;
  background: linear-gradient(180deg, var(--panel-strong), rgb(0 0 0 / .18));
}

.code-sidebar {
  background:
    linear-gradient(180deg, rgb(15 23 42 / .88), rgb(2 6 23 / .68)),
    radial-gradient(circle at 0% 0%, rgb(56 189 248 / .16), transparent 18rem);
}

.brand {
  display: inline-flex;
  text-decoration: none;
  font-weight: 900;
  color: var(--moss);
  margin-bottom: 14px;
}

.search-box {
  display: grid;
  gap: 8px;
  color: var(--muted);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: .16em;
  font-weight: 900;
  margin-bottom: 14px;
}

.search-box input {
  width: 100%;
  min-height: 44px;
  border-radius: 16px;
  border: 1px solid var(--line);
  color: var(--text);
  background: rgb(0 0 0 / .28);
  padding: 0 12px;
  font: inherit;
  font-size: 16px;
  outline: none;
}

.search-box input:focus {
  border-color: var(--moss);
}

.side-list {
  display: grid;
  gap: 8px;
}

.toc {
  display: grid;
  gap: 2px;
  margin-top: 18px;
  border-top: 1px solid var(--line);
  padding-top: 14px;
}

.toc p {
  margin: 0 0 8px;
  color: var(--moss);
  font-weight: 900;
}

.toc a {
  color: var(--muted);
  text-decoration: none;
  padding: 7px 6px;
  border-radius: 10px;
}

.toc a:hover {
  color: var(--text);
  background: rgb(255 255 255 / .06);
}

.toc-level-3 {
  padding-left: 18px !important;
}

.doc-page {
  min-width: 0;
  border-radius: clamp(24px, 5vw, 40px);
  background: linear-gradient(145deg, var(--panel), rgb(0 0 0 / .18));
  padding: clamp(20px, 5vw, 58px);
}

.code-doc-page {
  background:
    linear-gradient(145deg, rgb(15 23 42 / .78), rgb(2 6 23 / .54)),
    radial-gradient(circle at 100% 0%, rgb(56 189 248 / .14), transparent 22rem);
}

.back-link {
  display: inline-flex;
  margin-bottom: 18px;
  color: var(--moss);
  text-decoration: none;
  font-weight: 900;
}

.markdown-body {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  color: var(--muted);
  font-size: clamp(15px, 1.8vw, 18px);
  line-height: 1.75;
  overflow-wrap: break-word;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4 {
  color: var(--text);
  background: none;
  -webkit-text-fill-color: currentColor;
  font-family: Inter, system-ui, sans-serif;
  letter-spacing: -.04em;
  line-height: 1.08;
  margin: 1.5em 0 .55em;
}

.markdown-body h1 {
  font-size: clamp(36px, 7vw, 76px);
}

.markdown-body h2 {
  font-size: clamp(28px, 5vw, 48px);
}

.markdown-body h3 {
  font-size: clamp(22px, 3vw, 32px);
}

.markdown-body p,
.markdown-body li {
  max-width: 78ch;
}

.markdown-body a {
  color: var(--water);
  text-decoration-thickness: 2px;
}

.markdown-body blockquote {
  margin: 22px 0;
  padding: 14px 18px;
  border-left: 4px solid var(--moss);
  border-radius: 16px;
  background: rgb(168 255 96 / .08);
}

.markdown-body ul,
.markdown-body ol {
  padding-left: 1.2em;
}

.markdown-body li + li {
  margin-top: 8px;
}

.markdown-body hr {
  border: 0;
  border-top: 1px solid var(--line);
  margin: 28px 0;
}

.markdown-body code:not(pre code) {
  color: var(--moss);
  background: rgb(0 0 0 / .32);
  padding: .15em .35em;
  border-radius: .45em;
  font-size: .92em;
}

.markdown-body .code-frame {
  margin: 22px 0;
}

.markdown-body .code-frame pre code {
  font-size: inherit;
  line-height: 1.65;
}

.table-wrap {
  width: 100%;
  max-width: 100%;
  margin: 24px 0;
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: rgb(0 0 0 / .18);
  -webkit-overflow-scrolling: touch;
}

.markdown-body table {
  width: 100%;
  min-width: 640px;
  border-collapse: collapse;
  font-size: .94em;
}

.markdown-body th,
.markdown-body td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
  border-right: 1px solid var(--line);
  vertical-align: top;
}

.markdown-body th:last-child,
.markdown-body td:last-child {
  border-right: 0;
}

.markdown-body tr:last-child td {
  border-bottom: 0;
}

.markdown-body th {
  color: var(--text);
  background: rgb(255 255 255 / .065);
  font-weight: 900;
}

.markdown-body td {
  color: var(--muted);
}

.code-page-frame {
  margin-top: 24px;
}

.code-page-frame pre code {
  font-size: 13px;
  line-height: 1.62;
}

.sidebar-toggle {
  display: none;
  position: fixed;
  z-index: 60;
  left: 12px;
  top: calc(12px + env(safe-area-inset-top, 0px));
  width: 46px;
  height: 46px;
  border: 1px solid var(--line-strong);
  border-radius: 16px;
  color: var(--text);
  background: rgb(0 0 0 / .55);
  box-shadow: 0 16px 48px rgb(0 0 0 / .36);
  backdrop-filter: blur(18px) saturate(160%);
  font: inherit;
  font-size: 22px;
  font-weight: 900;
}

.sidebar-scrim {
  display: none;
}

@keyframes drift {
  from {
    transform: translate3d(0, 0, 0) scale(1);
  }

  to {
    transform: translate3d(4rem, -2rem, 0) scale(1.14);
  }
}

@media (max-width: 980px) {
  .sidebar-toggle {
    display: inline-grid;
    place-items: center;
  }

  .sidebar-scrim {
    position: fixed;
    z-index: 45;
    inset: 0;
    display: block;
    opacity: 0;
    pointer-events: none;
    background: rgb(0 0 0 / .54);
    backdrop-filter: blur(4px);
    transition: opacity .18s ease;
  }

  .sidebar-open .sidebar-scrim {
    opacity: 1;
    pointer-events: auto;
  }

  .doc-layout {
    width: min(100% - 18px, 1420px);
    grid-template-columns: 1fr;
    padding-top: calc(72px + env(safe-area-inset-top, 0px));
  }

  .doc-sidebar {
    position: fixed;
    z-index: 50;
    left: max(10px, env(safe-area-inset-left, 0px));
    top: calc(70px + env(safe-area-inset-top, 0px));
    bottom: max(10px, env(safe-area-inset-bottom, 0px));
    width: min(86vw, 360px);
    max-height: none;
    transform: translateX(calc(-100% - 22px));
    transition: transform .22s ease;
  }

  .sidebar-open .doc-sidebar {
    transform: translateX(0);
  }

  .doc-page {
    border-radius: 26px;
  }
}

@media (max-width: 860px) {
  .architecture {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .code-frame-bar {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .code-frame-meta {
    display: none;
  }
}

@media (max-width: 620px) {
  .shell {
    width: min(100% - 20px, 1220px);
  }

  .architecture {
    grid-template-columns: 1fr;
  }

  .card-top {
    align-items: flex-start;
    flex-direction: column;
  }

  .card-top code {
    max-width: 100%;
  }

  .doc-layout {
    width: min(100% - 18px, 1420px);
  }

  .markdown-body table {
    min-width: 560px;
  }

  .code-frame-bar {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .code-frame-actions {
    grid-column: 1 / -1;
    width: 100%;
  }

  .code-action {
    flex: 1;
    justify-content: center;
  }

  .code-page-frame pre code {
    font-size: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .canopy,
  .doc-sidebar,
  .sidebar-scrim,
  .code-action {
    animation: none;
    transition: none;
  }
}`;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
