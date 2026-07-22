import fs from "node:fs/promises";
import path from "node:path";
import { build as buildWithVite } from "vite";
import { cipoVite } from "@rodkisten/cipo/vite";
import { devtoolsCipoConfigCss } from "../devtools/cipo-config";
import { DIST_DIR, ROOT_DIR } from "./config";
import { createLandingConfig } from "./vite/shared-config";

export const DEVTOOLS_LANDING_DIR = path.join(DIST_DIR, "devtools");

export type BuildDevtoolsLandingOptions = {
  readonly outputDirectory?: string;
};

/** Normalizes legacy DevTools landing references for callers that still provide the old HTML shape. */
export function createBuiltDevtoolsLandingHtml(source: string): string {
  return source
    .replace(/\s*<base\s+href=["'][^"']*["']\s*\/?>(?:\s*)/i, "\n")
    .replace(/href=["']\/landing\.css["']/i, 'href="./landing.css"')
    .replace(/<script\s+type=["']module["']\s+src=["']\/landing\.ts["']\s*><\/script>/i, '<script defer src="./devtools.landing.js"></script>');
}

/** Builds the DevTools application page with the same Vite, Cipó, SEO and ecosystem-shell configuration as every other landing. */
export async function buildDevtoolsLanding(options: BuildDevtoolsLandingOptions = {}): Promise<string[]> {
  const sourceDirectory = path.join(ROOT_DIR, "devtools");
  const outputDirectory = options.outputDirectory ?? DEVTOOLS_LANDING_DIR;

  await buildWithVite(createLandingConfig({
    root: sourceDirectory,
    outDir: outputDirectory,
    projectId: "devtools",
    plugins: [
      cipoVite({
        root: ROOT_DIR,
        mode: "build",
        enabled: true,
        compileFabrica: true,
        transformCssTag: true,
        cssDelivery: "style-tag",
        configCss: devtoolsCipoConfigCss,
        configRuntimeBindings: ["devtoolsCipoConfigCss"],
        styledImportModules: ["@rodkisten/devtools/core/runtime"],
      }),
    ],
  }));

  return collectRelativeFiles(outputDirectory);
}

async function collectRelativeFiles(directory: string): Promise<string[]> {
  const output: string[] = [];

  async function walk(current: string): Promise<void> {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(absolutePath);
      else if (entry.isFile()) output.push(path.relative(DIST_DIR, absolutePath));
    }
  }

  await walk(directory);
  return output.sort();
}
