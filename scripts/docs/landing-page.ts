import type { RootEntry } from "../config";
import type { SourceExample } from "../example-extractor";
import type { GeneratedCodePage, GeneratedDoc, LandingInput } from "./doc-types";
import { createCodeFrame } from "./code-frame";
import { escapeHtml } from "./html-utils";
import { createBackdrop, createHead, createScripts } from "./page-shell";

export function createIndexHtml(input: LandingInput): string {
  const cards = input.entries
    .map((entry) => createToolCard(entry, input.outputs, input.examples?.[entry.name] || []))
    .join("\n");

  const docs = input.docs || [];
  const sources = input.sources || [];
  const tests = input.tests || [];
  const pipelines = input.pipelines || [];

  return `<!doctype html>
<html lang="en">
<head>
${createHead("Rod Browser Tools", ".")}
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
        <span><strong>${input.entries.length}</strong> tools</span>
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
  ${createScripts(".")}
</body>
</html>`;
}

function createArchitectureMap(): string {
  const groups = [
    ["Broto", "signal · computed · effect · batch · store · graph · scheduler · resources"],
    ["Fábrica", "html · parser · renderer · directives · DOM parts · components · hydration"],
    ["Fabrica Elements", "createElement · adapters · props · refs · children · wrappers"],
    ["Cipó", "css runtime · aliases · tokens · atomic engine · stylesheet compiler"],
  ] as const;

  return groups
    .map(([name, body]) => `<article><strong>${escapeHtml(name)}</strong><span>${escapeHtml(body)}</span></article>`)
    .join("");
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
