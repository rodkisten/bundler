import { defineConfig } from "vitest/config";

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
  },
});
