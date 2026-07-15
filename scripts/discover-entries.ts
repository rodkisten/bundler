import fs from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_GLOBAL_NAMESPACE,
  ROOT_DIR,
  WORKSPACE_PACKAGES,
  toPascalCase,
  type RootEntry,
  type ToolMetadata,
} from "./config";

const TOOL_COMMENT_RE = /\/\*\*([\s\S]*?)\*\//;
const TAG_RE = /@([a-zA-Z][\w-]*)\s+([^@\n\r]*)/g;

/** Map published browser globals to workspace package folders. */
const ENTRY_PACKAGE_ALIASES: Record<string, string> = {
  bundle: "rod",
  index: "rod",
  rod: "rod",
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolvePackageEntry(packageName: string): Promise<{ absolutePath: string; relativePath: string; fileName: string } | null> {
  const candidates = [
    `browser-entry.ts`,
    `index.ts`,
    `bundle.ts`,
  ];

  for (const fileName of candidates) {
    const absolutePath = path.join(ROOT_DIR, packageName, fileName);
    if (await fileExists(absolutePath)) {
      return {
        absolutePath,
        relativePath: `${packageName}/${fileName}`,
        fileName,
      };
    }
  }

  return null;
}

export async function discoverRootEntries(): Promise<RootEntry[]> {
  const entries: RootEntry[] = [];
  const seen = new Set<string>();

  // Prefer explicit browser entries from workspace packages.
  for (const packageName of WORKSPACE_PACKAGES) {
    const resolved = await resolvePackageEntry(packageName);
    if (!resolved) continue;

    // rod exposes both Rod (index) and Bundle aliases depending on entry file.
    const names =
      packageName === "rod"
        ? resolved.fileName.startsWith("bundle")
          ? ["bundle"]
          : ["rod", "index"]
        : [packageName];

    for (const name of names) {
      if (seen.has(name)) continue;
      seen.add(name);

      // For rod/index we want the index entry file; for bundle, bundle.ts.
      let entryFile = resolved;
      if (packageName === "rod" && name === "bundle") {
        const bundlePath = path.join(ROOT_DIR, "rod", "bundle.ts");
        if (await fileExists(bundlePath)) {
          entryFile = {
            absolutePath: bundlePath,
            relativePath: "rod/bundle.ts",
            fileName: "bundle.ts",
          };
        }
      } else if (packageName === "rod" && (name === "rod" || name === "index")) {
        const indexPath = path.join(ROOT_DIR, "rod", "index.ts");
        if (await fileExists(indexPath)) {
          entryFile = {
            absolutePath: indexPath,
            relativePath: "rod/index.ts",
            fileName: "index.ts",
          };
        }
      }

      const source = await fs.readFile(entryFile.absolutePath, "utf8");
      const fallbackGlobal = name === "index" || name === "rod" || name === "bundle"
        ? DEFAULT_GLOBAL_NAMESPACE
        : toPascalCase(name);

      const tool = parseToolMetadata(source, {
        name,
        globalName: fallbackGlobal,
        entry: entryFile.relativePath,
      });

      entries.push({
        name,
        fileName: entryFile.fileName,
        absolutePath: entryFile.absolutePath,
        relativePath: entryFile.relativePath,
        globalName: tool.globalName || fallbackGlobal,
        tool,
      });
    }
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
    packageName: tags.get("package") || ENTRY_PACKAGE_ALIASES[fallback.name] || fallback.name,
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
