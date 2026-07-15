import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Use the base config because the root tsconfig excludes test directories.
  plugins: [tsconfigPaths({ root, projects: ["tsconfig.base.json"] })],
  test: {
    // DevTools integration tests intentionally mount every panel, inject the
    // complete Cipó stylesheet registry and, for bundle smoke coverage, invoke
    // a production Vite build. CI runners regularly need more than Vitest's
    // five-second unit-test default for those integration-heavy cases.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
