import fs from "node:fs/promises";
import path from "node:path";
import { DIST_DIR, readEnv } from "./config";

type GistFile = { content: string };

export async function main(): Promise<void> {
  const token = readEnv("GIST_TOKEN", "");
  const gistId = readEnv("GIST_ID", "");
  const description = readEnv("GIST_DESCRIPTION", "Rod browser tool builds");

  if (!token) throw new Error("GIST_TOKEN is required to publish a public gist.");

  const files = await collectDistFiles();
  const response = await fetch(gistId ? `https://api.github.com/gists/${gistId}` : "https://api.github.com/gists", {
    method: gistId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ public: true, description, files }),
  });

  if (!response.ok) {
    throw new Error(`Gist publish failed: ${response.status} ${await response.text()}`);
  }

  console.log(`Published ${Object.keys(files).length} files to gist.`);
}

export async function collectDistFiles(): Promise<Record<string, GistFile>> {
  const files: Record<string, GistFile> = {};
  await walkDist(DIST_DIR, async (absolutePath) => {
    const relativePath = path.relative(DIST_DIR, absolutePath).replaceAll(path.sep, "/");
    files[relativePath] = { content: await fs.readFile(absolutePath, "utf8") };
  });
  return files;
}

async function walkDist(directory: string, onFile: (absolutePath: string) => Promise<void>): Promise<void> {
  const dirents = await fs.readdir(directory, { withFileTypes: true });
  for (const dirent of dirents) {
    const absolutePath = path.join(directory, dirent.name);
    if (dirent.isDirectory()) {
      await walkDist(absolutePath, onFile);
      continue;
    }
    if (dirent.isFile()) await onFile(absolutePath);
  }
}

await main();
