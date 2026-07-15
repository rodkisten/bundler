import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vitest/config";

const root = __dirname;
const PACKAGES = [
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

function workspaceSourcePlugin(): Plugin {
  return {
    name: "rodkisten-workspace-source",
    enforce: "pre",
    resolveId(id) {
      if (!id.startsWith("@rodkisten/")) return null;
      const rest = id.slice("@rodkisten/".length);
      const slash = rest.indexOf("/");
      const pkg = slash === -1 ? rest : rest.slice(0, slash);
      const subpath = slash === -1 ? "index" : rest.slice(slash + 1);
      if (!(PACKAGES as readonly string[]).includes(pkg)) return null;

      const candidates = [
        path.join(root, pkg, `${subpath}.ts`),
        path.join(root, pkg, `${subpath}.tsx`),
        path.join(root, pkg, subpath, "index.ts"),
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [workspaceSourcePlugin()],
  test: {
    // DevTools integration tests intentionally mount every panel, inject the
    // complete Cipó stylesheet registry and, for bundle smoke coverage, invoke
    // a production Vite build. CI runners regularly need more than Vitest's
    // five-second unit-test default for those integration-heavy cases.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
