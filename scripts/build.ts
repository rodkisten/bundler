import fs from "node:fs/promises";
import path from "node:path";
import { build, type BuildOptions } from "esbuild";
import {
  createCodePageHtml,
  createIndexHtml,
  createMarkdownPageHtml,
  type GeneratedCodePage,
  type GeneratedDoc,
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
const ASSETS_DIR = path.join(DIST_DIR, "assets");

const TEXT_PAGE_MAX_BYTES = 320_000;

export async function main(): Promise<void> {
  await fs.rm(DIST_DIR, { recursive: true, force: true });
  await fs.mkdir(DIST_DIR, { recursive: true });

  const discoveredEntries = await discoverRootEntries();
  const entries = filterBuildableRootEntries(discoveredEntries);

  if (entries.length === 0) {
    throw new Error(
      "No buildable root entrypoints found. Expected src/index.ts, src/name.ts, or src/name/index.ts.",
    );
  }

  const outputs: string[] = [];

  for (const entry of entries) {
    outputs.push(...(await buildEntry(entry)));
  }

  const examples = await collectExamplesByEntry(entries);
  const docs = await writeMarkdownDocs();
  const sources = await writeCodePages("source", await collectSourceFiles(), SOURCE_DIR);
  const tests = await writeCodePages("test", await collectTestFiles(), TESTS_DIR);
  const pipelines = await writeCodePages("pipeline", await collectPipelineFiles(), PIPELINE_DIR);

  const manifest = createManifest(entries, outputs, {
    docs,
    sources,
    tests,
    pipelines,
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

  if (segments.length === 1) {
    return isSupportedScriptEntryFile(segments[0]!);
  }

  if (segments.length === 2 && segments[1] === "index.ts") {
    return true;
  }

  if (segments.length === 2 && segments[1] === "index.tsx") {
    return true;
  }

  if (segments.length === 2 && segments[1] === "index.js") {
    return true;
  }

  if (segments.length === 2 && segments[1] === "index.jsx") {
    return true;
  }

  if (segments.length === 2 && segments[1] === "index.mjs") {
    return true;
  }

  return false;
}

function isSupportedScriptEntryFile(fileName: string): boolean {
  return /\.(ts|tsx|js|jsx|mjs)$/.test(fileName) && !fileName.endsWith(".d.ts");
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
      options: {
        ...baseOptions,
        format: "iife" as const,
        globalName: entry.globalName,
        outfile: normalIife,
        minify: false,
      },
    },
    {
      file: minIife,
      options: {
        ...baseOptions,
        format: "iife" as const,
        globalName: entry.globalName,
        outfile: minIife,
        minify: true,
      },
    },
  ];

  const results = await Promise.all(builds.map((item) => build(item.options)));

  if (SHOULD_WRITE_META) {
    await Promise.all(
      results.map((result, index) =>
        fs.writeFile(
          path.join(DIST_DIR, `${entry.name}.${index}.meta.json`),
          `${JSON.stringify(result.metafile, null, 2)}\n`,
        ),
      ),
    );
  }

  return builds.map((item) => path.relative(DIST_DIR, item.file));
}

async function copyDocsAssets(): Promise<void> {
  await fs.mkdir(ASSETS_DIR, { recursive: true });

  await copyFileIfExists(
    path.join(ROOT_DIR, "scripts/docs/docs.css"),
    path.join(ASSETS_DIR, "docs.css"),
  );

  await copyFileIfExists(
    path.join(ROOT_DIR, "scripts/docs/docs-client.js"),
    path.join(ASSETS_DIR, "docs-client.js"),
  );
}

async function copyFileIfExists(source: string, target: string): Promise<void> {
  try {
    await fs.copyFile(source, target);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return;
    throw error;
  }
}

async function writeMarkdownDocs(): Promise<GeneratedDoc[]> {
  const markdownFiles = await collectMarkdownFiles();

  const docs = markdownFiles.map((file) => {
    const title = titleFromMarkdown(file.content) || titleFromPath(file.relativePath);
    const slug = slugFromPath(file.relativePath.replace(/README\.md$/i, "index.md"));

    return {
      title,
      slug,
      sourcePath: file.relativePath,
      href: `docs/${slug}.html`,
      kind: /README\.md$/i.test(file.relativePath) ? "readme" : "markdown",
    } satisfies GeneratedDoc;
  });

  await fs.mkdir(DOCS_DIR, { recursive: true });

  await Promise.all(
    markdownFiles.map(async (file, index) => {
      const doc = docs[index]!;

      await fs.writeFile(
        path.join(DOCS_DIR, `${doc.slug}.html`),
        createMarkdownPageHtml({
          title: doc.title,
          sourcePath: file.relativePath,
          markdown: file.content,
          navItems: docs,
        }),
      );
    }),
  );

  return docs;
}

async function writeCodePages(
  kind: GeneratedCodePage["kind"],
  files: TextFile[],
  directory: string,
): Promise<GeneratedCodePage[]> {
  const pages = files.map((file) => {
    const slug = slugFromPath(file.relativePath);

    return {
      title: titleFromPath(file.relativePath),
      slug,
      sourcePath: file.relativePath,
      href: `${kind === "source" ? "source" : kind === "test" ? "tests" : "pipeline"}/${slug}.html`,
      language: languageFromPath(file.relativePath),
      kind,
    } satisfies GeneratedCodePage;
  });

  await fs.mkdir(directory, { recursive: true });

  await Promise.all(
    files.map(async (file, index) => {
      const page = pages[index]!;

      await fs.writeFile(
        path.join(directory, `${page.slug}.html`),
        createCodePageHtml({
          title: page.title,
          sourcePath: file.relativePath,
          code: file.content,
          language: page.language,
          navItems: pages,
          kind,
        }),
      );
    }),
  );

  return pages;
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
    allFiles.some(
      (candidate) =>
        candidate.relativePath !== file.relativePath &&
        path.dirname(candidate.relativePath) === directory,
    ) || directory.startsWith("src/")
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
      relativePath.startsWith("bench/") ||
      relativePath === "package.json" ||
      relativePath === "pnpm-workspace.yaml"
    );
  });
}

async function walkTextFiles(
  root: string,
  accept: (relativePath: string) => boolean,
  relativeRoot = ".",
): Promise<TextFile[]> {
  const base = relativeRoot === "." ? ROOT_DIR : path.join(ROOT_DIR, relativeRoot);
  const files: TextFile[] = [];

  async function visit(directory: string): Promise<void> {
    const dirents = await fs.readdir(directory, { withFileTypes: true });

    for (const dirent of dirents) {
      if (dirent.name === "node_modules") continue;
      if (dirent.name === ".git") continue;
      if (dirent.name === "dist") continue;

      const absolutePath = path.join(directory, dirent.name);
      const relativePath = toPosix(path.relative(base, absolutePath));
      const projectRelativePath =
        relativeRoot === "." ? relativePath : toPosix(path.join(relativeRoot, relativePath));

      if (dirent.isDirectory()) {
        await visit(absolutePath);
        continue;
      }

      if (!dirent.isFile()) continue;
      if (!accept(projectRelativePath)) continue;

      const stat = await fs.stat(absolutePath);
      if (stat.size > TEXT_PAGE_MAX_BYTES) continue;

      files.push({
        absolutePath,
        relativePath: projectRelativePath,
        content: await fs.readFile(absolutePath, "utf8"),
      });
    }
  }

  await visit(root);

  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function createBanner(entry: RootEntry): string {
  const description = entry.tool.description.replace(/\*\//g, "*");

  return `/**
 * @tool ${entry.tool.name}
 * @global ${entry.globalName}
 * @entry ${entry.relativePath}
 * @description ${description}
 * @generated by Rod root IIFE build system
 */`;
}

function createManifest(
  entries: RootEntry[],
  outputs: string[],
  pages: {
    docs: GeneratedDoc[];
    sources: GeneratedCodePage[];
    tests: GeneratedCodePage[];
    pipelines: GeneratedCodePage[];
  },
): Record<string, unknown> {
  return {
    generatedAt: new Date().toISOString(),
    namespace: GLOBAL_NAMESPACE,
    docs: pages.docs,
    sources: pages.sources,
    tests: pages.tests,
    pipelines: pages.pipelines,
    entries: entries.map((entry) => ({
      name: entry.name,
      globalName: entry.globalName,
      entry: entry.relativePath,
      description: entry.tool.description,
      tags: entry.tool.tags,
      files: outputs.filter((output) => output.startsWith(`${entry.name}.`)),
    })),
  };
}

function titleFromMarkdown(markdown: string): string | null {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || null;
}

function titleFromPath(relativePath: string): string {
  const base = relativePath
    .replace(/README\.md$/i, path.basename(path.dirname(relativePath)))
    .replace(/\.[^.]+$/, "");

  return base
    .split(/[\\/._-]+/g)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function slugFromPath(relativePath: string): string {
  return (
    relativePath
      .toLowerCase()
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "page"
  );
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
