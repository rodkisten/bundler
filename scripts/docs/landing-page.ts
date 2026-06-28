import type { RootEntry } from "../config";
import type { SourceExample } from "../example-extractor";
import type { BenchmarkSummary, GeneratedCodePage, GeneratedDoc, LandingInput, PackageTheme } from "./doc-types";
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
  const benchmarks = input.benchmarks || [];

  return `<!doctype html>
<html lang="en">
<head>
${createHead("Rod Browser Tools", ".")}
</head>
<body data-page-kind="landing" data-package="default">
  ${createBackdrop()}
  <main class="shell">
    <section class="hero surface">
      <p class="eyebrow">Rod ecosystem · browser runtime</p>
      <h1>Browser tools with docs that feel alive.</h1>
      <p class="lede">A mobile-first bundle system for Broto, Fábrica, Fabrica Elements and Cipó, with generated API docs, source maps, tests, benchmarks and publishing metadata.</p>
      <div class="architecture" aria-label="Architecture overview">
        ${createArchitectureMap()}
      </div>
      <div class="stats">
        <span><strong>${input.entries.length}</strong> tools</span>
        <span><strong>${docs.length}</strong> docs</span>
        <span><strong>${tests.length}</strong> tests</span>
        <span><strong>${sources.length}</strong> source pages</span>
        <span><strong>${benchmarks.length}</strong> benchmarks</span>
        <span><strong>IIFE</strong> normal + min</span>
      </div>
    </section>
    ${createBenchmarkSection(benchmarks)}
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
  const groups: Array<[PackageTheme, string, string]> = [
    ["broto", "Broto", "signals · computed · effect · batch · store · graph · resources"],
    ["fabrica", "Fábrica", "html · renderer · DOM parts · directives · components · hydration"],
    ["fabrica-elements", "Fabrica Elements", "createElement · adapters · props · refs · children · wrappers"],
    ["cipo", "Cipó", "CSS runtime · aliases · tokens · atomic engine · stylesheet compiler"],
  ];

  return groups
    .map(([packageId, name, body]) => `<article data-package="${escapeHtml(packageId)}"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(body)}</span></article>`)
    .join("");
}

function createBenchmarkSection(items: BenchmarkSummary[]): string {
  if (items.length === 0) return "";

  const cards = items
    .slice(0, 12)
    .map((item) => {
      const delta = typeof item.geometricMeanPercent === "number" ? formatSignedPercent(item.geometricMeanPercent) : "n/a";
      const stable = typeof item.stable === "number" ? String(item.stable) : "0";

      return `<a class="benchmark-card" data-package="${escapeHtml(item.packageId)}" href="./${escapeHtml(item.href)}">
        <span class="benchmark-title">${escapeHtml(item.title)}</span>
        <span class="benchmark-path">${escapeHtml(item.displayPath)}</span>
        <span class="benchmark-metrics"><strong>${escapeHtml(delta)}</strong><em>${escapeHtml(stable)} stable</em></span>
      </a>`;
    })
    .join("");

  return `<section class="portal-section benchmark-section surface" id="benchmarks">
    <div>
      <p class="eyebrow">Benchmarks</p>
      <h2>Performance snapshots published beside the docs.</h2>
    </div>
    <div class="benchmark-grid">${cards}</div>
  </section>`;
}

function createPortalSection(title: string, description: string, items: Array<GeneratedDoc | GeneratedCodePage>): string {
  if (items.length === 0) return "";

  const links = items
    .slice(0, 24)
    .map((item) => `<a data-package="${escapeHtml(item.packageId)}" href="./${escapeHtml(item.href)}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.displayPath)}</span></a>`)
    .join("");

  const more = items.length > 24 ? `<p class="portal-more">+${items.length - 24} more items available in generated pages.</p>` : "";

  return `<section class="portal-section surface">
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
  const packageId = packageFromEntry(entry);

  const links = files
    .filter((file) => file.endsWith(".js"))
    .map((file) => `<a href="./${escapeHtml(file)}">${escapeHtml(file)}</a>`)
    .join("");

  const requireLine = `// @require https://OWNER.github.io/REPO/${entry.name}.iife.js\nconst ${entry.globalName} = window.${entry.globalName};`;
  const tags = entry.tool.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  const exampleBlocks = examples.slice(0, 8).map((example) => createExampleBlock(example, packageId)).join("");

  return `      <article class="card searchable-content surface" data-package="${escapeHtml(packageId)}">
        <div class="card-top">
          <p class="tool-name">${escapeHtml(entry.tool.name)}</p>
          <code>window.${escapeHtml(entry.globalName)}</code>
        </div>
        <p class="description">${escapeHtml(entry.tool.description)}</p>
        <div class="tags">${tags || "<span>browser</span><span>iife</span>"}</div>
        <div class="links">${links}</div>
        <div class="code-stack">
          ${createCodeFrame({ code: requireLine, language: "js", title: "Userscript require", tone: "source", packageId })}
        </div>
        ${exampleBlocks ? `<details class="examples"><summary>Examples from source comments</summary>${exampleBlocks}</details>` : ""}
      </article>`;
}

function createExampleBlock(example: SourceExample, packageId: PackageTheme): string {
  return `<section class="example-block" data-group="${escapeHtml(example.groupId)}">
    ${example.isFirstInGroup && example.groupComment ? `<div class="example-group"><strong>${escapeHtml(example.groupTitle)}</strong><p>${escapeHtml(example.groupComment)}</p></div>` : ""}
    <header><strong>${escapeHtml(example.title)}</strong><span>${escapeHtml(example.file)}</span></header>
    ${example.comment ? `<p class="example-comment">${escapeHtml(example.comment)}</p>` : ""}
    ${createCodeFrame({ code: example.code, language: "ts", title: example.title, tone: "test", packageId })}
  </section>`;
}

function packageFromEntry(entry: RootEntry): PackageTheme {
  const value = `${entry.name} ${entry.relativePath}`.toLowerCase();
  if (value.includes("fabrica-elements")) return "fabrica-elements";
  if (value.includes("fabrica")) return "fabrica";
  if (value.includes("cipo")) return "cipo";
  if (value.includes("broto")) return "broto";
  if (value.includes("index")) return "index";
  return "default";
}

function formatSignedPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}
