import { defineConfig } from "vitest/config";

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

    // The debug reporter emits a START line before each test lifecycle begins
    // and a DONE line when it ends. The last unmatched START identifies a test
    // that timed out or stalled. hanging-process diagnoses open handles that keep
    // Vitest alive after the actual test run has already completed.
    reporters: IS_GITHUB_ACTIONS
      ? [
          "./scripts/vitest-debug-reporter.ts",
          "verbose",
          "github-actions",
          "hanging-process",
        ]
      : [
          "./scripts/vitest-debug-reporter.ts",
          "verbose",
        ],
  },
});
