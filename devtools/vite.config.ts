import { execFileSync } from "node:child_process";
import { copyFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { cipoVite } from "@rodkisten/cipo/vite-compiled-inline";
import { devtoolsCipoConfigCss } from "@rodkisten/devtools/cipo-config";
import { buildDevtoolsLanding } from "../scripts/build-devtools-landing";
import { findArray } from "@rodkisten/nascente";

const devtoolsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(devtoolsDir, "..");
const packageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8")) as { version?: string };

function shortCommitSha(): { full: string; short: string } {
  const full = process.env.RODERUDA_BUILD_SHA?.trim() || process.env.GITHUB_SHA?.trim() || (() => {
    try {
      return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
    } catch {
      return "development";
    }
  })();

  return { full, short: full === "development" ? "dev" : full.slice(0, 7) };
}

function buildMetadata() {
  const now = new Date();
  const commit = shortCommitSha();
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => findArray(parts, (part) => part.type === type)?.value ?? "";
  const date = `${value("day")}/${value("month")}/${value("year")}`;
  const time = `${value("hour")}:${value("minute")}`;

  return {
    sha: commit.full,
    shortSha: commit.short,
    builtAt: now.toISOString(),
    builtAtGmtMinus3: `${date} ${time} GMT-3`,
    buildDateShort: date,
    buildTimeShort: time,
    timezone: "GMT-3" as const,
    mode: process.env.NODE_ENV ?? "prod",
    version: packageJson.version ?? "0.0.0",
  };
}

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

const buildInfo = buildMetadata();

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
      configCss: devtoolsCipoConfigCss,
    }),
  ],
});
