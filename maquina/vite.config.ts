import { resolve } from "node:path";
import { defineConfig } from "vite";
import { cipoVite } from "@rodkisten/cipo/vite-compiled-inline";

const repoRoot = resolve(__dirname, "..");

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: [
      { find: "@rodkisten/maquina", replacement: resolve(__dirname, "index.ts") },
      { find: /^@rodkisten\/maquina\/(.*)$/, replacement: resolve(__dirname, "$1.ts") },
      { find: "@rodkisten/cipo", replacement: resolve(repoRoot, "cipo/index.ts") },
      { find: /^@rodkisten\/cipo\/(.*)$/, replacement: resolve(repoRoot, "cipo/$1.ts") },
      { find: "@rodkisten/broto", replacement: resolve(repoRoot, "broto/index.ts") },
      { find: /^@rodkisten\/broto\/(.*)$/, replacement: resolve(repoRoot, "broto/$1.ts") },
      { find: "@rodkisten/fabrica", replacement: resolve(repoRoot, "fabrica/index.ts") },
      { find: /^@rodkisten\/fabrica\/(.*)$/, replacement: resolve(repoRoot, "fabrica/$1.ts") },
    ],
  },
  server: { open: "/index.html" },
  build: {
    outDir: "dist",
    lib: {
      entry: resolve(__dirname, "index.ts"),
      name: "Maquina",
      formats: ["es", "iife"],
      fileName: (format) => `maquina.${format}.js`,
    },
  },
  plugins: [
    cipoVite({
      root: repoRoot,
      include: /[/\\]maquina[/\\].*\.[cm]?[jt]sx?$/,
      mode: "build",
      enabled: true,
      cssDelivery: "style-tag",
      compileFabrica: true,
      transformCssTag: true,
      classPrefix: "maq",
    }),
  ],
});
