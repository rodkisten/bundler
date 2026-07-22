import fs from "node:fs/promises";
import path from "node:path";
import { DIST_DIR } from "../config";
import type { DocumentationBuildResult } from "./documentation";
import { absoluteSiteUrl, BUNDLER_BASE_PATH, ECOSYSTEM_PROJECTS } from "../site/ecosystem";

/** Writes crawl metadata for every generated public page under rod.migos.club/bundler. */
export async function writeSeoDiscoveryFiles(documentation: DocumentationBuildResult): Promise<void> {
  const documentationPaths = [
    ...documentation.docs,
    ...documentation.sources,
    ...documentation.tests,
    ...documentation.pipelines,
    ...documentation.benchmarks,
  ].map((item) => `${BUNDLER_BASE_PATH}/${item.href}`);

  const urls = new Set([
    ...ECOSYSTEM_PROJECTS.map((project) => absoluteSiteUrl(project.path)),
    ...documentationPaths.map(absoluteSiteUrl),
  ]);

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...urls]
    .sort()
    .map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`)
    .join("\n")}\n</urlset>\n`;

  const robots = `User-agent: *\nAllow: /\n\nSitemap: ${absoluteSiteUrl(`${BUNDLER_BASE_PATH}/sitemap.xml`)}\n`;

  await Promise.all([
    fs.writeFile(path.join(DIST_DIR, "sitemap.xml"), sitemap),
    fs.writeFile(path.join(DIST_DIR, "robots.txt"), robots),
  ]);
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character] ?? character);
}
