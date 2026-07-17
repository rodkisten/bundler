import { defineConfig } from "vitest/config";
import VitestDebugReporter from "./scripts/vitest-debug-reporter";

const IS_GITHUB_ACTIONS = process.env.GITHUB_ACTIONS === "true";

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

    // Register the custom reporter once as an instance. Its output is regular
    // stdout, so the last START/heartbeat line remains visible even when GitHub
    // kills a genuinely hung Vitest process. hanging-process remains CI-only
    // because it is comparatively expensive and diagnoses open handles rather
    // than identifying the currently executing test.
    reporters: IS_GITHUB_ACTIONS
      ? [
          new VitestDebugReporter(),
          "verbose",
          "github-actions",
          "hanging-process",
        ]
      : [
          new VitestDebugReporter(),
          "verbose",
        ],
  },
});
