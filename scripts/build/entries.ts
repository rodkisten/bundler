import type { RootEntry } from "../config";

export function selectBuildEntries(entries: RootEntry[], requested: ReadonlySet<string>): RootEntry[] {
  const buildable = entries.filter((entry) => {
    const parts = entry.relativePath.replace(/\\/g, "/").split("/").filter(Boolean);
    return parts.length === 2 && /\.(?:ts|tsx|js|jsx|mjs)$/.test(parts[1] ?? "") && !entry.relativePath.endsWith(".d.ts");
  });

  if (requested.size === 0 || requested.has("all")) return buildable;

  const available = new Set(buildable.map((entry) => entry.name));
  const unknown = [...requested].filter((name) => !available.has(name));
  if (unknown.length > 0) throw new Error(`Unknown BUILD_ENTRIES value(s): ${unknown.join(", ")}. Available entries: ${[...available].sort().join(", ")}.`);

  return buildable.filter((entry) => requested.has(entry.name));
}
