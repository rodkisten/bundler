import fs from "node:fs/promises";
import { collectExamplesByEntry } from "./example-extractor";
import { DIST_DIR, readEnv } from "./config";
import { discoverRootEntries } from "./discover-entries";
import { buildBrowserBundles } from "./build/browser-bundles";
import { buildDocumentationPortal } from "./build/documentation";
import { selectBuildEntries } from "./build/entries";
import { buildLandingPages } from "./build/landing-pages";
import { buildInfo, buildStep } from "./build/logger";
import { writeBuildManifest } from "./build/manifest";
import { writeSeoDiscoveryFiles } from "./build/seo";

const GLOBAL_NAMESPACE = readEnv("BUILD_GLOBAL_NAMESPACE", "Rod");
const REQUESTED_BUILD_ENTRIES = new Set(readEnv("BUILD_ENTRIES", "").split(",").map((entry) => entry.trim()).filter(Boolean));

export async function main(): Promise<void> {
  buildInfo(`Vite-first build started (${REQUESTED_BUILD_ENTRIES.size ? [...REQUESTED_BUILD_ENTRIES].join(", ") : "all"})`);

  await buildStep("Cleaning dist", () => fs.rm(DIST_DIR, { recursive: true, force: true }));
  await fs.mkdir(DIST_DIR, { recursive: true });

  const discoveredEntries = await buildStep("Discovering browser entries", discoverRootEntries);
  const entries = selectBuildEntries(discoveredEntries, REQUESTED_BUILD_ENTRIES);
  if (entries.length === 0) throw new Error("No buildable browser entries were selected.");

  const outputs = await buildStep("Building browser bundles with Vite", () => buildBrowserBundles(entries));
  const examples = await buildStep("Collecting source examples", () => collectExamplesByEntry(entries));

  const documentation = await buildStep("Building shared documentation portal", () => buildDocumentationPortal({
    entries,
    outputs,
    namespace: GLOBAL_NAMESPACE,
    examples,
  }));

  await buildStep("Building ecosystem landing pages", () => buildLandingPages(REQUESTED_BUILD_ENTRIES));
  await buildStep("Writing SEO discovery files", () => writeSeoDiscoveryFiles(documentation));
  await buildStep("Writing build manifest", () => writeBuildManifest(entries, outputs, documentation, examples, GLOBAL_NAMESPACE));

  buildInfo(`Build complete: ${entries.length} entries, ${outputs.length} bundles, ${documentation.docs.length} docs pages.`);
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
