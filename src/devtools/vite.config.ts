import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build as buildWithEsbuild } from "esbuild";
import { defineConfig, type Plugin } from "vite";
import { cipoVite } from "../cipo/src/vite";
import { devtoolsCipoConfigCss } from "./cipo-config";

const repoRoot = resolve(__dirname, "../..");
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
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
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
    mode: process.env.NODE_ENV ?? "production",
    version: packageJson.version ?? "0.0.0",
  };
}

function devtoolsLandingPlugin(): Plugin {
  const outputDirectory = resolve(__dirname, "dist");
  const htmlSource = resolve(__dirname, "index.html");
  const cssSource = resolve(__dirname, "landing.css");
  const scriptSource = resolve(__dirname, "landing.ts");

  return {
    name: "roderuda-devtools-landing",
    apply: "build",

    async closeBundle() {
      await mkdir(outputDirectory, { recursive: true });

      await buildWithEsbuild({
        entryPoints: [scriptSource],
        outfile: resolve(outputDirectory, "devtools.landing.js"),
        bundle: true,
        format: "iife",
        platform: "browser",
        target: ["es2022", "safari16.4"],
        minify: true,
        sourcemap: true,
        legalComments: "none",
      });

      await copyFile(cssSource, resolve(outputDirectory, "landing.css"));

      const html = (await readFile(htmlSource, "utf8"))
        .replace('href="/landing.css"', 'href="./landing.css"')
        .replace('type="module" src="/landing.ts"', 'defer src="./devtools.landing.js"');

      await writeFile(resolve(outputDirectory, "index.html"), html, "utf8");
    },
  };
}

const buildInfo = buildMetadata();

export default defineConfig({
  root: __dirname,

  define: {
    __RODERUDA_BUILD__: JSON.stringify(buildInfo),
  },

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
    devtoolsLandingPlugin(),
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
