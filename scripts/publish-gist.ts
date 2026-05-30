import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { DIST_DIR, readEnv } from "./config";

const githubToken = process.env.GIST_TOKEN ?? process.env.GITHUB_TOKEN;
const gistId = process.env.GIST_ID;
const description = readEnv(
  "GIST_DESCRIPTION",
  "Browser bundle generated from a private TypeScript repository",
);

/**
 * Publishes every generated distribution file to a GitHub Gist.
 *
 * @returns A promise that resolves when the gist API call succeeds.
 *
 * @example
 * ```ts
 * await main();
 * // The configured gist contains every generated dist file.
 * ```
 */
async function main(): Promise<void> {
  if (!githubToken) {
    throw new Error("Missing GIST_TOKEN or GITHUB_TOKEN.");
  }

  const files = await collectDistFiles();

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
      public: false,
      files,
    }),
  });

  const payload = (await response.json()) as {
    html_url?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(
      `GitHub Gist publish failed: ${payload.message ?? response.statusText}`,
    );
  }

  console.log(`✅ Gist published: ${payload.html_url ?? "unknown URL"}`);
}

/**
 * Collects every file from the dist directory and converts it into the Gist files payload.
 *
 * @returns A GitHub Gist files object keyed by relative file name.
 *
 * @example
 * ```ts
 * const files = await collectDistFiles();
 * // { "bundle.esm.js": { content: "..." } }
 * ```
 */
async function collectDistFiles(): Promise<Record<string, { content: string }>> {
  const files: Record<string, { content: string }> = {};

  await walkDist(DIST_DIR, async (absolutePath) => {
    const relativePath = path.relative(DIST_DIR, absolutePath).replaceAll(path.sep, "/");

    files[relativePath] = {
      content: await fs.readFile(absolutePath, "utf8"),
    };
  });

  return files;
}

/**
 * Walks through the dist directory recursively.
 *
 * @param directory - Directory to inspect.
 * @param onFile - Callback called for every file found.
 * @returns A promise that resolves after all files are visited.
 *
 * @example
 * ```ts
 * await walkDist("dist", async file => {
 *   console.log(file);
 * });
 * ```
 */
async function walkDist(
  directory: string,
  onFile: (absolutePath: string) => Promise<void>,
): Promise<void> {
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await walkDist(absolutePath, onFile);
      continue;
    }

    if (entry.isFile()) {
      await onFile(absolutePath);
    }
  }
}

await main();
