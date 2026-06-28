import fs from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_GLOBAL_NAMESPACE,
  ENTRY_EXTENSIONS,
  SRC_DIR,
  toPascalCase,
  type RootEntry,
  type ToolMetadata,
} from "./config";

const TOOL_COMMENT_RE = /\/\*\*([\s\S]*?)\*\//;
const TAG_RE = /@([a-zA-Z][\w-]*)\s+([^@\n\r]*)/g;

const DEFAULT_IGNORED_ROOT_ENTRIES = new Set([
  "seiva",
  "index",
]);

export async function discoverRootEntries(): Promise<RootEntry[]> {
  const dirents = await fs.readdir(SRC_DIR, { withFileTypes: true });
  const entries: RootEntry[] = [];

  for (const dirent of dirents) {
    if (!dirent.isFile()) continue;

    const extension = path.extname(dirent.name);
    if (!ENTRY_EXTENSIONS.has(extension)) continue;
    if (dirent.name.endsWith(".d.ts")) continue;

    const name = dirent.name.slice(0, -extension.length);
    if (DEFAULT_IGNORED_ROOT_ENTRIES.has(name)) continue;

    const absolutePath = path.join(SRC_DIR, dirent.name);
    const source = await fs.readFile(absolutePath, "utf8");
    const fallbackGlobal = name === "index" ? DEFAULT_GLOBAL_NAMESPACE : toPascalCase(name);

    const tool = parseToolMetadata(source, {
      name,
      globalName: fallbackGlobal,
      entry: `src/${dirent.name}`,
    });

    entries.push({
      name,
      fileName: dirent.name,
      absolutePath,
      relativePath: `src/${dirent.name}`,
      globalName: tool.globalName || fallbackGlobal,
      tool,
    });
  }

  return entries.sort((left, right) => left.name.localeCompare(right.name));
}

export function parseToolMetadata(
  source: string,
  fallback: Pick<ToolMetadata, "name" | "globalName" | "entry">,
): ToolMetadata {
  const comment = source.match(TOOL_COMMENT_RE)?.[1] ?? "";
  const tags = new Map<string, string>();

  TAG_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = TAG_RE.exec(comment))) {
    const key = match[1]?.toLowerCase();
    if (!key) continue;

    tags.set(key, cleanCommentLine(match[2] ?? ""));
  }

  const description =
    tags.get("description") ||
    extractDescription(comment) ||
    `Browser tool generated from ${fallback.entry}.`;

  const tagList = (tags.get("tags") || "")
    .split(/[ ,]+/g)
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    name: tags.get("tool") || tags.get("name") || fallback.name,
    globalName: tags.get("global") || fallback.globalName,
    description,
    packageName: tags.get("package") || fallback.name,
    tags: tagList,
    entry: fallback.entry,
  };
}

function extractDescription(comment: string): string {
  const lines = comment
    .split("\n")
    .map(cleanCommentLine)
    .filter((line) => line.length > 0 && !line.startsWith("@"));

  return lines[0] ?? "";
}

function cleanCommentLine(line: string): string {
  return line.replace(/^\s*\*\s?/, "").trim();
}
