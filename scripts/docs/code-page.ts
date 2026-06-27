import type { CodePageInput, GeneratedCodePage } from "./doc-types";
import { createCodeFrame } from "./code-frame";
import { escapeHtml } from "./html-utils";
import { createBackdrop, createHead, createScripts } from "./page-shell";

export function createCodePageHtml(input: CodePageInput): string {
  const title = escapeHtml(input.title);
  const language = escapeHtml(input.language || "plaintext");
  const label = input.kind === "pipeline" ? "Pipeline" : input.kind === "test" ? "Tests" : "Source";

  return `<!doctype html>
<html lang="en">
<head>
${createHead(`${input.title} · Rod ${label}`, "..")}
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
  ${createScripts("..")}
</body>
</html>`;
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
