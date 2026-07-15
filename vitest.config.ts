import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // DevTools integration tests intentionally mount every panel, inject the
    // complete Cipó stylesheet registry and, for bundle smoke coverage, invoke
    // a production Vite build. CI runners regularly need more than Vitest's
    // five-second unit-test default for those integration-heavy cases.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
