import fs from "node:fs/promises";
import path from "node:path";
import { build, type BuildOptions } from "esbuild";
import { createBenchmarkDashboardHtml } from "./benchmark/dashboard";
import type { BenchmarkReportFile } from "./benchmark/types";
import {
  createCodePageHtml,
  createIndexHtml,
  createMarkdownPageHtml,
  type BenchmarkSummary,
  type GeneratedCodePage,
  type GeneratedDoc,
  type PackageTheme,
} from "./create-index-html";
import { collectExamplesByEntry } from "./example-extractor";
import {
  DIST_DIR,
  ROOT_DIR,
  SRC_DIR,
  readBooleanEnv,
  readEnv,
  type RootEntry,
} from "./config";
import { discoverRootEntries } from "./discover-entries";

const GLOBAL_NAMESPACE = readEnv("BUILD_GLOBAL_NAMESPACE", "Rod");
const SHOULD_WRITE_META = readBooleanEnv("BUILD_META", true);

const DOCS_DIR = path.join(DIST_DIR, "docs");
const SOURCE_DIR = path.join(DIST_DIR, "source");
const TESTS_DIR = path.join(DIST_DIR, "tests");
const PIPELINE_DIR = path.join(DIST_DIR, "pipeline");
const BENCHMARK_DIR = path.join(DIST_DIR, "benchmarks");
const ASSETS_DIR = path.join(DIST_DIR, "assets");

const TEXT_PAGE_MAX_BYTES = 320_000;
const DEVTOOLS_ENTRY_NAME = "devtools";

export async function main(): Promise<void> {
  await fs.rm(DIST_DIR, { recursive: true, force: true });
  await fs.mkdir(DIST_DIR, { recursive: true });

  const discoveredEntries = await discoverRootEntries();
  const entries = filterBuildableRootEntries(discoveredEntries);

  if (entries.length === 0) {
    throw new Error("No buildable root entrypoints found. Expected src/index.ts, src/name.ts, or src/name/index.ts.");
  }

  const outputs: string[] = [];
  for (const entry of entries) {
    outputs.push(...(entry.name === DEVTOOLS_ENTRY_NAME ? await buildDevtoolsEntryWithVite(entry) : await buildEntry(entry)));
  }

  const examples = await collectExamplesByEntry(entries);
  const benchmarkFiles = await collectBenchmarkFiles();
  const benchmarkPages = await writeCodePages("benchmark", benchmarkFiles, BENCHMARK_DIR, []);
  const benchmarkReports = readBenchmarkReports(benchmarkFiles);
  await writeBenchmarkDashboard(benchmarkReports);
  const benchmarks = await createBenchmarkSummaries(benchmarkFiles, benchmarkPages, benchmarkReports);
  const docs = await writeMarkdownDocs(benchmarks);
  const sources = await writeCodePages("source", await collectSourceFiles(), SOURCE_DIR, benchmarks);
  const tests = await writeCodePages("test", await collectTestFiles(), TESTS_DIR, benchmarks);
  const pipelines = await writeCodePages("pipeline", await collectPipelineFiles(), PIPELINE_DIR, benchmarks);

  const manifest = createManifest(entries, outputs, {
    docs,
    sources,
    tests,
    pipelines,
    benchmarks,
  });

  await fs.writeFile(
    path.join(DIST_DIR, "manifest.json"),
    `${JSON.stringify({ ...manifest, examples }, null, 2)}\n`,
  );

  await fs.writeFile(
    path.join(DIST_DIR, "index.html"),
    createIndexHtml({
      entries,
      outputs,
      namespace: GLOBAL_NAMESPACE,
      examples,
      docs,
      sources,
      tests,
      pipelines,
      benchmarks,
    }),
  );

  await copyDocsAssets();
}

function filterBuildableRootEntries(entries: RootEntry[]): RootEntry[] {
  return entries.filter(isBuildableRootEntry);
}

function isBuildableRootEntry(entry: RootEntry): boolean {
  const relativePath = toPosix(entry.relativePath);
  if (!relativePath.startsWith("src/")) return false;
  if (relativePath.endsWith(".d.ts")) return false;

  const insideSrc = relativePath.slice("src/".length);
  const segments = insideSrc.split("/").filter(Boolean);

  if (segments.length === 1) return isSupportedScriptEntryFile(segments[0]!);
  if (segments.length === 2 && /^index\.(ts|tsx|js|jsx|mjs)$/.test(segments[1]!)) return true;

  return false;
}

function isSupportedScriptEntryFile(fileName: string): boolean {
  return /\.(ts|tsx|js|jsx|mjs)$/.test(fileName) && !fileName.endsWith(".d.ts");
}


async function buildDevtoolsEntryWithVite(entry: RootEntry): Promise<string[]> {
  const [{ build: viteBuild }, { cipoVite }] = await Promise.all([
    import("vite"),
    import("../src/cipo/src/vite"),
  ]);

  const banner = createBanner(entry);
  const normalIife = path.join(DIST_DIR, `${entry.name}.iife.js`);
  const minIife = path.join(DIST_DIR, `${entry.name}.iife.min.js`);

  const baseConfig = {
    configFile: false as const,
    root: ROOT_DIR,
    plugins: [cipoVite({ root: ROOT_DIR })],
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
    build: {
      emptyOutDir: false,
      sourcemap: true,
      target: "es2022",
      lib: {
        entry: entry.absolutePath,
        name: entry.globalName,
        formats: ["iife" as const],
      },
      rollupOptions: {
        output: {
          banner,
          extend: true,
        },
      },
    },
  };

  await viteBuild({
    ...baseConfig,
    build: {
      ...baseConfig.build,
      minify: false,
      outDir: DIST_DIR,
      lib: {
        ...baseConfig.build.lib,
        fileName: () => `${entry.name}.iife.js`,
      },
    },
  });

  await viteBuild({
    ...baseConfig,
    build: {
      ...baseConfig.build,
      minify: true,
      outDir: DIST_DIR,
      lib: {
        ...baseConfig.build.lib,
        fileName: () => `${entry.name}.iife.min.js`,
      },
    },
  });

  return [normalIife, minIife].map((file) => path.relative(DIST_DIR, file));
}

async function buildEntry(entry: RootEntry): Promise<string[]> {
  const banner = createBanner(entry);
  const baseOptions: BuildOptions = {
    entryPoints: [entry.absolutePath],
    bundle: true,
    platform: "browser",
    target: ["es2022"],
    jsx: "automatic",
    legalComments: "inline",
    sourcemap: true,
    charset: "utf8",
    logLevel: "info",
    metafile: SHOULD_WRITE_META,
    banner: { js: banner },
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
  };

  const normalIife = path.join(DIST_DIR, `${entry.name}.iife.js`);
  const minIife = path.join(DIST_DIR, `${entry.name}.iife.min.js`);

  const builds = [
    {
      file: normalIife,
      options: { ...baseOptions, format: "iife" as const, globalName: entry.globalName, outfile: normalIife, minify: false },
    },
    {
      file: minIife,
      options: { ...baseOptions, format: "iife" as const, globalName: entry.globalName, outfile: minIife, minify: true },
    },
  ];

  const results = await Promise.all(builds.map((item) => build(item.options)));

  if (SHOULD_WRITE_META) {
    await Promise.all(
      results.map((result, index) =>
        fs.writeFile(path.join(DIST_DIR, `${entry.name}.${index}.meta.json`), `${JSON.stringify(result.metafile, null, 2)}\n`),
      ),
    );
  }

  return builds.map((item) => path.relative(DIST_DIR, item.file));
}

async function copyDocsAssets(): Promise<void> {
  await fs.mkdir(ASSETS_DIR, { recursive: true });
  await copyFileIfExists(path.join(ROOT_DIR, "scripts/docs/docs.css"), path.join(ASSETS_DIR, "docs.css"));
  await copyFileIfExists(path.join(ROOT_DIR, "scripts/docs/docs-client.js"), path.join(ASSETS_DIR, "docs-client.js"));
}

async function copyFileIfExists(source: string, target: string): Promise<void> {
  try {
    await fs.copyFile(source, target);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return;
    throw error;
  }
}

async function writeMarkdownDocs(benchmarks: BenchmarkSummary[]): Promise<GeneratedDoc[]> {
  const markdownFiles = await collectMarkdownFiles();
  const docs = markdownFiles.map((file) => createGeneratedDoc(file));

  await fs.mkdir(DOCS_DIR, { recursive: true });
  await Promise.all(
    markdownFiles.map(async (file, index) => {
      const doc = docs[index]!;
      await fs.writeFile(
        path.join(DOCS_DIR, `${doc.slug}.html`),
        createMarkdownPageHtml({
          title: doc.title,
          sourcePath: file.relativePath,
          displayPath: doc.displayPath,
          markdown: file.content,
          navItems: docs,
          benchmarks,
          packageId: doc.packageId,
          description: doc.description,
        }),
      );
    }),
  );

  return docs;
}

function createGeneratedDoc(file: TextFile): GeneratedDoc {
  const title = titleFromMarkdown(file.content) || titleFromPath(file.relativePath);
  const normalized = normalizeContentPath(file.relativePath);
  const slug = slugFromPath(normalized.replace(/README\.md$/i, "index.md"));

  return {
    title,
    slug,
    sourcePath: file.relativePath,
    displayPath: displayPathFromPath(file.relativePath),
    href: `docs/${slug}.html`,
    kind: /README\.md$/i.test(file.relativePath) ? "readme" : "markdown",
    packageId: packageFromPath(file.relativePath),
    description: descriptionFromMarkdown(file.content),
  };
}

async function writeCodePages(
  kind: GeneratedCodePage["kind"],
  files: TextFile[],
  directory: string,
  benchmarks: BenchmarkSummary[],
): Promise<GeneratedCodePage[]> {
  const pages = files.map((file) => createGeneratedCodePage(kind, file));

  await fs.mkdir(directory, { recursive: true });
  await Promise.all(
    files.map(async (file, index) => {
      const page = pages[index]!;
      await fs.writeFile(
        path.join(directory, `${page.slug}.html`),
        createCodePageHtml({
          title: page.title,
          sourcePath: file.relativePath,
          displayPath: page.displayPath,
          code: file.content,
          language: page.language,
          navItems: pages,
          kind,
          benchmarks,
          packageId: page.packageId,
          description: page.description,
        }),
      );
    }),
  );

  return pages;
}

function createGeneratedCodePage(kind: GeneratedCodePage["kind"], file: TextFile): GeneratedCodePage {
  const normalized = normalizeContentPath(file.relativePath);
  const slug = slugFromPath(normalized);
  const directory = kind === "source" ? "source" : kind === "test" ? "tests" : kind === "benchmark" ? "benchmarks" : "pipeline";
  const packageId = kind === "benchmark" ? packageFromBenchmarkPath(file.relativePath) : packageFromPath(file.relativePath);

  return {
    title: titleFromPath(file.relativePath),
    slug,
    sourcePath: file.relativePath,
    displayPath: displayPathFromPath(file.relativePath),
    href: `${directory}/${slug}.html`,
    language: languageFromPath(file.relativePath),
    kind,
    packageId,
    description: descriptionFromCodePath(file.relativePath, kind),
  };
}

type TextFile = {
  relativePath: string;
  absolutePath: string;
  content: string;
};

async function collectMarkdownFiles(): Promise<TextFile[]> {
  const files = await walkTextFiles(ROOT_DIR, (relativePath) => {
    if (!relativePath.endsWith(".md")) return false;
    if (relativePath.startsWith("dist/")) return false;
    if (relativePath.includes("node_modules/")) return false;
    return true;
  });

  return files.filter((file) => shouldRenderMarkdownFile(file, files));
}

function shouldRenderMarkdownFile(file: TextFile, allFiles: TextFile[]): boolean {
  if (file.content.trim().length === 0) return false;
  if (!/README\.md$/i.test(file.relativePath)) return true;

  const directory = path.dirname(file.relativePath);
  if (directory === ".") return true;

  return (
    allFiles.some((candidate) => candidate.relativePath !== file.relativePath && path.dirname(candidate.relativePath) === directory) ||
    directory.startsWith("src/") ||
    directory === "bench"
  );
}

async function collectSourceFiles(): Promise<TextFile[]> {
  return walkTextFiles(
    SRC_DIR,
    (relativePath) => {
      if (relativePath.endsWith(".d.ts")) return false;
      if (/\/tests?\//.test(relativePath)) return false;
      if (!/\.(ts|tsx|js|jsx|mjs|css|json)$/.test(relativePath)) return false;
      return true;
    },
    "src",
  );
}

async function collectTestFiles(): Promise<TextFile[]> {
  return walkTextFiles(ROOT_DIR, (relativePath) => {
    if (relativePath.startsWith("dist/")) return false;
    return (
      /(^|\/)(tests?|__tests__)\//.test(relativePath) ||
      /\.(test|spec)\.(ts|tsx|js|jsx|mjs)$/.test(relativePath) ||
      /vitest\.config\.(ts|js|mjs)$/.test(relativePath)
    );
  });
}

async function collectPipelineFiles(): Promise<TextFile[]> {
  return walkTextFiles(ROOT_DIR, (relativePath) => {
    if (relativePath.startsWith("dist/")) return false;
    return (
      relativePath.startsWith(".github/workflows/") ||
      relativePath === "package.json" ||
      relativePath === "pnpm-workspace.yaml"
    );
  });
}

async function collectBenchmarkFiles(): Promise<TextFile[]> {
  return walkTextFiles(ROOT_DIR, (relativePath) => {
    if (relativePath.startsWith("dist/")) return false;
    return relativePath.startsWith("bench/") && /\.(md|json|txt)$/.test(relativePath);
  });
}

async function createBenchmarkSummaries(files: TextFile[], pages: GeneratedCodePage[], reports: BenchmarkReportFile[]): Promise<BenchmarkSummary[]> {
  const summaries: BenchmarkSummary[] = [];

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index]!;
    const file = files[index]!;
    if (!/\.json$/i.test(file.relativePath)) continue;

    const parsed = safeJson(file.content) as Record<string, unknown> | null;
    const comparison = isRecord(parsed?.comparison) ? parsed.comparison : null;

    summaries.push({
      id: slugFromPath(normalizeContentPath(file.relativePath)),
      title: page.title,
      href: page.href,
      sourcePath: page.sourcePath,
      displayPath: page.displayPath,
      packageId: page.packageId,
      generatedAt: typeof parsed?.generatedAt === "string" ? parsed.generatedAt : undefined,
      geometricMeanPercent: numberOrUndefined(comparison?.geometricMeanPercent),
      absoluteGeometricMeanPercent: numberOrUndefined(comparison?.absoluteGeometricMeanPercent),
      faster: numberOrUndefined(comparison?.faster),
      slower: numberOrUndefined(comparison?.slower),
      stable: numberOrUndefined(comparison?.stable),
      unstable: numberOrUndefined(comparison?.unstable),
    });
  }

  if (reports.length > 0) {
    summaries.unshift({
      id: "benchmark-dashboard",
      title: "Benchmark Dashboard",
      href: "benchmarks/index.html",
      sourcePath: "bench/index.html",
      displayPath: "Benchmarks / Dashboard",
      packageId: "benchmark",
      generatedAt: reports[0]?.generatedAt,
      geometricMeanPercent: geometricMean(reports.map((report) => report.comparison.geometricMeanPercent).filter((value): value is number => typeof value === "number")),
      absoluteGeometricMeanPercent: geometricMean(reports.map((report) => report.comparison.absoluteGeometricMeanPercent).filter((value): value is number => typeof value === "number")),
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
    .filter((file) => /\.json$/i.test(file.relativePath))
    .map((file) => safeJson(file.content))
    .filter(isBenchmarkReportFile)
    .sort((left, right) => left.suite.id.localeCompare(right.suite.id));
}

async function writeBenchmarkDashboard(reports: BenchmarkReportFile[]): Promise<void> {
  if (reports.length === 0) return;
  await fs.mkdir(BENCHMARK_DIR, { recursive: true });
  await fs.writeFile(path.join(BENCHMARK_DIR, "index.html"), createBenchmarkDashboardHtml(reports));
}

function isBenchmarkReportFile(value: unknown): value is BenchmarkReportFile {
  if (!isRecord(value)) return false;
  return value.schemaVersion === 2 && isRecord(value.suite) && isRecord(value.current) && isRecord(value.comparison);
}

function geometricMean(values: number[]): number | undefined {
  const valid = values.filter((value) => Number.isFinite(value)).map((value) => 1 + value / 100).filter((value) => value > 0);
  if (valid.length === 0) return undefined;
  return (Math.exp(valid.reduce((sum, value) => sum + Math.log(value), 0) / valid.length) - 1) * 100;
}

async function walkTextFiles(root: string, accept: (relativePath: string) => boolean, relativeRoot = "."): Promise<TextFile[]> {
  const base = relativeRoot === "." ? ROOT_DIR : path.join(ROOT_DIR, relativeRoot);
  const files: TextFile[] = [];

  async function visit(directory: string): Promise<void> {
    const dirents = await fs.readdir(directory, { withFileTypes: true });

    for (const dirent of dirents) {
      if (dirent.name === "node_modules" || dirent.name === ".git" || dirent.name === "dist") continue;

      const absolutePath = path.join(directory, dirent.name);
      const relativePath = toPosix(path.relative(base, absolutePath));
      const projectRelativePath = relativeRoot === "." ? relativePath : toPosix(path.join(relativeRoot, relativePath));

      if (dirent.isDirectory()) {
        await visit(absolutePath);
        continue;
      }

      if (!dirent.isFile()) continue;
      if (!accept(projectRelativePath)) continue;

      const stat = await fs.stat(absolutePath);
      if (stat.size > TEXT_PAGE_MAX_BYTES) continue;

      files.push({ absolutePath, relativePath: projectRelativePath, content: await fs.readFile(absolutePath, "utf8") });
    }
  }

  await visit(root);
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function createBanner(entry: RootEntry): string {
  const description = entry.tool.description.replace(/\*\//g, "*");
  return `/**\n * ${(new Date()).toUTCString()}\n * @tool ${entry.tool.name}\n * @global ${entry.globalName}\n * @entry ${entry.relativePath}\n * @description ${description}\n * @generated by Rod root IIFE build system\n */`;
}

function createManifest(
  entries: RootEntry[],
  outputs: string[],
  pages: { docs: GeneratedDoc[]; sources: GeneratedCodePage[]; tests: GeneratedCodePage[]; pipelines: GeneratedCodePage[]; benchmarks: BenchmarkSummary[] },
): Record<string, unknown> {
  return {
    generatedAt: new Date().toISOString(),
    namespace: GLOBAL_NAMESPACE,
    docs: pages.docs,
    sources: pages.sources,
    tests: pages.tests,
    pipelines: pages.pipelines,
    benchmarks: pages.benchmarks,
    entries: entries.map((entry) => ({
      name: entry.name,
      globalName: entry.globalName,
      entry: entry.relativePath,
      displayPath: displayPathFromPath(entry.relativePath),
      packageId: packageFromPath(entry.relativePath),
      description: entry.tool.description,
      tags: entry.tool.tags,
      files: outputs.filter((output) => output.startsWith(`${entry.name}.`)),
    })),
  };
}

function titleFromMarkdown(markdown: string): string | null {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || null;
}

function descriptionFromMarkdown(markdown: string): string | undefined {
  const firstParagraph = markdown
    .replace(/^#\s+.+$/m, "")
    .split(/\n\s*\n/g)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .find((part) => part.length > 0 && !part.startsWith("#") && !part.startsWith("```"));

  return firstParagraph?.slice(0, 220);
}

function titleFromPath(relativePath: string): string {
  const normalized = normalizeContentPath(relativePath);
  const withoutReadme = normalized.replace(/(^|\/)README\.md$/i, (_match, prefix: string) => `${prefix}overview.md`);
  const withoutExtension = withoutReadme.replace(/\.[^.]+$/, "");
  const parts = withoutExtension.split("/").filter(Boolean);
  const last = parts.at(-1) || withoutExtension;
  const packageId = packageFromPath(relativePath);

  if (last === "index" && packageId !== "default") return displayPackageName(packageId);
  if (last === "overview" && parts.length <= 2 && packageId !== "default") return `${displayPackageName(packageId)} Overview`;

  return humanizeSegment(last);
}

function displayPathFromPath(relativePath: string): string {
  return normalizeContentPath(relativePath)
    .replace(/(^|\/)README\.md$/i, "$1README.md")
    .split("/")
    .map((segment) => segment === "src" ? "source" : segment)
    .join(" / ");
}

function normalizeContentPath(relativePath: string): string {
  return toPosix(relativePath)
    .replace(/^\.\//, "")
    .replace(/^src\//, "")
    .replace(/^scripts\//, "")
    .replace(/^bench\//, "benchmark/")
    .replace(/^\.github\/workflows\//, "workflow/");
}

function slugFromPath(relativePath: string): string {
  return normalizeContentPath(relativePath)
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/(^|\/)index$/g, "$1overview")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "page";
}

function packageFromPath(relativePath: string): PackageTheme {
  const value = toPosix(relativePath).toLowerCase();
  if (value.includes("fabrica-elements")) return "fabrica-elements";
  if (value.includes("fabrica")) return "fabrica";
  if (value.includes("cipo")) return "cipo";
  if (value.includes("broto")) return "broto";
  if (value.startsWith("bench/")) return packageFromBenchmarkPath(value);
  if (value.startsWith(".github/") || value.includes("workflow")) return "pipeline";
  if (value.endsWith("index.ts") || value === "src/index.ts") return "index";
  if (value.endsWith(".md")) return "docs";
  return "default";
}

function packageFromBenchmarkPath(relativePath: string): PackageTheme {
  const value = toPosix(relativePath).toLowerCase();
  if (value.includes("fabrica")) return "fabrica";
  if (value.includes("cipo")) return "cipo";
  if (value.includes("broto")) return "broto";
  return "benchmark";
}

function displayPackageName(packageId: PackageTheme): string {
  switch (packageId) {
    case "broto": return "Broto";
    case "fabrica": return "Fábrica";
    case "fabrica-elements": return "Fabrica Elements";
    case "cipo": return "Cipó";
    case "benchmark": return "Benchmarks";
    case "pipeline": return "Pipeline";
    case "index": return "Rod Runtime";
    case "docs": return "Docs";
    default: return "Browser Tools";
  }
}

function humanizeSegment(value: string): string {
  return value
    .split(/[\/._-]+/g)
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === "cipo") return "Cipó";
      if (lower === "fabrica") return "Fábrica";
      if (lower === "tsx") return "TSX";
      if (lower === "ts") return "TS";
      if (lower === "json") return "JSON";
      return `${part.charAt(0).toUpperCase()}${part.slice(1)}`;
    })
    .join(" ");
}

function descriptionFromCodePath(relativePath: string, kind: GeneratedCodePage["kind"]): string {
  const displayPath = displayPathFromPath(relativePath);
  if (kind === "benchmark") return `Benchmark artifact from ${displayPath}.`;
  if (kind === "pipeline") return `Pipeline and publishing support file from ${displayPath}.`;
  if (kind === "test") return `Test coverage and behavior contract from ${displayPath}.`;
  return `Source module from ${displayPath}.`;
}

function languageFromPath(relativePath: string): string {
  const extension = path.extname(relativePath).slice(1).toLowerCase();
  if (["ts", "tsx"].includes(extension)) return "ts";
  if (["js", "jsx", "mjs"].includes(extension)) return "js";
  if (["yml", "yaml"].includes(extension)) return "yaml";
  if (extension === "json") return "json";
  if (extension === "css") return "css";
  if (extension === "md") return "md";
  return "plaintext";
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

try {
  await main();
} catch (error) {
  console.error(error);
  throw error;
}
