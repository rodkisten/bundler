import { resolve } from "node:path";
import { defineConfig } from "vite";
import { cipoVite } from "../cipo/src/vite";

const repoRoot = resolve(__dirname, "../..");
export default defineConfig({
  root: __dirname,
  server: { open: "/index.html" },
  build: {
    outDir: "dist",
    lib: { entry: resolve(__dirname, "index.ts"), name: "Maquina", formats: ["es", "iife"], fileName: (format) => `maquina.${format}.js` },
  },
  plugins: [cipoVite({ root: repoRoot, include: /[/\\]src[/\\]maquina[/\\].*\.[cm]?[jt]sx?$/, mode: "build", enabled: true, cssDelivery: "style-tag", compileFabrica: true, transformCssTag: true, classPrefix: "maq" })],
});
