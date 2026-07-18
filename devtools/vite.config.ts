import { cipoVite } from "@rodkisten/cipo/vite-compiled-inline";
import { copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { buildDevtoolsLanding } from "../scripts/build-devtools-landing";
import {
  createBuildMetadata,
  createIifeBuildBanner,
  readPackageVersion,
} from "../scripts/build-metadata";
import { devtoolsStyles } from "./core-style";

const devtoolsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(devtoolsDir, "..");
const buildInfo = createBuildMetadata({
  root: repoRoot,
  version: readPackageVersion(repoRoot),
  mode: process.env.NODE_ENV ?? "prod",
});

const iifeBanner = createIifeBuildBanner(buildInfo, {
  tool: "RodEruda DevTools",
  globalName: "DevTools",
  entry: "devtools/index.ts",
  description: "RodEruda browser DevTools IIFE bundle",
  generatedBy: "Rod DevTools Vite build",
});

function devtoolsLandingPlugin(): Plugin {
  return {
    name: "roderuda-devtools-landing",
    apply: "build",

    async closeBundle() {
      // The standalone Vite build is the authoritative optimized DevTools output.
      // Keep the historical `.min.js` publication alias in sync with that output
      // so the earlier root build cannot leave a stale per-component-CSS bundle.
      await Promise.all([
        buildDevtoolsLanding(),
        copyFile(
          resolve(repoRoot, "dist/devtools.iife.js"),
          resolve(repoRoot, "dist/devtools.iife.min.js"),
        ),
      ]);
    },
  };
}


export default defineConfig({
  root: devtoolsDir,

  resolve: {
    // Vite 8 resolves compilerOptions.paths natively; keep aliases centralized in tsconfig.
    tsconfigPaths: true,
  },

  define: {
    __RODERUDA_BUILD__: JSON.stringify(buildInfo),
    __DEV__: "false",
    "process.env.NODE_ENV": JSON.stringify("production"),
  },

  server: {
    watch: {
      usePolling: true,
    },
    open: "/index.html",
  },

  build: {
    minify: "esbuild",
    sourcemap: true,
    outDir: resolve(repoRoot, "dist"),
    emptyOutDir: false,
    rollupOptions: {
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
      },
      output: {
        banner: (chunk) =>
          chunk.fileName.endsWith(".iife.js") ? iifeBanner : "",
      },
    },
    lib: {
      entry: resolve(devtoolsDir, "./index.ts"),
      formats: ["es", "cjs", "umd", "iife"],
      name: "DevTools",
      fileName: (format: string) => `devtools.${format}.js`,
    },
  },

  esbuild: {
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
    drop: ["debugger"],
    pure: ["console.debug", "console.trace"],
  },

  plugins: [
    devtoolsLandingPlugin(),
    cipoVite({
      root: repoRoot,
      mode: "build",
      enabled: true,
      cssDelivery: "style-tag",
      compileFabrica: true,
      transformCssTag: true,
      // The compiler intentionally follows the entire reachable workspace graph.
      // DevTools imports Maquina and shared Fábrica Elements components, so path
      // filtering here would leave nested styled templates uncompiled.
      // Class naming, minification, atomic promotion and tokens all come from CSS.
      configCss: devtoolsStyles.cssText,
    }),
  ],
});
