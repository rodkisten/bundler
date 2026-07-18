import { defineConfig } from "vitest/config";
import VitestDebugReporter from "./scripts/vitest-debug-reporter";

const IS_GITHUB_ACTIONS = process.env.GITHUB_ACTIONS === "true";
const DEBUG_TESTS = process.env.DEBUG_TESTS === "true";

export default defineConfig({
  // Vitest uses Vite 8, so workspace aliases come directly from compilerOptions.paths.
  resolve: {
    tsconfigPaths: true,
  },

  test: {
    // DevTools integration tests intentionally mount every panel, inject the
    // complete Cipó stylesheet registry and, for bundle smoke coverage, invoke
    // a production Vite build. CI runners regularly need more than Vitest's
    // five-second unit-test default for those integration-heavy cases.
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
