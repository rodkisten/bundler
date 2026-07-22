import fs from "node:fs/promises";
import path from "node:path";
import type { RootEntry } from "../config";
import { DIST_DIR } from "../config";
import type { BenchmarkSummary, GeneratedCodePage, GeneratedDoc, PackageTheme } from "../create-index-html";

export type BuildManifestContent = {
  readonly docs: readonly GeneratedDoc[];
  readonly sources: readonly GeneratedCodePage[];
  readonly tests: readonly GeneratedCodePage[];
  readonly pipelines: readonly GeneratedCodePage[];
  readonly benchmarks: readonly BenchmarkSummary[];
};

/** Preserves the public manifest shape while recording the new Vite-first builder. */
export async function writeBuildManifest(
  entries: RootEntry[],
  outputs: string[],
  content: BuildManifestContent,
  examples: Record<string, unknown>,
  namespace: string,
): Promise<void> {
  const manifest = {
    generatedAt: new Date().toISOString(),
    builder: "vite",
    namespace,
    docs: content.docs,
    sources: content.sources,
    tests: content.tests,
    pipelines: content.pipelines,
    benchmarks: content.benchmarks,
    entries: entries.map((entry) => ({
      name: entry.name,
      globalName: entry.globalName,
      entry: entry.relativePath,
      displayPath: entry.relativePath.replace(/\\/g, "/"),
      packageId: packageFromPath(entry.relativePath),
      description: entry.tool.description,
      tags: entry.tool.tags,
      files: outputs.filter((output) => output.startsWith(`${entry.name}.`)),
    })),
    examples,
  };

  await fs.writeFile(path.join(DIST_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

function packageFromPath(relativePath: string): PackageTheme {
  const normalized = relativePath.toLowerCase();
  if (normalized.startsWith("fabrica-elements/")) return "fabrica-elements";
  if (normalized.startsWith("fabrica/")) return "fabrica";
  if (normalized.startsWith("cipo/")) return "cipo";
  if (normalized.startsWith("broto/")) return "broto";
  if (normalized.startsWith(".github/") || normalized.startsWith("scripts/workflows/")) return "pipeline";
  return "default";
}
