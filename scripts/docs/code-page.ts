import type { BenchmarkSummary, CodePageInput, GeneratedCodePage } from "./doc-types";
import { createCodeFrame } from "./code-frame";
import { escapeHtml } from "./html-utils";
import { createBackdrop, createHead, createScripts } from "./page-shell";

export function createCodePageHtml(input: CodePageInput): string {
  const title = escapeHtml(input.title);
  const language = escapeHtml(input.language || "plaintext");
  const label = input.kind === "pipeline" ? "Pipeline" : input.kind === "test" ? "Tests" : input.kind === "benchmark" ? "Benchmarks" : "Source";
  const packageId = input.packageId || "default";

  return `<!doctype html>
<html lang="en">
<head>
${createHead(`${input.title} · Rod ${label}`, "..")}
</head>
<body data-page-kind="code" data-code-kind="${escapeHtml(input.kind)}" data-package="${escapeHtml(packageId)}">
  ${createBackdrop()}
  <button class="sidebar-toggle" type="button" data-sidebar-toggle aria-label="Open navigation" aria-expanded="false">☰</button>
  <div class="sidebar-scrim" data-sidebar-close aria-hidden="true"></div>
  <main class="doc-layout code-layout">
    ${createCodeSidebar(label, input.navItems, input.sourcePath, input.benchmarks || [])}
    <article class="doc-page code-doc-page searchable-content surface">
      <a class="back-link" href="../index.html">← Home</a>
      <p class="eyebrow">${escapeHtml(label)} · ${escapeHtml(input.displayPath)}</p>
      <h1>${title}</h1>
      ${input.description ? `<p class="page-description">${escapeHtml(input.description)}</p>` : ""}
      ${createCodeFrame({
        code: input.code,
        language,
        title: input.displayPath,
        tone: input.kind,
        className: "code-page-frame",
        packageId,
      })}
    </article>
  </main>
  ${createScripts("..")}
</body>
</html>`;
}

function createCodeSidebar(title: string, items: GeneratedCodePage[], currentPath: string, benchmarks: BenchmarkSummary[]): string {
  const itemLinks = items
    .map((item) => `<a data-package="${escapeHtml(item.packageId)}" class="${item.sourcePath === currentPath ? "active" : ""}" href="../${escapeHtml(item.href)}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.displayPath)}</span></a>`)
    .join("");

  return `<aside class="doc-sidebar code-sidebar surface" data-doc-sidebar>
    <a class="brand" href="../index.html">Rod ${escapeHtml(title)}</a>
    <label class="search-box"><span>Search</span><input data-doc-search type="search" placeholder="Search this file…" /></label>
    <nav class="side-list" aria-label="${escapeHtml(title)} navigation">${itemLinks}</nav>
    ${createBenchmarkSidebar(benchmarks)}
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
