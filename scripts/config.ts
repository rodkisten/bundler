import path from "node:path";

export const ROOT_DIR = process.cwd();
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
