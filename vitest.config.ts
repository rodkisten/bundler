import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import VitestDebugReporter from "./scripts/vitest-debug-reporter";

const IS_GITHUB_ACTIONS = process.env.GITHUB_ACTIONS === "true";
const ROOT_DIR = fileURLToPath(new URL(".", import.meta.url));

function workspaceFile(path: string): string {
  return resolve(ROOT_DIR, path);
}
const DEBUG_TESTS = process.env.DEBUG_TESTS === "true";

export default defineConfig({
  resolve: {
    // Test files are intentionally excluded from package tsconfigs, so native
    // tsconfig path resolution cannot resolve workspace aliases for test importers.
    tsconfigPaths: true,
    alias: [
      { find: /^@rodkisten\/devtools$/, replacement: workspaceFile("devtools/index.ts") },
      { find: /^@rodkisten\/devtools\/core\/(runtime|context|controller|shell|tool)$/, replacement: workspaceFile("devtools/$1") },
      { find: /^@rodkisten\/devtools\/panels\/(elements|resources|sources)$/, replacement: workspaceFile("devtools/$1") },
      { find: /^@rodkisten\/devtools\/([^/]+)$/, replacement: workspaceFile("devtools/$1") },
      { find: /^@rodkisten\/broto$/, replacement: workspaceFile("broto/index.ts") },
      { find: /^@rodkisten\/broto\/(.+)$/, replacement: workspaceFile("broto/$1") },
      { find: /^@rodkisten\/cipo$/, replacement: workspaceFile("cipo/index.ts") },
      { find: /^@rodkisten\/cipo\/vite$/, replacement: workspaceFile("cipo/vite-index.ts") },
      { find: /^@rodkisten\/cipo\/(.+)$/, replacement: workspaceFile("cipo/$1") },
      { find: /^@rodkisten\/fabrica$/, replacement: workspaceFile("fabrica/index.ts") },
      { find: /^@rodkisten\/fabrica\/(.+)$/, replacement: workspaceFile("fabrica/$1") },
      { find: /^@rodkisten\/fabrica-elements$/, replacement: workspaceFile("fabrica-elements/index.ts") },
      { find: /^@rodkisten\/fabrica-elements\/(.+)$/, replacement: workspaceFile("fabrica-elements/$1") },
      { find: /^@rodkisten\/maquina$/, replacement: workspaceFile("maquina/index.ts") },
      { find: /^@rodkisten\/maquina\/(.+)$/, replacement: workspaceFile("maquina/$1") },
      { find: /^@rodkisten\/nascente$/, replacement: workspaceFile("nascente/index.ts") },
      { find: /^@rodkisten\/nascente\/(.+)$/, replacement: workspaceFile("nascente/$1") },
      { find: /^@rodkisten\/seiva-state$/, replacement: workspaceFile("seiva-state/index.ts") },
      { find: /^@rodkisten\/seiva-state\/(.+)$/, replacement: workspaceFile("seiva-state/$1") },
      { find: /^@rodkisten\/rod$/, replacement: workspaceFile("rod/index.ts") },
      { find: /^@rodkisten\/rod\/(.+)$/, replacement: workspaceFile("rod/$1") },
    ],
  },

  test: {
    testTimeout: 20_000,
    hookTimeout: 20_000,

    // Enable the debug reporter only when DEBUG_TESTS=true. Its output uses
    // regular stdout so the latest START/heartbeat line remains visible when
    // diagnosing a stalled CI run.
    //
    // The GitHub Actions and hanging-process reporters remain CI-only.
    reporters: IS_GITHUB_ACTIONS
      ? [
          ...(DEBUG_TESTS ? [new VitestDebugReporter()] : []),
          "verbose",
          "github-actions",
          "hanging-process",
        ]
      : [
          ...(DEBUG_TESTS ? [new VitestDebugReporter()] : []),
          "verbose",
        ],
  },
});
