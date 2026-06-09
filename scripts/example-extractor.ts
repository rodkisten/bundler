import fs from "node:fs/promises";
import path from "node:path";
import { SRC_DIR, type RootEntry } from "./config";

export type SourceExample = {
  title: string;
  file: string;
  code: string;
};

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const EXAMPLE_BLOCK_RE = /@example([^`]*)(?:```[\w-]*\n([\s\S]*?)```|\n([^@]*?)(?=\n\s*\*\s*@|\n\s*\*\/))/g;

export async function collectExamplesByEntry(entries: readonly RootEntry[]): Promise<Record<string, SourceExample[]>> {
  const files = await collectSourceFiles(SRC_DIR);
  const output: Record<string, SourceExample[]> = {};

  for (const entry of entries) {
    output[entry.name] = [];
  }

  for (const file of files) {
    const source = await fs.readFile(file, "utf8");
    const examples = extractExamples(source, path.relative(process.cwd(), file));
    const owner = findOwningEntry(file, entries);

    if (!owner || examples.length === 0) {
      continue;
    }

    output[owner.name] ??= [];
    output[owner.name].push(...examples);
  }

  return output;
}

async function collectSourceFiles(directory: string): Promise<string[]> {
  const dirents = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const dirent of dirents) {
    const absolutePath = path.join(directory, dirent.name);

    if (dirent.isDirectory()) {
      files.push(...(await collectSourceFiles(absolutePath)));
      continue;
    }

    if (!SOURCE_EXTENSIONS.has(path.extname(dirent.name)) || dirent.name.endsWith(".d.ts")) {
      continue;
    }

    files.push(absolutePath);
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function findOwningEntry(file: string, entries: readonly RootEntry[]): RootEntry | null {
  const relative = path.relative(SRC_DIR, file).replaceAll(path.sep, "/");
  const topLevelName = relative.split("/")[0]?.replace(/\.[^.]+$/, "") ?? "";

  return entries.find((entry) => entry.name === topLevelName) ?? null;
}

function extractExamples(source: string, file: string): SourceExample[] {
  const examples: SourceExample[] = [];
  let match: RegExpExecArray | null;

  while ((match = EXAMPLE_BLOCK_RE.exec(source))) {
    const title = cleanTitle(match[1] || "Example");
    const code = cleanExampleCode(match[2] || match[3] || "");

    if (!code) {
      continue;
    }

    examples.push({ title, file, code });
  }

  return examples;
}

function cleanTitle(value: string): string {
  return value
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .filter(Boolean)
    .join(" ") || "Example";
}

function cleanExampleCode(value: string): string {
  return value
    .split("\n")
    .map((line) => line.replace(/^\s*\* ?/, ""))
    .join("\n")
    .trim();
}
