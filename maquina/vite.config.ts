import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { cipoVite } from "@rodkisten/cipo/vite-compiled-inline";
import { maquinaCipoConfigCss } from "@rodkisten/maquina/cipo-config";

const maquinaDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(maquinaDir, "..");

export default defineConfig({
  root: maquinaDir,
  server: { open: "/index.html" },
  build: {
    outDir: "dist",
    lib: {
      entry: resolve(maquinaDir, "index.ts"),
      name: "Maquina",
      formats: ["es", "iife"],
      fileName: (format) => `maquina.${format}.js`,
    },
  },
  plugins: [
    // The native+tsx config loader resolves config-time aliases; this plugin resolves the Vite module graph.
    tsconfigPaths({ root: repoRoot, projects: ["tsconfig.base.json"] }),
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
