import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(SCRIPTS_DIR, "..");
/** @deprecated Prefer PACKAGE_DIRS — kept for gradual migration of collect helpers. */
export const SRC_DIR = ROOT_DIR;
export const DIST_DIR = path.join(ROOT_DIR, "dist");
export const DEFAULT_GLOBAL_NAMESPACE = "Rod";
export const ENTRY_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);

export const WORKSPACE_PACKAGES = [
  "broto",
  "cipo",
  "devtools",
  "fabrica",
  "fabrica-elements",
  "maquina",
  "nascente",
  "seiva-state",
  "rod",
] as const;


export type WorkspacePackageName = (typeof WORKSPACE_PACKAGES)[number];

/**
 * Returns the physical source candidates for a canonical workspace import.
 *
 * @remarks
 * DevTools intentionally keeps public imports grouped as `core/*` and `panels/*`
 * while the repository stores those modules as flat `core-*` and `panels-*` files.
 * Keeping that translation in the resolver preserves stable import specifiers without
 * coupling source code to the repository's current on-disk layout.
 */
export function workspaceSourceCandidates(
  packageName: WorkspacePackageName,
  subpath: string,
): string[] {
  const physicalSubpaths: string[] = [];

  if (packageName === "devtools" && subpath.startsWith("core/")) {
    const moduleName = subpath.slice("core/".length);

    // The current DevTools architecture keeps primary modules flat (`shell.ts`,
    // `context.ts`, `runtime.ts`) while a few legacy/internal modules still use
    // the `core-*` prefix. Prefer the current flat module and retain the prefixed
    // file as a compatibility fallback without changing canonical imports.
    physicalSubpaths.push(moduleName, `core-${moduleName}`);
  } else if (packageName === "devtools" && subpath.startsWith("panels/")) {
    const moduleName = subpath.slice("panels/".length);

    // Panel entrypoints and component modules are flat in the current source tree.
    // Shared/internal panel modules may still exist only as `panels-*` files.
    physicalSubpaths.push(moduleName, `panels-${moduleName}`);
  }

  // Preserve the canonical nested path as the final fallback for a future
  // directory-based layout. Canonical import specifiers remain stable either way.
  physicalSubpaths.push(subpath);

  const candidates: string[] = [];
  for (let index = 0; index < physicalSubpaths.length; index += 1) {
    const physicalSubpath = physicalSubpaths[index]!;
    candidates.push(
      path.join(ROOT_DIR, packageName, `${physicalSubpath}.ts`),
      path.join(ROOT_DIR, packageName, `${physicalSubpath}.tsx`),
      path.join(ROOT_DIR, packageName, physicalSubpath, "index.ts"),
    );
  }

  return candidates;
}

export type BuildMode = "development" | "production";

export type RootEntry = {
  name: string;
  fileName: string;
  absolutePath: string;
  relativePath: string;
  globalName: string;
  tool: ToolMetadata;
};

export type ToolMetadata = {
  name: string;
  globalName: string;
  description: string;
  packageName: string;
  tags: string[];
  entry: string;
};

export function readEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

export function readBooleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function toPascalCase(value: string): string {
  return value
    .replace(/\.[^.]+$/, "")
    .split(/[^a-zA-Z0-9]+/g)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");
}
