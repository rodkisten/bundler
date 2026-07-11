import { resolve } from "node:path";
import { defineConfig } from "vite";
import { cipoVite } from "../cipo/src/vite";
import { devtoolsCipoConfigCss } from "./cipo-config";

const repoRoot = resolve(__dirname, "../..");

export default defineConfig({
  root: __dirname,

  resolve: {
    alias: {
      "@/devtools": resolve(__dirname, "."),
    },
  },

  server: {
    open: "/index.html",
  },

  build: {
    lib: {
      entry: resolve(__dirname, "./index.ts"),
      formats: ["es", "cjs", "umd", "iife"],
      name: "DevTools",
      fileName: (format: string) => `devtools.${format}.js`,
    },
  },

  plugins: [
    cipoVite({
      root: repoRoot,
      include: /[/\\]src[/\\]devtools[/\\].*\.[cm]?[jt]sx?$/,
      mode: "build",
      enabled: true,
      cssDelivery: "style-tag",
      compileFabrica: true,
      transformCssTag: true,
      classPrefix: "rd",
      configCss: devtoolsCipoConfigCss,
    }),
  ],
});
