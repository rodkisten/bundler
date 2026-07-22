import fs from "node:fs/promises";
import path from "node:path";
import { build as viteBuild } from "vite";
import { cipoVite } from "@rodkisten/cipo/vite";
import { DIST_DIR, ROOT_DIR } from "../config";
import { buildDevtoolsLanding } from "../build-devtools-landing";
import { buildNascenteDocs } from "../build-nascente-docs";
import { createLandingConfig } from "../vite/shared-config";
import type { EcosystemProjectId } from "../site/ecosystem";
import { buildStep } from "./logger";

const STATIC_LANDINGS: readonly Exclude<EcosystemProjectId, "docs" | "devtools" | "nascente">[] = ["broto", "fabrica", "cipo", "maquina"];

export async function buildLandingPages(requestedEntries: ReadonlySet<string>): Promise<void> {
  const shouldBuildAll = requestedEntries.size === 0 || requestedEntries.has("all");

  for (const projectId of STATIC_LANDINGS) {
    if (!shouldBuildAll && !requestedEntries.has(projectId)) continue;
    await buildStaticLanding(projectId);
  }

  if (shouldBuildAll || requestedEntries.has("devtools")) {
    await buildStep("Building DevTools landing with shared Vite pipeline", () => buildDevtoolsLanding());
  }

  if (shouldBuildAll || requestedEntries.has("nascente")) {
    await buildNascenteLanding();
  }
}

async function buildStaticLanding(projectId: Exclude<EcosystemProjectId, "docs" | "devtools" | "nascente">): Promise<void> {
  const root = path.join(ROOT_DIR, projectId);
  const outDir = path.join(DIST_DIR, projectId);
  const plugins = projectId === "maquina"
    ? [cipoVite({ root: ROOT_DIR, mode: "build", enabled: true, cssDelivery: "style-tag", compileFabrica: true, transformCssTag: true })]
    : [];

  await buildStep(`Building ${projectId} landing`, async () => {
    await viteBuild(createLandingConfig({ root, outDir, projectId, plugins }));
  });
}

async function buildNascenteLanding(): Promise<void> {
  const generatedRoot = path.join(ROOT_DIR, ".cache", "nascente-site");
  await fs.rm(generatedRoot, { recursive: true, force: true });
  await fs.mkdir(generatedRoot, { recursive: true });
  await buildNascenteDocs({ outputDirectory: generatedRoot });

  await buildStep("Building Nascente docs landing through Vite", async () => {
    await viteBuild(createLandingConfig({
      root: generatedRoot,
      outDir: path.join(DIST_DIR, "nascente"),
      projectId: "nascente",
    }));
  });
  await fs.rm(generatedRoot, { recursive: true, force: true });
}
