import { resolve } from "node:path";
import { defineConfig } from "vite";
import { cipoVite } from "../cipo/src/vite";

const repoRoot = resolve(__dirname, "../..");

export default defineConfig({
  root: __dirname,

  server: {
    open: "/index.html",
  },

  build: {
    lib: {
      entry: resolve(__dirname, "./index.ts"),
      formats: ["es", "cjs", "umd", "iife"],
      name: "DevTools",
      fileName: (format) => `devtools.${format}.js`,
    },
  },

  plugins: [
    cipoVite({
      root: repoRoot,
      include: /[/\\]src[/\\]devtools[/\\].*\.[cm]?[jt]sx?$/,
      mode: "build",
      enabled: false,
      cssDelivery: "style-tag",
      compileFabrica: false,
      transformCssTag: true,
    }),
  ],
});
