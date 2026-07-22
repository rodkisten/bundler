import fs from "node:fs/promises";
import path from "node:path";
import { build as viteBuild } from "vite";
import { ROOT_DIR, WORKSPACE_PACKAGES, type WorkspacePackageName } from "./config";
import { buildStep } from "./build/logger";
import { createPackageModulesConfig } from "./vite/shared-config";

const packageName = process.argv[2] as WorkspacePackageName | undefined;

if (!packageName || !(WORKSPACE_PACKAGES as readonly string[]).includes(packageName)) {
  throw new Error(`Usage: tsx scripts/build-package.ts <${WORKSPACE_PACKAGES.join("|")}>`);
}

const PACKAGE_OUTPUT_TO_DIST = new Set<WorkspacePackageName>(["cipo", "fabrica"]);
const EXCLUDE_BROWSER_ENTRY = new Set<WorkspacePackageName>(["broto", "devtools", "fabrica-elements", "maquina", "nascente", "rod", "seiva-state"]);

await buildStep(`Building @rodkisten/${packageName} modules with Vite`, async () => {
  const packageDir = path.join(ROOT_DIR, packageName);
  const outDir = PACKAGE_OUTPUT_TO_DIST.has(packageName) ? path.join(packageDir, "dist") : packageDir;
  const sourceFiles = await collectPackageSources(packageDir, EXCLUDE_BROWSER_ENTRY.has(packageName));
  const input = Object.fromEntries(sourceFiles.map((absolutePath) => [withoutExtension(toPosix(path.relative(packageDir, absolutePath))), absolutePath]));

  if (PACKAGE_OUTPUT_TO_DIST.has(packageName)) {
    await fs.rm(outDir, { recursive: true, force: true });
  }

  const config = createPackageModulesConfig({
    root: packageDir,
    outDir,
    input,
  });

  await viteBuild(config);
});

async function collectPackageSources(packageDir: string, excludeBrowserEntry: boolean): Promise<string[]> {
  const files: string[] = [];

  async function walk(directory: string): Promise<void> {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = toPosix(path.relative(packageDir, absolutePath));

      if (entry.isDirectory()) {
        if (["dist", "test", "tests", "examples", "node_modules"].includes(entry.name)) continue;
        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile() || !/\.(?:ts|tsx)$/.test(entry.name) || entry.name.endsWith(".d.ts")) continue;
      if (/\.(?:test|spec|bench)\.(?:ts|tsx)$/.test(entry.name)) continue;
      if (entry.name === "vite.config.ts" || entry.name === "vitest.config.ts") continue;
      if (excludeBrowserEntry && relativePath === "browser-entry.ts") continue;
      files.push(absolutePath);
    }
  }

  await walk(packageDir);
  return files.sort();
}

function withoutExtension(value: string): string {
  return value.replace(/\.(?:tsx|ts)$/i, "");
}

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}
