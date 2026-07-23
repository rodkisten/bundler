import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { UserConfig } from "vite";
import { cipoVite } from "@rodkisten/cipo/vite";
import { devtoolsCipoConfigCss } from "../../devtools/cipo-config";
import { maquinaCipoConfigCss } from "../../maquina/cipo-config";
import { createBuildMetadata, createIifeBuildBanner, readPackageVersion } from "../build-metadata";
import { buildInfoVite } from "../vite-build-info";
import { ecosystemSitePlugin } from "./site-plugin";
import { createMultiFormatLibraryConfig } from "./shared-config";

const scriptsViteDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptsViteDir, "../..");

export function createDevtoolsProjectConfig(): UserConfig {
  const root = resolve(repoRoot, "devtools");
  const buildInfo = createBuildMetadata({ root: repoRoot, version: readPackageVersion(repoRoot), mode: process.env.NODE_ENV ?? "prod" });
  const banner = createIifeBuildBanner(buildInfo, {
    tool: "RodEruda DevTools",
    globalName: "DevTools",
    entry: "devtools/index.ts",
    description: "RodEruda browser DevTools bundle",
    generatedBy: "Rod shared Vite build",
  });

  return {
    ...createMultiFormatLibraryConfig({
      root,
      entry: resolve(root, "index.ts"),
      outDir: resolve(repoRoot, "dist"),
      globalName: "DevTools",
      baseFileName: "devtools",
      formats: ["es", "cjs", "umd", "iife"],
      banner,
      define: {
        __RODERUDA_BUILD__: JSON.stringify(buildInfo),
        __DEV__: "false",
      },
      plugins: [
        ecosystemSitePlugin({ projectId: "devtools" }),
        buildInfoVite({ packageName: "devtools" }),
        cipoVite({
          root: repoRoot,
          mode: "build",
          enabled: true,
          cssDelivery: "style-tag",
          manifestFileName: "devtools.cipo.compiled.manifest.json",
          compileFabrica: true,
          transformCssTag: true,
          styledImportModules: ["@rodkisten/devtools/core/runtime"],
          configCss: devtoolsCipoConfigCss,
        }),
      ],
    }),
    server: { watch: { usePolling: true }, open: "/index.html" },
  };
}

export function createMaquinaProjectConfig(): UserConfig {
  const root = resolve(repoRoot, "maquina");
  const buildInfo = createBuildMetadata({ root: repoRoot, version: readPackageVersion(repoRoot), mode: process.env.NODE_ENV ?? "prod" });
  const banner = createIifeBuildBanner(buildInfo, {
    tool: "Máquina",
    globalName: "Maquina",
    entry: "maquina/index.ts",
    description: "Máquina browser bundle",
    generatedBy: "Rod shared Vite build",
  });

  return {
    ...createMultiFormatLibraryConfig({
      root,
      entry: resolve(root, "index.ts"),
      outDir: resolve(root, "dist"),
      globalName: "Maquina",
      baseFileName: "maquina",
      formats: ["es", "cjs", "umd", "iife"],
      banner,
      plugins: [
        ecosystemSitePlugin({ projectId: "maquina" }),
        buildInfoVite({ packageName: "maquina" }),
        cipoVite({
          root: repoRoot,
          mode: "build",
          enabled: true,
          cssDelivery: "style-tag",
          compileFabrica: true,
          transformCssTag: true,
          configCss: maquinaCipoConfigCss,
          configRuntimeBindings: ["maquinaCipoConfigCss"],
        }),
      ],
    }),
    server: { open: "/index.html" },
  };
}
