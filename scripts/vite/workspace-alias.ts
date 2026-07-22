import fs from "node:fs/promises";
import type { Plugin } from "vite";
import { WORKSPACE_PACKAGES, workspaceSourceCandidates, type WorkspacePackageName } from "../config";

/** Resolves canonical @rodkisten/* imports directly to workspace TypeScript sources. */
export function workspaceAliasPlugin(): Plugin {
  return {
    name: "rod-workspace-alias",
    enforce: "pre",
    async resolveId(id) {
      if (!id.startsWith("@rodkisten/")) return null;

      const rest = id.slice("@rodkisten/".length);
      const slash = rest.indexOf("/");
      const packageName = slash === -1 ? rest : rest.slice(0, slash);
      const subpath = slash === -1 ? "index" : rest.slice(slash + 1);

      if (!(WORKSPACE_PACKAGES as readonly string[]).includes(packageName)) return null;

      const candidates = workspaceSourceCandidates(packageName as WorkspacePackageName, subpath);
      for (const candidate of candidates) {
        try {
          await fs.access(candidate);
          return candidate;
        } catch {
          // Keep trying canonical source candidates before falling back.
        }
      }

      return candidates[0] ?? null;
    },
  };
}
