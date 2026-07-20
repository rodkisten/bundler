import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { cipoVite } from "@rodkisten/cipo/vite";
import { maquinaCipoConfigCss } from "@rodkisten/maquina/cipo-config";
import {
  createBuildMetadata,
  createIifeBuildBanner,
  readPackageVersion,
} from "../scripts/build-metadata";
import { buildViteInfo } from "../scripts/vite-build-info";

const maquinaDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(maquinaDir, "..");
const buildInfo = createBuildMetadata({
  root: repoRoot,
  version: readPackageVersion(repoRoot),
  mode: process.env.NODE_ENV ?? "prod",
});
const iifeBanner = createIifeBuildBanner(buildInfo, {
  tool: "Máquina",
  globalName: "Maquina",
  entry: "maquina/index.ts",
  description: "Máquina browser IIFE bundle",
  generatedBy: "Rod Máquina Vite build",
});

export default defineConfig({
  root: maquinaDir,
  resolve: {
    // Vite 8 reads compilerOptions.paths directly from the matching tsconfig.
    tsconfigPaths: true,
  },
  server: { open: "/index.html" },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        banner: (chunk) =>
          chunk.fileName.endsWith(".iife.js") ? iifeBanner : "",
      },
    },
    lib: {
      entry: resolve(maquinaDir, "index.ts"),
      name: "Maquina",
      formats: ["es", "iife"],
      fileName: (format) => `maquina.${format}.js`,
    },
  },
  plugins: [
    buildInfoVite({
      packageName: "maquina",
    }),

    cipoVite({
      root: repoRoot,
      mode: "build",
      enabled: true,
      cssDelivery: "style-tag",
      compileFabrica: true,
      transformCssTag: true,
      configCss: maquinaCipoConfigCss,
    }),
  ],
});
