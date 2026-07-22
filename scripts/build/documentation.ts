import fs from "node:fs/promises";
import path from "node:path";
import { build as viteBuild } from "vite";
import type { RootEntry } from "../config";
import { DIST_DIR, ROOT_DIR, WORKSPACE_PACKAGES } from "../config";
import {
  createCodePageHtml,
  createIndexHtml,
  createMarkdownPageHtml,
  type BenchmarkSummary,
  type GeneratedCodePage,
  type GeneratedDoc,
  type PackageTheme,
} from "../create-index-html";
import type { SourceExample } from "../example-extractor";
import { createBenchmarkDashboardHtml } from "../benchmark/dashboard";
import type { BenchmarkReportFile } from "../benchmark/types";
import { createDocumentationSiteConfig } from "../vite/shared-config";

const TEXT_PAGE_MAX_BYTES = 320_000;
const PORTAL_STAGING_DIR = path.join(ROOT_DIR, ".cache", "docs-site");
const DOCS_DIR = path.join(PORTAL_STAGING_DIR, "docs");
const SOURCE_DIR = path.join(PORTAL_STAGING_DIR, "source");
const TESTS_DIR = path.join(PORTAL_STAGING_DIR, "tests");
const PIPELINE_DIR = path.join(PORTAL_STAGING_DIR, "pipeline");
const BENCHMARK_DIR = path.join(PORTAL_STAGING_DIR, "benchmarks");
const ASSETS_DIR = path.join(PORTAL_STAGING_DIR, "assets");

export type DocumentationBuildResult = {
  readonly docs: GeneratedDoc[];
  readonly sources: GeneratedCodePage[];
  readonly tests: GeneratedCodePage[];
  readonly pipelines: GeneratedCodePage[];
  readonly benchmarks: BenchmarkSummary[];
};

type TextFile = {
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly content: string;
};

export async function buildDocumentationPortal(input: {
  entries: RootEntry[];
  outputs: string[];
  namespace: string;
  examples: Record<string, SourceExample[]>;
}): Promise<DocumentationBuildResult> {
  await fs.rm(PORTAL_STAGING_DIR, { recursive: true, force: true });
  await fs.mkdir(PORTAL_STAGING_DIR, { recursive: true });

  const markdownFiles = await collectMarkdownFiles();
  const docs = await writeMarkdownDocs(markdownFiles);

  const benchmarkFiles = await collectFiles((relativePath) => isBenchmarkFile(relativePath));
  const benchmarkReports = readBenchmarkReports(benchmarkFiles);
  const benchmarkPages = await writeCodePages("benchmark", benchmarkFiles, BENCHMARK_DIR, []);
  const benchmarks = createBenchmarkSummaries(benchmarkFiles, benchmarkPages, benchmarkReports);
  await writeBenchmarkDashboard(benchmarkReports);

  const sourceFiles = await collectFiles((relativePath) => isSourceFile(relativePath));
  const sources = await writeCodePages("source", sourceFiles, SOURCE_DIR, benchmarks);

  const testFiles = await collectFiles((relativePath) => isTestFile(relativePath));
  const tests = await writeCodePages("test", testFiles, TESTS_DIR, benchmarks);

  const pipelineFiles = await collectFiles((relativePath) => isPipelineFile(relativePath));
  const pipelines = await writeCodePages("pipeline", pipelineFiles, PIPELINE_DIR, benchmarks);

  await Promise.all([
    copyDocsAssets(),
    fs.writeFile(path.join(PORTAL_STAGING_DIR, "index.html"), createIndexHtml({
      entries: input.entries,
      outputs: input.outputs,
      namespace: input.namespace,
      examples: input.examples,
      docs,
      sources,
      tests,
      pipelines,
      benchmarks,
    })),
  ]);

  const htmlInput = await collectHtmlInputs(PORTAL_STAGING_DIR);
  await viteBuild(createDocumentationSiteConfig({
    root: PORTAL_STAGING_DIR,
    outDir: DIST_DIR,
    input: htmlInput,
  }));
  await fs.rm(PORTAL_STAGING_DIR, { recursive: true, force: true });

  return { docs, sources, tests, pipelines, benchmarks };
}

async function writeMarkdownDocs(files: TextFile[]): Promise<GeneratedDoc[]> {
  const docs = files.map(createGeneratedDoc);
  await fs.mkdir(DOCS_DIR, { recursive: true });

  await Promise.all(files.map(async (file, index) => {
    const doc = docs[index]!;
    await fs.writeFile(path.join(DOCS_DIR, `${doc.slug}.html`), createMarkdownPageHtml({
      title: doc.title,
      sourcePath: doc.sourcePath,
      displayPath: doc.displayPath,
      markdown: file.content,
      navItems: docs,
      benchmarks: [],
      packageId: doc.packageId,
      description: doc.description,
      href: doc.href,
    }));
  }));

  return docs;
}

async function writeCodePages(kind: GeneratedCodePage["kind"], files: TextFile[], outputDir: string, benchmarks: BenchmarkSummary[]): Promise<GeneratedCodePage[]> {
  const pages = files.map((file) => createGeneratedCodePage(kind, file));
  await fs.mkdir(outputDir, { recursive: true });

  await Promise.all(files.map(async (file, index) => {
    const page = pages[index]!;
    await fs.writeFile(path.join(outputDir, `${page.slug}.html`), createCodePageHtml({
      title: page.title,
      sourcePath: page.sourcePath,
      displayPath: page.displayPath,
      code: file.content,
      language: page.language,
      navItems: pages,
      kind,
      benchmarks,
      packageId: page.packageId,
      description: page.description,
      href: page.href,
    }));
  }));

  return pages;
}

async function collectMarkdownFiles(): Promise<TextFile[]> {
  return collectFiles((relativePath) => relativePath.toLowerCase().endsWith(".md"));
}

async function collectFiles(predicate: (relativePath: string) => boolean): Promise<TextFile[]> {
  const files: TextFile[] = [];
  await walk(ROOT_DIR, files, predicate);
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

async function walk(directory: string, files: TextFile[], predicate: (relativePath: string) => boolean): Promise<void> {
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = toPosix(path.relative(ROOT_DIR, absolutePath));

    if (entry.isDirectory()) {
      if (shouldSkipDirectory(relativePath, entry.name)) continue;
      await walk(absolutePath, files, predicate);
      continue;
    }

    if (!entry.isFile() || !predicate(relativePath)) continue;

    const stat = await fs.stat(absolutePath);
    if (stat.size > TEXT_PAGE_MAX_BYTES) continue;

    files.push({ absolutePath, relativePath, content: await fs.readFile(absolutePath, "utf8") });
  }
}

function shouldSkipDirectory(relativePath: string, name: string): boolean {
  if ([".git", "node_modules", "dist", "zip", ".cache", "coverage"].includes(name)) return true;
  return relativePath.startsWith(".github/actions/");
}

function isSourceFile(relativePath: string): boolean {
  if (!/\.(?:ts|tsx|js|jsx|mjs|css|html)$/.test(relativePath)) return false;
  if (isTestFile(relativePath) || isBenchmarkFile(relativePath) || isPipelineFile(relativePath)) return false;
  const packageName = relativePath.split("/")[0];
  return (WORKSPACE_PACKAGES as readonly string[]).includes(packageName ?? "");
}

function isTestFile(relativePath: string): boolean {
  return /(?:^|\/)(?:test|tests)\//.test(relativePath) || /\.(?:test|spec)\.(?:ts|tsx|js|jsx)$/.test(relativePath);
}

function isBenchmarkFile(relativePath: string): boolean {
  return relativePath.startsWith("bench/") || /\.bench\.(?:ts|tsx|js|jsx|json)$/.test(relativePath) || /benchmark[^/]*\.json$/i.test(relativePath);
}

function isPipelineFile(relativePath: string): boolean {
  return relativePath.startsWith(".github/workflows/")
    || relativePath.startsWith("scripts/workflows/")
    || relativePath === "package.json"
    || relativePath === "pnpm-workspace.yaml";
}

function createGeneratedDoc(file: TextFile): GeneratedDoc {
  const packageId = packageFromPath(file.relativePath);
  const title = titleFromMarkdown(file.content) || titleFromPath(file.relativePath);
  const slug = slugFromPath(file.relativePath);
  return {
    title,
    slug,
    sourcePath: file.relativePath,
    displayPath: displayPathFromPath(file.relativePath),
    href: `docs/${slug}.html`,
    kind: /(?:^|\/)readme\.md$/i.test(file.relativePath) ? "readme" : "markdown",
    packageId,
    description: descriptionFromMarkdown(file.content),
  };
}

function createGeneratedCodePage(kind: GeneratedCodePage["kind"], file: TextFile): GeneratedCodePage {
  const report = kind === "benchmark" ? parseBenchmarkReport(file.content) : null;
  const slug = report ? `benchmark-${report.suite.id}` : slugFromPath(file.relativePath);
  return {
    title: titleFromPath(file.relativePath),
    slug,
    href: `${kind === "test" ? "tests" : kind === "source" ? "source" : kind === "pipeline" ? "pipeline" : "benchmarks"}/${slug}.html`,
    sourcePath: file.relativePath,
    displayPath: displayPathFromPath(file.relativePath),
    language: languageFromPath(file.relativePath),
    kind,
    packageId: packageFromPath(file.relativePath),
    description: descriptionFromCodePath(kind, file.relativePath),
  };
}

function createBenchmarkSummaries(files: TextFile[], pages: GeneratedCodePage[], reports: BenchmarkReportFile[]): BenchmarkSummary[] {
  const summaries: BenchmarkSummary[] = files.flatMap<BenchmarkSummary>((file, index) => {
    const report = parseBenchmarkReport(file.content);
    const page = pages[index];
    if (!report || !page) return [];

    return [{
      id: page.slug,
      title: report.suite.label || page.title,
      href: page.href,
      sourcePath: page.sourcePath,
      displayPath: page.displayPath,
      packageId: page.packageId,
      generatedAt: report.generatedAt,
      geometricMeanPercent: report.comparison.geometricMeanPercent ?? undefined,
      absoluteGeometricMeanPercent: report.comparison.absoluteGeometricMeanPercent ?? undefined,
      faster: report.comparison.faster,
      slower: report.comparison.slower,
      stable: report.comparison.stable,
      unstable: report.comparison.unstable,
    } satisfies BenchmarkSummary];
  });

  if (reports.length > 0) {
    summaries.push({
      id: "benchmark-dashboard",
      title: "Benchmark Dashboard",
      href: "benchmarks/index.html",
      sourcePath: "bench/index.html",
      displayPath: "Benchmarks / Dashboard",
      packageId: "benchmark",
      generatedAt: reports[0]?.generatedAt,
      geometricMeanPercent: geometricMean(reports.map((report) => report.comparison.geometricMeanPercent).filter(isNumber)),
      absoluteGeometricMeanPercent: geometricMean(reports.map((report) => report.comparison.absoluteGeometricMeanPercent).filter(isNumber)),
      faster: reports.reduce((sum, report) => sum + report.comparison.faster, 0),
      slower: reports.reduce((sum, report) => sum + report.comparison.slower, 0),
      stable: reports.reduce((sum, report) => sum + report.comparison.stable, 0),
      unstable: reports.reduce((sum, report) => sum + report.comparison.unstable, 0),
    });
  }

  return summaries.sort((left, right) => left.title.localeCompare(right.title));
}

function readBenchmarkReports(files: TextFile[]): BenchmarkReportFile[] {
  return files
    .map((file) => parseBenchmarkReport(file.content))
    .filter((report): report is BenchmarkReportFile => report !== null)
    .sort((left, right) => left.suite.id.localeCompare(right.suite.id));
}

function parseBenchmarkReport(content: string): BenchmarkReportFile | null {
  try {
    const value: unknown = JSON.parse(content);
    if (!isRecord(value) || value.schemaVersion !== 2 || !isRecord(value.suite) || !isRecord(value.current) || !isRecord(value.comparison)) return null;
    return value as BenchmarkReportFile;
  } catch {
    return null;
  }
}

async function writeBenchmarkDashboard(reports: BenchmarkReportFile[]): Promise<void> {
  if (reports.length === 0) return;
  await fs.mkdir(BENCHMARK_DIR, { recursive: true });
  await fs.writeFile(path.join(BENCHMARK_DIR, "index.html"), createBenchmarkDashboardHtml(reports));
}

function geometricMean(values: number[]): number | undefined {
  const valid = values.map((value) => 1 + value / 100).filter((value) => Number.isFinite(value) && value > 0);
  if (valid.length === 0) return undefined;
  return (Math.exp(valid.reduce((sum, value) => sum + Math.log(value), 0) / valid.length) - 1) * 100;
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function collectHtmlInputs(root: string): Promise<Record<string, string>> {
  const input: Record<string, string> = {};

  async function walk(directory: string): Promise<void> {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
      const relativePath = toPosix(path.relative(root, absolutePath));
      input[relativePath.replace(/\.html$/, "")] = absolutePath;
    }
  }

  await walk(root);
  return input;
}

async function copyDocsAssets(): Promise<void> {
  await fs.mkdir(ASSETS_DIR, { recursive: true });
  await Promise.all([
    fs.copyFile(path.join(ROOT_DIR, "scripts/docs/docs.css"), path.join(ASSETS_DIR, "docs.css")),
    fs.copyFile(path.join(ROOT_DIR, "scripts/docs/docs-client.js"), path.join(ASSETS_DIR, "docs-client.js")),
  ]);
}

function titleFromMarkdown(markdown: string): string {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "";
}

function descriptionFromMarkdown(markdown: string): string | undefined {
  const paragraph = markdown
    .replace(/^---[\s\S]*?---\s*/m, "")
    .split(/\n\s*\n/)
    .map((block) => block.replace(/^#+\s+.*$/gm, "").trim())
    .find((block) => block && !block.startsWith("```") && !block.startsWith("!["));
  return paragraph?.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1").replace(/[*_`>#]/g, "").replace(/\s+/g, " ").slice(0, 180);
}

function titleFromPath(relativePath: string): string {
  const base = path.basename(relativePath).replace(/\.(?:d\.)?[a-z0-9]+$/i, "");
  return humanizeSegment(base === "index" ? path.basename(path.dirname(relativePath)) : base);
}

function displayPathFromPath(relativePath: string): string {
  return toPosix(relativePath);
}

function slugFromPath(relativePath: string): string {
  return toPosix(relativePath).replace(/\.[^.\/]+$/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function packageFromPath(relativePath: string): PackageTheme {
  const normalized = relativePath.toLowerCase();
  if (normalized.startsWith("fabrica-elements/")) return "fabrica-elements";
  if (normalized.startsWith("fabrica/")) return "fabrica";
  if (normalized.startsWith("cipo/")) return "cipo";
  if (normalized.startsWith("broto/")) return "broto";
  if (normalized.startsWith(".github/") || normalized.startsWith("scripts/workflows/")) return "pipeline";
  if (isBenchmarkFile(normalized)) return "benchmark";
  return "default";
}

function humanizeSegment(value: string): string {
  return value.replace(/[-_.]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function descriptionFromCodePath(kind: GeneratedCodePage["kind"], relativePath: string): string {
  const label = kind === "source" ? "Source" : kind === "test" ? "Test" : kind === "pipeline" ? "Pipeline" : "Benchmark";
  return `${label} view for ${displayPathFromPath(relativePath)}.`;
}

function languageFromPath(relativePath: string): string {
  const extension = path.extname(relativePath).toLowerCase();
  return ({
    ".ts": "typescript",
    ".tsx": "tsx",
    ".js": "javascript",
    ".jsx": "jsx",
    ".mjs": "javascript",
    ".json": "json",
    ".css": "css",
    ".html": "html",
    ".yml": "yaml",
    ".yaml": "yaml",
  } as Record<string, string>)[extension] ?? "plaintext";
}

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}
