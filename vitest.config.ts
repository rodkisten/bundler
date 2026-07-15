import path from "node:path";
import { defineConfig } from "vitest/config";

const root = __dirname;

const alias = {
  "@rodkisten/broto": path.resolve(root, "broto/index.ts"),
  "@rodkisten/cipo": path.resolve(root, "cipo/index.ts"),
  "@rodkisten/devtools": path.resolve(root, "devtools/index.ts"),
  "@rodkisten/fabrica": path.resolve(root, "fabrica/index.ts"),
  "@rodkisten/fabrica-elements": path.resolve(root, "fabrica-elements/index.ts"),
  "@rodkisten/maquina": path.resolve(root, "maquina/index.ts"),
  "@rodkisten/seiva-state": path.resolve(root, "seiva-state/index.ts"),
  "@rodkisten/rod": path.resolve(root, "rod/index.ts"),
};

export default defineConfig({
  resolve: {
    alias: [
      ...Object.entries(alias).map(([find, replacement]) => ({ find, replacement })),
      { find: /^@rodkisten\/broto\/(.*)$/, replacement: path.resolve(root, "broto/$1.ts") },
      { find: /^@rodkisten\/cipo\/(.*)$/, replacement: path.resolve(root, "cipo/$1.ts") },
      { find: /^@rodkisten\/devtools\/(.*)$/, replacement: path.resolve(root, "devtools/$1.ts") },
      { find: /^@rodkisten\/fabrica\/(.*)$/, replacement: path.resolve(root, "fabrica/$1.ts") },
      { find: /^@rodkisten\/fabrica-elements\/(.*)$/, replacement: path.resolve(root, "fabrica-elements/$1.ts") },
      { find: /^@rodkisten\/maquina\/(.*)$/, replacement: path.resolve(root, "maquina/$1.ts") },
      { find: /^@rodkisten\/seiva-state\/(.*)$/, replacement: path.resolve(root, "seiva-state/$1.ts") },
      { find: /^@rodkisten\/rod\/(.*)$/, replacement: path.resolve(root, "rod/$1.ts") },
    ],
  },
  test: {
    // DevTools integration tests intentionally mount every panel, inject the
    // complete Cipó stylesheet registry and, for bundle smoke coverage, invoke
    // a production Vite build. CI runners regularly need more than Vitest's
    // five-second unit-test default for those integration-heavy cases.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
