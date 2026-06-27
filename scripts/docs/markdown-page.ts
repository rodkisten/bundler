import type { GeneratedDoc, Heading, MarkdownPageInput } from "./doc-types";
import { escapeHtml } from "./html-utils";
import { renderMarkdown } from "./markdown-renderer";
import { createBackdrop, createHead, createScripts } from "./page-shell";

export function createMarkdownPageHtml(input: MarkdownPageInput): string {
  const rendered = renderMarkdown(input.markdown);
  const title = escapeHtml(input.title);

  return `<!doctype html>
<html lang="en">
<head>
${createHead(`${input.title} · Rod Docs`, "..")}
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
  ${createScripts("..")}
</body>
</html>`;
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
