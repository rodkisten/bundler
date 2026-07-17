import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { build, type BuildOptions, type Plugin } from "esbuild";
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
import { buildDevtoolsLanding } from "./build-devtools-landing";
import { buildNascenteDocs } from "./build-nascente-docs";
import {
  DIST_DIR,
  ROOT_DIR,
  SRC_DIR,
  WORKSPACE_PACKAGES,
  readBooleanEnv,
  readEnv,
  workspaceSourceCandidates,
  type RootEntry,
} from "./config";
import { discoverRootEntries } from "./discover-entries";

const GLOBAL_NAMESPACE = readEnv("BUILD_GLOBAL_NAMESPACE", "Rod");
const SHOULD_WRITE_META = readBooleanEnv("BUILD_META", true);
const BUILD_DEBUG = readBooleanEnv("BUILD_DEBUG", true);

const REQUESTED_BUILD_ENTRIES = new Set(
  readEnv("BUILD_ENTRIES", "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean),
);

const DOCS_DIR = path.join(DIST_DIR, "docs");
const SOURCE_DIR = path.join(DIST_DIR, "source");
const TESTS_DIR = path.join(DIST_DIR, "tests");
const PIPELINE_DIR = path.join(DIST_DIR, "pipeline");
const BENCHMARK_DIR = path.join(DIST_DIR, "benchmarks");
const ASSETS_DIR = path.join(DIST_DIR, "assets");

const TEXT_PAGE_MAX_BYTES = 320_000;
const DEVTOOLS_ENTRY_NAME = "devtools";

const BUILD_STARTED_AT = performance.now();

type DebugLevel = "info" | "success" | "warning" | "error";

type DebugDetails = Record<string, unknown>;

/**
 * Formats step durations into a compact human-readable representation.
 */
function formatDuration(durationMs: number): string {
  if (durationMs < 1) return "<1ms";
  if (durationMs < 1_000) return `${durationMs.toFixed(0)}ms`;
  return `${(durationMs / 1_000).toFixed(2)}s`;
}

/**
 * Converts structured debug metadata into a concise inline representation.
 */
function serializeDebugDetails(details?: DebugDetails): string {
  if (!details || Object.keys(details).length === 0) return "";

  return ` ${Object.entries(details)
    .map(([key, value]) => {
      if (typeof value === "string") return `${key}=${value}`;

      try {
        return `${key}=${JSON.stringify(value)}`;
      } catch {
        return `${key}=${String(value)}`;
      }
    })
    .join(" ")}`;
}

/**
 * Emits consistent build diagnostics with elapsed time since the pipeline started.
 */
function debugLog(
  level: DebugLevel,
  message: string,
  details?: DebugDetails,
): void {
  if (!BUILD_DEBUG && level !== "error") return;

  const elapsed = formatDuration(performance.now() - BUILD_STARTED_AT);

  const prefix: Record<DebugLevel, string> = {
    info: "▶",
    success: "✓",
    warning: "⚠",
    error: "✗",
  };

  const output =
    `[build +${elapsed}] ${prefix[level]} ${message}`
    + serializeDebugDetails(details);

  if (level === "error") {
    console.error(output);
    return;
  }

  if (level === "warning") {
    console.warn(output);
    return;
  }

  console.log(output);
}

/**
 * Runs one asynchronous build step with automatic timing and failure diagnostics.
 */
async function debugStep<T>(
  name: string,
  operation: () => Promise<T>,
  details?: DebugDetails,
): Promise<T> {
  const startedAt = performance.now();

  debugLog("info", `${name} started`, details);

  try {
    const result = await operation();

    debugLog("success", `${name} completed`, {
      duration: formatDuration(performance.now() - startedAt),
    });

    return result;
  } catch (error) {
    debugLog("error", `${name} failed`, {
      duration: formatDuration(performance.now() - startedAt),
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

/**
 * Wraps synchronous work with the same timing diagnostics used by async steps.
 */
function debugSyncStep<T>(
  name: string,
  operation: () => T,
  details?: DebugDetails,
): T {
  const startedAt = performance.now();

  debugLog("info", `${name} started`, details);

  try {
    const result = operation();

    debugLog("success", `${name} completed`, {
      duration: formatDuration(performance.now() - startedAt),
    });

    return result;
  } catch (error) {
    debugLog("error", `${name} failed`, {
      duration: formatDuration(performance.now() - startedAt),
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

function workspaceAliasPlugin(): Plugin {
  return {
    name: "workspace-alias",

    setup(buildApi) {
      debugLog("info", "Registering workspace alias resolver");

      buildApi.onResolve({ filter: /^@rodkisten\// }, async (args) => {
        const rest = args.path.slice("@rodkisten/".length);
        const slash = rest.indexOf("/");
        const pkg = slash === -1 ? rest : rest.slice(0, slash);
        const subpath = slash === -1 ? "index" : rest.slice(slash + 1);

        if (!(WORKSPACE_PACKAGES as readonly string[]).includes(pkg)) {
          debugLog("warning", "Workspace alias skipped unknown package", {
            import: args.path,
            package: pkg,
          });

          return undefined;
        }

        const candidates = workspaceSourceCandidates(
          pkg as (typeof WORKSPACE_PACKAGES)[number],
          subpath,
        );

        for (const candidate of candidates) {
          try {
            await fs.access(candidate);

            debugLog("success", "Workspace alias resolved", {
              import: args.path,
              path: toPosix(path.relative(ROOT_DIR, candidate)),
            });

            return { path: candidate };
          } catch {
            debugLog("info", "Workspace alias candidate not found", {
              import: args.path,
              path: toPosix(path.relative(ROOT_DIR, candidate)),
            });
          }
        }

        debugLog("warning", "Workspace alias using fallback candidate", {
          import: args.path,
          path: candidates[0]
            ? toPosix(path.relative(ROOT_DIR, candidates[0]))
            : "unknown",
        });

        return { path: candidates[0]! };
      });
    },
  };
}

export async function main(): Promise<void> {
  debugLog("info", "Root build pipeline initialized", {
    root: ROOT_DIR,
    dist: DIST_DIR,
    namespace: GLOBAL_NAMESPACE,
    writeMeta: SHOULD_WRITE_META,
    requestedEntries:
      REQUESTED_BUILD_ENTRIES.size > 0
        ? [...REQUESTED_BUILD_ENTRIES]
        : ["all"],
  });

  await debugStep("Cleaning distribution directory", async () => {
    await fs.rm(DIST_DIR, { recursive: true, force: true });
  });

  await debugStep("Creating distribution directory", async () => {
    await fs.mkdir(DIST_DIR, { recursive: true });
  });

  const discoveredEntries = await debugStep(
    "Discovering root entries",
    discoverRootEntries,
  );

  debugLog("success", "Root entries discovered", {
    count: discoveredEntries.length,
    entries: discoveredEntries.map((entry) => entry.name),
  });

  const buildableEntries = debugSyncStep(
    "Filtering buildable root entries",
    () => filterBuildableRootEntries(discoveredEntries),
    {
      discovered: discoveredEntries.length,
    },
  );

  debugLog("success", "Buildable root entries selected", {
    count: buildableEntries.length,
    entries: buildableEntries.map((entry) => entry.name),
  });

  const entries = debugSyncStep(
    "Applying BUILD_ENTRIES filter",
    () => filterRequestedEntries(buildableEntries),
    {
      requested:
        REQUESTED_BUILD_ENTRIES.size > 0
          ? [...REQUESTED_BUILD_ENTRIES]
          : ["all"],
    },
  );

  if (entries.length === 0) {
    throw new Error(
      "No buildable root entrypoints found. Expected package browser-entry.ts or index.ts files.",
    );
  }

  debugLog("success", "Final build entry set ready", {
    count: entries.length,
    entries: entries.map((entry) => entry.name),
  });

  const outputs: string[] = [];

  await debugStep(
    "Building root browser bundles",
    async () => {
      for (const [index, entry] of entries.entries()) {
        debugLog("info", "Building entry", {
          index: index + 1,
          total: entries.length,
          entry: entry.name,
          source: entry.relativePath,
          builder:
            entry.name === DEVTOOLS_ENTRY_NAME ? "vite" : "esbuild",
        });

        const entryOutputs =
          entry.name === DEVTOOLS_ENTRY_NAME
            ? await buildDevtoolsEntryWithVite(entry)
            : await buildEntry(entry);

        outputs.push(...entryOutputs);

        debugLog("success", "Entry build finished", {
          entry: entry.name,
          outputs: entryOutputs,
        });
      }
    },
    {
      entries: entries.length,
    },
  );

  debugLog("success", "All browser bundles built", {
    outputs: outputs.length,
  });

  const examples = await debugStep(
    "Collecting examples",
    () => collectExamplesByEntry(entries),
    {
      entries: entries.length,
    },
  );

  debugLog("success", "Examples collected", {
    entries: Object.keys(examples).length,
  });

  const benchmarkFiles = await debugStep(
    "Collecting benchmark files",
    collectBenchmarkFiles,
  );

  debugLog("success", "Benchmark files collected", {
    count: benchmarkFiles.length,
  });

  const benchmarkPages = await debugStep(
    "Generating benchmark code pages",
    () =>
      writeCodePages(
        "benchmark",
        benchmarkFiles,
        BENCHMARK_DIR,
        [],
      ),
    {
      files: benchmarkFiles.length,
    },
  );

  const benchmarkReports = debugSyncStep(
    "Parsing benchmark reports",
    () => readBenchmarkReports(benchmarkFiles),
    {
      files: benchmarkFiles.length,
    },
  );

  debugLog("success", "Benchmark reports parsed", {
    reports: benchmarkReports.length,
  });

  await debugStep(
    "Writing benchmark dashboard",
    () => writeBenchmarkDashboard(benchmarkReports),
    {
      reports: benchmarkReports.length,
    },
  );

  const benchmarks = await debugStep(
    "Creating benchmark summaries",
    () =>
      createBenchmarkSummaries(
        benchmarkFiles,
        benchmarkPages,
        benchmarkReports,
      ),
    {
      files: benchmarkFiles.length,
      pages: benchmarkPages.length,
      reports: benchmarkReports.length,
    },
  );

  debugLog("success", "Benchmark summaries ready", {
    count: benchmarks.length,
  });

  const docs = await debugStep(
    "Generating Markdown documentation pages",
    () => writeMarkdownDocs(benchmarks),
  );

  debugLog("success", "Markdown documentation generated", {
    pages: docs.length,
  });

  const sourceFiles = await debugStep(
    "Collecting source files",
    collectSourceFiles,
  );

  debugLog("success", "Source files collected", {
    count: sourceFiles.length,
  });

  const sources = await debugStep(
    "Generating source code pages",
    () =>
      writeCodePages(
        "source",
        sourceFiles,
        SOURCE_DIR,
        benchmarks,
      ),
    {
      files: sourceFiles.length,
    },
  );

  const testFiles = await debugStep(
    "Collecting test files",
    collectTestFiles,
  );

  debugLog("success", "Test files collected", {
    count: testFiles.length,
  });

  const tests = await debugStep(
    "Generating test code pages",
    () =>
      writeCodePages(
        "test",
        testFiles,
        TESTS_DIR,
        benchmarks,
      ),
    {
      files: testFiles.length,
    },
  );

  const pipelineFiles = await debugStep(
    "Collecting pipeline files",
    collectPipelineFiles,
  );

  debugLog("success", "Pipeline files collected", {
    count: pipelineFiles.length,
  });

  const pipelines = await debugStep(
    "Generating pipeline code pages",
    () =>
      writeCodePages(
        "pipeline",
        pipelineFiles,
        PIPELINE_DIR,
        benchmarks,
      ),
    {
      files: pipelineFiles.length,
    },
  );

  const manifest = debugSyncStep(
    "Creating build manifest",
    () =>
      createManifest(entries, outputs, {
        docs,
        sources,
        tests,
        pipelines,
        benchmarks,
      }),
  );

  await debugStep("Writing manifest.json", async () => {
    await fs.writeFile(
      path.join(DIST_DIR, "manifest.json"),
      `${JSON.stringify({ ...manifest, examples }, null, 2)}\n`,
    );
  });

  await debugStep("Writing documentation index.html", async () => {
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
  });

  await debugStep(
    "Copying documentation assets",
    copyDocsAssets,
  );

  await debugStep(
    "Copying Fábrica landing page",
    () => copyLanding("fabrica"),
  );

  await debugStep(
    "Building Nascente documentation",
    buildNascenteDocs,
  );

  await debugStep(
    "Building DevTools landing page",
    buildDevtoolsLanding,
  );

  await debugStep(
    "Copying Máquina landing page",
    () => copyLanding("maquina"),
  );

  debugLog("success", "Root build pipeline completed", {
    duration: formatDuration(performance.now() - BUILD_STARTED_AT),
    entries: entries.length,
    outputs: outputs.length,
    docs: docs.length,
    sources: sources.length,
    tests: tests.length,
    pipelines: pipelines.length,
    benchmarks: benchmarks.length,
  });
}

function filterBuildableRootEntries(entries: RootEntry[]): RootEntry[] {
  return entries.filter(isBuildableRootEntry);
}

function filterRequestedEntries(entries: RootEntry[]): RootEntry[] {
  if (
    REQUESTED_BUILD_ENTRIES.size === 0
    || REQUESTED_BUILD_ENTRIES.has("all")
  ) {
    return entries;
  }

  const availableNames = new Set(
    entries.map((entry) => entry.name),
  );

  const unknownEntries = [...REQUESTED_BUILD_ENTRIES].filter(
    (entryName) => !availableNames.has(entryName),
  );

  if (unknownEntries.length > 0) {
    throw new Error(
      `Unknown BUILD_ENTRIES value(s): ${unknownEntries.join(", ")}. `
      + `Available entries: ${[...availableNames].sort().join(", ")}.`,
    );
  }

  return entries.filter(
    (entry) => REQUESTED_BUILD_ENTRIES.has(entry.name),
  );
}

function isBuildableRootEntry(entry: RootEntry): boolean {
  const relativePath = toPosix(entry.relativePath);

  if (relativePath.endsWith(".d.ts")) return false;

  const segments = relativePath
    .split("/")
    .filter(Boolean);

  if (
    segments.length === 2
    && isSupportedScriptEntryFile(segments[1]!)
  ) {
    return true;
  }

  return false;
}

function isSupportedScriptEntryFile(fileName: string): boolean {
  return (
    /\.(ts|tsx|js|jsx|mjs)$/.test(fileName)
    && !fileName.endsWith(".d.ts")
  );
}

async function copyLanding(project: string): Promise<void> {
  const source = path.join(
    ROOT_DIR,
    project,
    "index.html",
  );

  const targetDir = path.join(
    DIST_DIR,
    project,
  );

  debugLog("info", "Preparing landing page copy", {
    project,
    source: toPosix(path.relative(ROOT_DIR, source)),
    target: toPosix(path.relative(ROOT_DIR, targetDir)),
  });

  await fs.mkdir(targetDir, {
    recursive: true,
  });

  await copyFileIfExists(
    source,
    path.join(targetDir, "index.html"),
  );
}

async function buildDevtoolsEntryWithVite(
  entry: RootEntry,
): Promise<string[]> {
  debugLog("info", "Loading Vite and Cipó Vite compiler", {
    entry: entry.name,
  });

  const [{ build: viteBuild }, { cipoVite }] = await debugStep(
    `Loading Vite dependencies for ${entry.name}`,
    () =>
      Promise.all([
        import("vite"),
        import("@rodkisten/cipo/vite-index"),
      ]),
  );

  const banner = createBanner(entry);

  const normalIife = path.join(
    DIST_DIR,
    `${entry.name}.iife.js`,
  );

  const minIife = path.join(
    DIST_DIR,
    `${entry.name}.iife.min.js`,
  );

  const createBaseConfig = () => ({
    configFile: false as const,
    root: ROOT_DIR,

    resolve: {
      // Keep programmatic Vite builds on the same native tsconfig path resolution as CLI builds.
      tsconfigPaths: true,
    },

    plugins: [
      cipoVite({
        root: ROOT_DIR,
        mode: "build",
        enabled: true,
        cssDelivery: "style-tag",
        classNameMode: "compact",
        classPrefix: "c",
        minifyCss: true,
        mergeEquivalentRules: true,
        cssFileName: `${entry.name}.compiled.css`,
        compileFabrica: true,
        transformCssTag: true,
        include: [
          new RegExp(
            "[/\\\\]devtools(?:[/\\\\]|\\.ts$)",
          ),
        ],
      }),
    ],

    define: {
      "process.env.NODE_ENV":
        JSON.stringify("production"),
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

          assetFileNames: (
            assetInfo: { name?: string },
          ) =>
            assetInfo.name
            === `${entry.name}.compiled.css`
              ? `${entry.name}.compiled.css`
              : "[name][extname]",
        },
      },
    },
  });

  const normalConfig = createBaseConfig();

  await debugStep(
    `Building ${entry.name} development IIFE with Vite`,
    async () => {
      await viteBuild({
        ...normalConfig,

        build: {
          ...normalConfig.build,
          minify: false,
          outDir: DIST_DIR,

          lib: {
            ...normalConfig.build.lib,
            fileName: () =>
              `${entry.name}.iife.js`,
          },
        },
      });
    },
    {
      output: path.basename(normalIife),
      minify: false,
    },
  );

  const minConfig = createBaseConfig();

  await debugStep(
    `Building ${entry.name} minified IIFE with Vite`,
    async () => {
      await viteBuild({
        ...minConfig,

        build: {
          ...minConfig.build,
          minify: true,
          outDir: DIST_DIR,

          lib: {
            ...minConfig.build.lib,
            fileName: () =>
              `${entry.name}.iife.min.js`,
          },
        },
      });
    },
    {
      output: path.basename(minIife),
      minify: true,
    },
  );

  const emitted = [
    normalIife,
    minIife,
    path.join(
      DIST_DIR,
      "cipo.compiled.manifest.json",
    ),
  ];

  const existing = await debugStep(
    `Verifying ${entry.name} emitted files`,
    () =>
      Promise.all(
        emitted.map(async (file) => {
          try {
            await fs.access(file);

            debugLog(
              "success",
              "Build artifact verified",
              {
                entry: entry.name,
                file: path.basename(file),
              },
            );

            return file;
          } catch {
            debugLog(
              "warning",
              "Expected build artifact was not emitted",
              {
                entry: entry.name,
                file: path.basename(file),
              },
            );

            return null;
          }
        }),
      ),
  );

  const outputs = existing
    .filter(
      (file): file is string => Boolean(file),
    )
    .map((file) =>
      path.relative(DIST_DIR, file),
    );

  debugLog(
    "success",
    "Vite entry build completed",
    {
      entry: entry.name,
      outputs,
    },
  );

  return outputs;
}

async function buildEntry(
  entry: RootEntry,
): Promise<string[]> {
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

    banner: {
      js: banner,
    },

    plugins: [
      workspaceAliasPlugin(),
    ],

    define: {
      "process.env.NODE_ENV":
        JSON.stringify("production"),
    },
  };

  const normalIife = path.join(
    DIST_DIR,
    `${entry.name}.iife.js`,
  );

  const minIife = path.join(
    DIST_DIR,
    `${entry.name}.iife.min.js`,
  );

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

  const results = await debugStep(
    `Building ${entry.name} IIFE bundles with esbuild`,
    () =>
      Promise.all(
        builds.map(async (item) =>
          debugStep(
            `esbuild ${path.basename(item.file)}`,
            () => build(item.options),
            {
              entry: entry.name,
              minify: item.options.minify,
            },
          ),
        ),
      ),
    {
      entry: entry.name,
      builds: builds.length,
    },
  );

  if (SHOULD_WRITE_META) {
    await debugStep(
      `Writing ${entry.name} esbuild metafiles`,
      () =>
        Promise.all(
          results.map(
            (result, index) =>
              fs.writeFile(
                path.join(
                  DIST_DIR,
                  `${entry.name}.${index}.meta.json`,
                ),
                `${JSON.stringify(
                  result.metafile,
                  null,
                  2,
                )}\n`,
              ),
          ),
        ),
      {
        count: results.length,
      },
    );
  } else {
    debugLog(
      "info",
      "Skipping esbuild metafiles",
      {
        entry: entry.name,
        reason: "BUILD_META=false",
      },
    );
  }

  return builds.map((item) =>
    path.relative(
      DIST_DIR,
      item.file,
    ),
  );
}

async function copyDocsAssets(): Promise<void> {
  await fs.mkdir(
    ASSETS_DIR,
    {
      recursive: true,
    },
  );

  await debugStep(
    "Copying documentation stylesheet",
    () =>
      copyFileIfExists(
        path.join(
          ROOT_DIR,
          "scripts/docs/docs.css",
        ),
        path.join(
          ASSETS_DIR,
          "docs.css",
        ),
      ),
  );

  await debugStep(
    "Copying documentation client script",
    () =>
      copyFileIfExists(
        path.join(
          ROOT_DIR,
          "scripts/docs/docs-client.js",
        ),
        path.join(
          ASSETS_DIR,
          "docs-client.js",
        ),
      ),
  );
}

async function copyFileIfExists(
  source: string,
  target: string,
): Promise<void> {
  try {
    await fs.copyFile(
      source,
      target,
    );

    debugLog(
      "success",
      "File copied",
      {
        source: toPosix(
          path.relative(
            ROOT_DIR,
            source,
          ),
        ),
        target: toPosix(
          path.relative(
            ROOT_DIR,
            target,
          ),
        ),
      },
    );
  } catch (error) {
    if (
      isNodeError(error)
      && error.code === "ENOENT"
    ) {
      debugLog(
        "warning",
        "Optional file not found, copy skipped",
        {
          source: toPosix(
            path.relative(
              ROOT_DIR,
              source,
            ),
          ),
        },
      );

      return;
    }

    throw error;
  }
}

async function writeMarkdownDocs(
  benchmarks: BenchmarkSummary[],
): Promise<GeneratedDoc[]> {
  const markdownFiles = await debugStep(
    "Collecting Markdown documentation files",
    collectMarkdownFiles,
  );

  debugLog(
    "success",
    "Markdown files selected for rendering",
    {
      count: markdownFiles.length,
    },
  );

  const docs = debugSyncStep(
    "Creating Markdown documentation descriptors",
    () =>
      markdownFiles.map(
        (file) =>
          createGeneratedDoc(file),
      ),
    {
      files: markdownFiles.length,
    },
  );

  await fs.mkdir(
    DOCS_DIR,
    {
      recursive: true,
    },
  );

  await debugStep(
    "Writing Markdown documentation HTML pages",
    () =>
      Promise.all(
        markdownFiles.map(
          async (file, index) => {
            const doc = docs[index]!;

            await fs.writeFile(
              path.join(
                DOCS_DIR,
                `${doc.slug}.html`,
              ),

              createMarkdownPageHtml({
                title: doc.title,
                sourcePath:
                  file.relativePath,
                displayPath:
                  doc.displayPath,
                markdown:
                  file.content,
                navItems:
                  docs,
                benchmarks,
                packageId:
                  doc.packageId,
                description:
                  doc.description,
              }),
            );

            debugLog(
              "success",
              "Markdown page written",
              {
                page:
                  doc.href,
                source:
                  file.relativePath,
              },
            );
          },
        ),
      ),
    {
      pages: docs.length,
    },
  );

  return docs;
}

function createGeneratedDoc(
  file: TextFile,
): GeneratedDoc {
  const title =
    titleFromMarkdown(file.content)
    || titleFromPath(file.relativePath);

  const normalized =
    normalizeContentPath(
      file.relativePath,
    );

  const slug = slugFromPath(
    normalized.replace(
      /README\.md$/i,
      "index.md",
    ),
  );

  return {
    title,
    slug,
    sourcePath:
      file.relativePath,
    displayPath:
      displayPathFromPath(
        file.relativePath,
      ),
    href:
      `docs/${slug}.html`,
    kind:
      /README\.md$/i.test(
        file.relativePath,
      )
        ? "readme"
        : "markdown",
    packageId:
      packageFromPath(
        file.relativePath,
      ),
    description:
      descriptionFromMarkdown(
        file.content,
      ),
  };
}

async function writeCodePages(
  kind: GeneratedCodePage["kind"],
  files: TextFile[],
  directory: string,
  benchmarks: BenchmarkSummary[],
): Promise<GeneratedCodePage[]> {
  debugLog(
    "info",
    "Preparing code pages",
    {
      kind,
      files: files.length,
      directory: toPosix(
        path.relative(
          DIST_DIR,
          directory,
        ),
      ),
    },
  );

  const pages = files.map(
    (file) =>
      createGeneratedCodePage(
        kind,
        file,
      ),
  );

  await fs.mkdir(
    directory,
    {
      recursive: true,
    },
  );

  await debugStep(
    `Writing ${kind} HTML pages`,
    () =>
      Promise.all(
        files.map(
          async (file, index) => {
            const page =
              pages[index]!;

            await fs.writeFile(
              path.join(
                directory,
                `${page.slug}.html`,
              ),

              createCodePageHtml({
                title:
                  page.title,
                sourcePath:
                  file.relativePath,
                displayPath:
                  page.displayPath,
                code:
                  file.content,
                language:
                  page.language,
                navItems:
                  pages,
                kind,
                benchmarks,
                packageId:
                  page.packageId,
                description:
                  page.description,
              }),
            );
          },
        ),
      ),
    {
      kind,
      pages: pages.length,
    },
  );

  debugLog(
    "success",
    "Code pages generated",
    {
      kind,
      pages: pages.length,
    },
  );

  return pages;
}

function createGeneratedCodePage(
  kind: GeneratedCodePage["kind"],
  file: TextFile,
): GeneratedCodePage {
  const normalized =
    normalizeContentPath(
      file.relativePath,
    );

  const slug =
    slugFromPath(
      normalized,
    );

  const directory =
    kind === "source"
      ? "source"
      : kind === "test"
        ? "tests"
        : kind === "benchmark"
          ? "benchmarks"
          : "pipeline";

  const packageId =
    kind === "benchmark"
      ? packageFromBenchmarkPath(
          file.relativePath,
        )
      : packageFromPath(
          file.relativePath,
        );

  return {
    title:
      titleFromPath(
        file.relativePath,
      ),
    slug,
    sourcePath:
      file.relativePath,
    displayPath:
      displayPathFromPath(
        file.relativePath,
      ),
    href:
      `${directory}/${slug}.html`,
    language:
      languageFromPath(
        file.relativePath,
      ),
    kind,
    packageId,
    description:
      descriptionFromCodePath(
        file.relativePath,
        kind,
      ),
  };
}

type TextFile = {
  relativePath: string;
  absolutePath: string;
  content: string;
};

async function collectMarkdownFiles(): Promise<TextFile[]> {
  const files = await walkTextFiles(
    ROOT_DIR,
    (relativePath) => {
      if (
        !relativePath.endsWith(
          ".md",
        )
      ) {
        return false;
      }

      if (
        relativePath.startsWith(
          "dist/",
        )
      ) {
        return false;
      }

      if (
        relativePath.includes(
          "node_modules/",
        )
      ) {
        return false;
      }

      return true;
    },
  );

  const filtered =
    files.filter(
      (file) =>
        shouldRenderMarkdownFile(
          file,
          files,
        ),
    );

  debugLog(
    "success",
    "Markdown collection filtered",
    {
      discovered: files.length,
      renderable:
        filtered.length,
    },
  );

  return filtered;
}

function shouldRenderMarkdownFile(
  file: TextFile,
  allFiles: TextFile[],
): boolean {
  if (
    file.content.trim().length
    === 0
  ) {
    return false;
  }

  if (
    !/README\.md$/i.test(
      file.relativePath,
    )
  ) {
    return true;
  }

  const directory =
    path.dirname(
      file.relativePath,
    );

  if (directory === ".") {
    return true;
  }

  return (
    allFiles.some(
      (candidate) =>
        candidate.relativePath
          !== file.relativePath
        && path.dirname(
          candidate.relativePath,
        ) === directory,
    )
    || WORKSPACE_PACKAGES.some(
      (name) =>
        directory === name
        || directory.startsWith(
          `${name}/`,
        ),
    )
    || directory === "bench"
  );
}

async function collectSourceFiles(): Promise<TextFile[]> {
  const files: TextFile[] = [];

  for (
    const pkg
    of WORKSPACE_PACKAGES
  ) {
    debugLog(
      "info",
      "Collecting package source files",
      {
        package: pkg,
      },
    );

    const packageFiles =
      await walkTextFiles(
        path.join(
          ROOT_DIR,
          pkg,
        ),

        (relativePath) => {
          if (
            relativePath.endsWith(
              ".d.ts",
            )
          ) {
            return false;
          }

          if (
            /\/tests?\//.test(
              relativePath,
            )
          ) {
            return false;
          }

          if (
            !/\.(ts|tsx|js|jsx|mjs|css|json)$/.test(
              relativePath,
            )
          ) {
            return false;
          }

          return true;
        },

        pkg,
      );

    files.push(
      ...packageFiles,
    );

    debugLog(
      "success",
      "Package source files collected",
      {
        package: pkg,
        files:
          packageFiles.length,
      },
    );
  }

  return files;
}

async function collectTestFiles(): Promise<TextFile[]> {
  return walkTextFiles(
    ROOT_DIR,
    (relativePath) => {
      if (
        relativePath.startsWith(
          "dist/",
        )
      ) {
        return false;
      }

      return (
        /(^|\/)(tests?|__tests__)\//.test(
          relativePath,
        )
        || /\.(test|spec)\.(ts|tsx|js|jsx|mjs)$/.test(
          relativePath,
        )
        || /vitest\.config\.(ts|js|mjs)$/.test(
          relativePath,
        )
      );
    },
  );
}

async function collectPipelineFiles(): Promise<TextFile[]> {
  return walkTextFiles(
    ROOT_DIR,
    (relativePath) => {
      if (
        relativePath.startsWith(
          "dist/",
        )
      ) {
        return false;
      }

      return (
        relativePath.startsWith(
          ".github/workflows/",
        )
        || relativePath
          === "package.json"
        || relativePath
          === "pnpm-workspace.yaml"
      );
    },
  );
}

async function collectBenchmarkFiles(): Promise<TextFile[]> {
  return walkTextFiles(
    ROOT_DIR,
    (relativePath) => {
      if (
        relativePath.startsWith(
          "dist/",
        )
      ) {
        return false;
      }

      return (
        relativePath.startsWith(
          "bench/",
        )
        && /\.(md|json|txt)$/.test(
          relativePath,
        )
      );
    },
  );
}

async function createBenchmarkSummaries(
  files: TextFile[],
  pages: GeneratedCodePage[],
  reports: BenchmarkReportFile[],
): Promise<BenchmarkSummary[]> {
  const summaries: BenchmarkSummary[] = [];

  for (
    let index = 0;
    index < pages.length;
    index += 1
  ) {
    const page =
      pages[index]!;

    const file =
      files[index]!;

    if (
      !/\.json$/i.test(
        file.relativePath,
      )
    ) {
      continue;
    }

    const parsed =
      safeJson(
        file.content,
      ) as Record<
        string,
        unknown
      > | null;

    const comparison =
      isRecord(
        parsed?.comparison,
      )
        ? parsed.comparison
        : null;

    summaries.push({
      id:
        slugFromPath(
          normalizeContentPath(
            file.relativePath,
          ),
        ),

      title:
        page.title,

      href:
        page.href,

      sourcePath:
        page.sourcePath,

      displayPath:
        page.displayPath,

      packageId:
        page.packageId,

      generatedAt:
        typeof parsed?.generatedAt
          === "string"
          ? parsed.generatedAt
          : undefined,

      geometricMeanPercent:
        numberOrUndefined(
          comparison
            ?.geometricMeanPercent,
        ),

      absoluteGeometricMeanPercent:
        numberOrUndefined(
          comparison
            ?.absoluteGeometricMeanPercent,
        ),

      faster:
        numberOrUndefined(
          comparison?.faster,
        ),

      slower:
        numberOrUndefined(
          comparison?.slower,
        ),

      stable:
        numberOrUndefined(
          comparison?.stable,
        ),

      unstable:
        numberOrUndefined(
          comparison?.unstable,
        ),
    });
  }

  if (reports.length > 0) {
    summaries.unshift({
      id:
        "benchmark-dashboard",

      title:
        "Benchmark Dashboard",

      href:
        "benchmarks/index.html",

      sourcePath:
        "bench/index.html",

      displayPath:
        "Benchmarks / Dashboard",

      packageId:
        "benchmark",

      generatedAt:
        reports[0]?.generatedAt,

      geometricMeanPercent:
        geometricMean(
          reports
            .map(
              (report) =>
                report.comparison
                  .geometricMeanPercent,
            )
            .filter(
              (
                value,
              ): value is number =>
                typeof value
                  === "number",
            ),
        ),

      absoluteGeometricMeanPercent:
        geometricMean(
          reports
            .map(
              (report) =>
                report.comparison
                  .absoluteGeometricMeanPercent,
            )
            .filter(
              (
                value,
              ): value is number =>
                typeof value
                  === "number",
            ),
        ),

      faster:
        reports.reduce(
          (sum, report) =>
            sum
            + report.comparison
              .faster,
          0,
        ),

      slower:
        reports.reduce(
          (sum, report) =>
            sum
            + report.comparison
              .slower,
          0,
        ),

      stable:
        reports.reduce(
          (sum, report) =>
            sum
            + report.comparison
              .stable,
          0,
        ),

      unstable:
        reports.reduce(
          (sum, report) =>
            sum
            + report.comparison
              .unstable,
          0,
        ),
    });
  }

  return summaries.sort(
    (left, right) =>
      left.title.localeCompare(
        right.title,
      ),
  );
}

function readBenchmarkReports(
  files: TextFile[],
): BenchmarkReportFile[] {
  return files
    .filter(
      (file) =>
        /\.json$/i.test(
          file.relativePath,
        ),
    )

    .map(
      (file) =>
        safeJson(
          file.content,
        ),
    )

    .filter(
      isBenchmarkReportFile,
    )

    .sort(
      (left, right) =>
        left.suite.id.localeCompare(
          right.suite.id,
        ),
    );
}

async function writeBenchmarkDashboard(
  reports: BenchmarkReportFile[],
): Promise<void> {
  if (
    reports.length === 0
  ) {
    debugLog(
      "info",
      "Benchmark dashboard skipped",
      {
        reason:
          "No benchmark reports found",
      },
    );

    return;
  }

  await fs.mkdir(
    BENCHMARK_DIR,
    {
      recursive: true,
    },
  );

  await fs.writeFile(
    path.join(
      BENCHMARK_DIR,
      "index.html",
    ),

    createBenchmarkDashboardHtml(
      reports,
    ),
  );

  debugLog(
    "success",
    "Benchmark dashboard written",
    {
      reports:
        reports.length,
      output:
        "benchmarks/index.html",
    },
  );
}

function isBenchmarkReportFile(
  value: unknown,
): value is BenchmarkReportFile {
  if (
    !isRecord(value)
  ) {
    return false;
  }

  return (
    value.schemaVersion === 2
    && isRecord(value.suite)
    && isRecord(value.current)
    && isRecord(value.comparison)
  );
}

function geometricMean(
  values: number[],
): number | undefined {
  const valid =
    values
      .filter(
        (value) =>
          Number.isFinite(
            value,
          ),
      )

      .map(
        (value) =>
          1 + value / 100,
      )

      .filter(
        (value) =>
          value > 0,
      );

  if (
    valid.length === 0
  ) {
    return undefined;
  }

  return (
    Math.exp(
      valid.reduce(
        (sum, value) =>
          sum + Math.log(value),
        0,
      ) / valid.length,
    ) - 1
  ) * 100;
}

async function walkTextFiles(
  root: string,
  accept: (
    relativePath: string,
  ) => boolean,
  relativeRoot = ".",
): Promise<TextFile[]> {
  const startedAt =
    performance.now();

  const base =
    relativeRoot === "."
      ? ROOT_DIR
      : path.join(
          ROOT_DIR,
          relativeRoot,
        );

  const files: TextFile[] = [];

  let visitedDirectories = 0;
  let visitedFiles = 0;
  let acceptedFiles = 0;
  let skippedLargeFiles = 0;

  debugLog(
    "info",
    "Walking text files",
    {
      root:
        toPosix(
          path.relative(
            ROOT_DIR,
            root,
          ),
        ) || ".",

      relativeRoot,
    },
  );

  async function visit(
    directory: string,
  ): Promise<void> {
    visitedDirectories += 1;

    const dirents =
      await fs.readdir(
        directory,
        {
          withFileTypes: true,
        },
      );

    for (
      const dirent
      of dirents
    ) {
      if (
        dirent.name
          === "node_modules"
        || dirent.name
          === ".git"
        || dirent.name
          === "dist"
      ) {
        continue;
      }

      const absolutePath =
        path.join(
          directory,
          dirent.name,
        );

      const relativePath =
        toPosix(
          path.relative(
            base,
            absolutePath,
          ),
        );

      const projectRelativePath =
        relativeRoot === "."
          ? relativePath
          : toPosix(
              path.join(
                relativeRoot,
                relativePath,
              ),
            );

      if (
        dirent.isDirectory()
      ) {
        await visit(
          absolutePath,
        );

        continue;
      }

      if (
        !dirent.isFile()
      ) {
        continue;
      }

      visitedFiles += 1;

      if (
        !accept(
          projectRelativePath,
        )
      ) {
        continue;
      }

      const stat =
        await fs.stat(
          absolutePath,
        );

      if (
        stat.size
        > TEXT_PAGE_MAX_BYTES
      ) {
        skippedLargeFiles += 1;

        debugLog(
          "warning",
          "Text file skipped because it exceeds page size limit",
          {
            file:
              projectRelativePath,

            bytes:
              stat.size,

            limit:
              TEXT_PAGE_MAX_BYTES,
          },
        );

        continue;
      }

      acceptedFiles += 1;

      files.push({
        absolutePath,

        relativePath:
          projectRelativePath,

        content:
          await fs.readFile(
            absolutePath,
            "utf8",
          ),
      });
    }
  }

  await visit(root);

  const sorted =
    files.sort(
      (left, right) =>
        left.relativePath.localeCompare(
          right.relativePath,
        ),
    );

  debugLog(
    "success",
    "Text file walk completed",
    {
      root:
        toPosix(
          path.relative(
            ROOT_DIR,
            root,
          ),
        ) || ".",

      duration:
        formatDuration(
          performance.now()
          - startedAt,
        ),

      directories:
        visitedDirectories,

      files:
        visitedFiles,

      accepted:
        acceptedFiles,

      skippedLarge:
        skippedLargeFiles,
    },
  );

  return sorted;
}

function createBanner(
  entry: RootEntry,
): string {
  const description =
    entry.tool.description.replace(
      /\*\//g,
      "*",
    );

  return `/**
 * ${(new Date()).toUTCString()}
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
    benchmarks: BenchmarkSummary[];
  },
): Record<string, unknown> {
  return {
    generatedAt:
      new Date().toISOString(),

    namespace:
      GLOBAL_NAMESPACE,

    docs:
      pages.docs,

    sources:
      pages.sources,

    tests:
      pages.tests,

    pipelines:
      pages.pipelines,

    benchmarks:
      pages.benchmarks,

    entries:
      entries.map(
        (entry) => ({
          name:
            entry.name,

          globalName:
            entry.globalName,

          entry:
            entry.relativePath,

          displayPath:
            displayPathFromPath(
              entry.relativePath,
            ),

          packageId:
            packageFromPath(
              entry.relativePath,
            ),

          description:
            entry.tool.description,

          tags:
            entry.tool.tags,

          files:
            outputs.filter(
              (output) =>
                output.startsWith(
                  `${entry.name}.`,
                ),
            ),
        }),
      ),
  };
}

function titleFromMarkdown(
  markdown: string,
): string | null {
  return (
    markdown.match(
      /^#\s+(.+)$/m,
    )?.[1]?.trim()
    || null
  );
}

function descriptionFromMarkdown(
  markdown: string,
): string | undefined {
  const firstParagraph =
    markdown
      .replace(
        /^#\s+.+$/m,
        "",
      )

      .split(
        /\n\s*\n/g,
      )

      .map(
        (part) =>
          part
            .replace(
              /\s+/g,
              " ",
            )
            .trim(),
      )

      .find(
        (part) =>
          part.length > 0
          && !part.startsWith("#")
          && !part.startsWith("```"),
      );

  return firstParagraph
    ?.slice(
      0,
      220,
    );
}

function titleFromPath(
  relativePath: string,
): string {
  const normalized =
    normalizeContentPath(
      relativePath,
    );

  const withoutReadme =
    normalized.replace(
      /(^|\/)README\.md$/i,
      (
        _match,
        prefix: string,
      ) =>
        `${prefix}overview.md`,
    );

  const withoutExtension =
    withoutReadme.replace(
      /\.[^.]+$/,
      "",
    );

  const parts =
    withoutExtension
      .split("/")
      .filter(Boolean);

  const last =
    parts.at(-1)
    || withoutExtension;

  const packageId =
    packageFromPath(
      relativePath,
    );

  if (
    last === "index"
    && packageId !== "default"
  ) {
    return displayPackageName(
      packageId,
    );
  }

  if (
    last === "overview"
    && parts.length <= 2
    && packageId !== "default"
  ) {
    return `${
      displayPackageName(
        packageId,
      )
    } Overview`;
  }

  return humanizeSegment(
    last,
  );
}

function displayPathFromPath(
  relativePath: string,
): string {
  return normalizeContentPath(
    relativePath,
  )
    .replace(
      /(^|\/)README\.md$/i,
      "$1README.md",
    )

    .split("/")

    .map(
      (segment) =>
        segment === "src"
          ? "source"
          : segment,
    )

    .join(
      " / ",
    );
}

function normalizeContentPath(
  relativePath: string,
): string {
  return toPosix(
    relativePath,
  )
    .replace(
      /^\.\//,
      "",
    )

    .replace(
      /^src\//,
      "",
    )

    .replace(
      /^scripts\//,
      "",
    )

    .replace(
      /^bench\//,
      "benchmark/",
    )

    .replace(
      /^\.github\/workflows\//,
      "workflow/",
    );
}

function slugFromPath(
  relativePath: string,
): string {
  return (
    normalizeContentPath(
      relativePath,
    )
      .toLowerCase()

      .replace(
        /\.[^.]+$/,
        "",
      )

      .replace(
        /(^|\/)index$/g,
        "$1overview",
      )

      .replace(
        /[^a-z0-9]+/g,
        "-",
      )

      .replace(
        /^-+|-+$/g,
        "",
      )
    || "page"
  );
}

function packageFromPath(
  relativePath: string,
): PackageTheme {
  const value =
    toPosix(
      relativePath,
    ).toLowerCase();

  if (
    value.includes(
      "fabrica-elements",
    )
  ) {
    return "fabrica-elements";
  }

  if (
    value.includes(
      "fabrica",
    )
  ) {
    return "fabrica";
  }

  if (
    value.includes(
      "cipo",
    )
  ) {
    return "cipo";
  }

  if (
    value.includes(
      "broto",
    )
  ) {
    return "broto";
  }

  if (
    value.startsWith(
      "bench/",
    )
  ) {
    return packageFromBenchmarkPath(
      value,
    );
  }

  if (
    value.startsWith(
      ".github/",
    )
    || value.includes(
      "workflow",
    )
  ) {
    return "pipeline";
  }

  if (
    value.endsWith(
      "index.ts",
    )
    || value
      === "rod/index.ts"
  ) {
    return "index";
  }

  if (
    value.endsWith(
      ".md",
    )
  ) {
    return "docs";
  }

  return "default";
}

function packageFromBenchmarkPath(
  relativePath: string,
): PackageTheme {
  const value =
    toPosix(
      relativePath,
    ).toLowerCase();

  if (
    value.includes(
      "fabrica",
    )
  ) {
    return "fabrica";
  }

  if (
    value.includes(
      "cipo",
    )
  ) {
    return "cipo";
  }

  if (
    value.includes(
      "broto",
    )
  ) {
    return "broto";
  }

  return "benchmark";
}

function displayPackageName(
  packageId: PackageTheme,
): string {
  switch (packageId) {
    case "broto":
      return "Broto";

    case "fabrica":
      return "Fábrica";

    case "fabrica-elements":
      return "Fabrica Elements";

    case "cipo":
      return "Cipó";

    case "benchmark":
      return "Benchmarks";

    case "pipeline":
      return "Pipeline";

    case "index":
      return "Rod Runtime";

    case "docs":
      return "Docs";

    default:
      return "Browser Tools";
  }
}

function humanizeSegment(
  value: string,
): string {
  return value
    .split(
      /[\/._-]+/g,
    )

    .filter(Boolean)

    .map(
      (part) => {
        const lower =
          part.toLowerCase();

        if (
          lower === "cipo"
        ) {
          return "Cipó";
        }

        if (
          lower === "fabrica"
        ) {
          return "Fábrica";
        }

        if (
          lower === "tsx"
        ) {
          return "TSX";
        }

        if (
          lower === "ts"
        ) {
          return "TS";
        }

        if (
          lower === "json"
        ) {
          return "JSON";
        }

        return `${
          part.charAt(
            0,
          ).toUpperCase()
        }${
          part.slice(
            1,
          )
        }`;
      },
    )

    .join(
      " ",
    );
}

function descriptionFromCodePath(
  relativePath: string,
  kind: GeneratedCodePage["kind"],
): string {
  const displayPath =
    displayPathFromPath(
      relativePath,
    );

  if (
    kind === "benchmark"
  ) {
    return `Benchmark artifact from ${displayPath}.`;
  }

  if (
    kind === "pipeline"
  ) {
    return `Pipeline and publishing support file from ${displayPath}.`;
  }

  if (
    kind === "test"
  ) {
    return `Test coverage and behavior contract from ${displayPath}.`;
  }

  return `Source module from ${displayPath}.`;
}

function languageFromPath(
  relativePath: string,
): string {
  const extension =
    path
      .extname(
        relativePath,
      )
      .slice(1)
      .toLowerCase();

  if (
    ["ts", "tsx"].includes(
      extension,
    )
  ) {
    return "ts";
  }

  if (
    ["js", "jsx", "mjs"].includes(
      extension,
    )
  ) {
    return "js";
  }

  if (
    ["yml", "yaml"].includes(
      extension,
    )
  ) {
    return "yaml";
  }

  if (
    extension === "json"
  ) {
    return "json";
  }

  if (
    extension === "css"
  ) {
    return "css";
  }

  if (
    extension === "md"
  ) {
    return "md";
  }

  return "plaintext";
}

function safeJson(
  value: string,
): unknown {
  try {
    return JSON.parse(
      value,
    );
  } catch {
    return null;
  }
}

function isRecord(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value
      === "object"
    && value !== null
    && !Array.isArray(
      value,
    )
  );
}

function numberOrUndefined(
  value: unknown,
): number | undefined {
  return (
    typeof value
      === "number"
    && Number.isFinite(
      value,
    )
  )
    ? value
    : undefined;
}

function toPosix(
  value: string,
): string {
  return value
    .split(
      path.sep,
    )
    .join("/");
}

function isNodeError(
  error: unknown,
): error is NodeJS.ErrnoException {
  return (
    error instanceof Error
    && "code" in error
  );
}

try {
  await main();
} catch (error) {
  debugLog(
    "error",
    "Root build pipeline terminated",
    {
      duration:
        formatDuration(
          performance.now()
          - BUILD_STARTED_AT,
        ),

      error:
        error instanceof Error
          ? error.message
          : String(error),

      stack:
        error instanceof Error
          ? error.stack
          : undefined,
    },
  );

  throw error;
}
