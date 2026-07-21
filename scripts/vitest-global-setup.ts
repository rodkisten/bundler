import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Builds the production DevTools IIFE before workers start.
 *
 * Keeping Vite outside the Vitest worker pool prevents the integration bundle
 * build from competing with compiler-heavy test modules for the same runtime
 * state and memory budget. The bundle-mount test consumes this exact output.
 */
export default function setup(): void {
  const root = process.cwd();
  const bundlePath = resolve(root, "dist/devtools.iife.js");
  const manifestPath = resolve(
    root,
    "dist/devtools.cipo.compiled.manifest.json",
  );

  rmSync(bundlePath, { force: true });
  rmSync(manifestPath, { force: true });

  execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      resolve(root, "scripts/build-devtools-test-bundle.ts"),
    ],
    {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    },
  );
}
