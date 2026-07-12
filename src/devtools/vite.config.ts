import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
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
