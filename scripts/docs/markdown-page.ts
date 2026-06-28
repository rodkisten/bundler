import type { BenchmarkSummary, GeneratedDoc, Heading, MarkdownPageInput } from "./doc-types";
import { escapeHtml } from "./html-utils";
import { renderMarkdown } from "./markdown-renderer";
import { createBackdrop, createHead, createScripts } from "./page-shell";

export function createMarkdownPageHtml(input: MarkdownPageInput): string {
  const rendered = renderMarkdown(input.markdown);
  const title = escapeHtml(input.title);
  const packageId = input.packageId || "docs";

  return `<!doctype html>
<html lang="en">
<head>
${createHead(`${input.title} · Rod Docs`, "..")}
</head>
<body data-page-kind="markdown" data-package="${escapeHtml(packageId)}">
  ${createBackdrop()}
  <button class="sidebar-toggle" type="button" data-sidebar-toggle aria-label="Open navigation" aria-expanded="false">☰</button>
  <div class="sidebar-scrim" data-sidebar-close aria-hidden="true"></div>
  <main class="doc-layout">
    ${createDocSidebar("Docs", input.navItems, input.sourcePath, rendered.headings, input.benchmarks || [])}
    <article class="doc-page searchable-content surface">
      <a class="back-link" href="../index.html">← Home</a>
      <p class="eyebrow">Markdown · ${escapeHtml(input.displayPath)}</p>
      <h1>${title}</h1>
      ${input.description ? `<p class="page-description">${escapeHtml(input.description)}</p>` : ""}
      <div class="markdown-body">${rendered.html}</div>
    </article>
  </main>
  ${createScripts("..")}
</body>
</html>`;
}

function createDocSidebar(title: string, items: GeneratedDoc[], currentPath: string, headings: Heading[], benchmarks: BenchmarkSummary[]): string {
  const itemLinks = items
    .map((item) => `<a data-package="${escapeHtml(item.packageId)}" class="${item.sourcePath === currentPath ? "active" : ""}" href="../${escapeHtml(item.href)}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.displayPath)}</span></a>`)
    .join("");

  const headingLinks = headings
    .filter((heading) => heading.level <= 3)
    .slice(0, 48)
    .map((heading) => `<a class="toc-level-${heading.level}" href="#${escapeHtml(heading.id)}">${escapeHtml(heading.text)}</a>`)
    .join("");

  return `<aside class="doc-sidebar surface" data-doc-sidebar>
    <a class="brand" href="../index.html">Rod Docs</a>
    <label class="search-box"><span>Search</span><input data-doc-search type="search" placeholder="Find in docs…" /></label>
    <nav class="side-list" aria-label="${escapeHtml(title)} navigation">${itemLinks}</nav>
    ${createBenchmarkSidebar(benchmarks)}
    ${headingLinks ? `<nav class="toc" aria-label="Page table of contents"><p>On this page</p>${headingLinks}</nav>` : ""}
  </aside>`;
}

function createBenchmarkSidebar(benchmarks: BenchmarkSummary[]): string {
  if (benchmarks.length === 0) return "";

  const links = benchmarks
    .slice(0, 12)
    .map((item) => `<a data-package="${escapeHtml(item.packageId)}" href="../${escapeHtml(item.href)}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.displayPath)}</span></a>`)
    .join("");

  return `<nav class="side-list benchmark-side-list" aria-label="Benchmark navigation"><p>Benchmarks</p>${links}</nav>`;
}
