import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { DIST_DIR, readEnv } from "./config";

const githubToken = process.env.GIST_TOKEN ?? process.env.GITHUB_TOKEN;
const gistId = process.env.GIST_ID;
const description = readEnv("GIST_DESCRIPTION", "Browser bundle generated from a private TypeScript repository");

/**
 * Publishes the generated bundle files to a public GitHub Gist.
 *
 * @returns A promise that resolves when the gist API call succeeds.
 *
 * @example
 * ```ts
 * await main();
 * // The configured public gist contains bundle.esm.js and bundle.iife.js.
 * ```
 */
async function main(): Promise<void> {
  if (!githubToken) {
    throw new Error("Missing GIST_TOKEN or GITHUB_TOKEN.");
  }

  const files = {
    "bundle.esm.js": { content: await readDistFile("bundle.esm.js") },
    "bundle.iife.js": { content: await readDistFile("bundle.iife.js") },
    "index.html": { content: await readDistFile("index.html") },
  };

  const endpoint = gistId
    ? `https://api.github.com/gists/${gistId}`
    : "https://api.github.com/gists";

  const method = gistId ? "PATCH" : "POST";

  const response = await fetch(endpoint, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubToken}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      description,
      public: true,
      files,
    }),
  });

  const payload = await response.json() as { html_url?: string; message?: string };

  if (!response.ok) {
    throw new Error(`GitHub Gist publish failed: ${payload.message ?? response.statusText}`);
  }

  console.log(`✅ Gist published: ${payload.html_url ?? "unknown URL"}`);
}

/**
 * Reads one generated distribution file.
 *
 * @param fileName - File name inside the dist directory.
 * @returns The file content as UTF-8 text.
 *
 * @example
 * ```ts
 * await readDistFile("bundle.esm.js");
 * // "export {...}"
 * ```
 */
async function readDistFile(fileName: string): Promise<string> {
  return fs.readFile(path.join(DIST_DIR, fileName), "utf8");
}

await main();
