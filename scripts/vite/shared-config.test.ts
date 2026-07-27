import { describe, expect, it } from "vitest";
import { createBrowserLibraryConfig, createLandingConfig, createPackageModulesConfig } from "./shared-config";

const root = process.cwd();

describe("shared Vite build configuration", () => {
  it("uses Oxc instead of esbuild for minified browser bundles", () => {
    const config = createBrowserLibraryConfig({
      root,
      entry: `${root}/broto/browser-entry.ts`,
      outDir: `${root}/dist`,
      globalName: "Broto",
      fileName: "broto.iife.min.js",
      minify: true,
    });

    expect(config.build?.minify).toBe("oxc");
    expect(config.resolve?.tsconfigPaths).toBe(true);
    expect(config).not.toHaveProperty("esbuild");
    expect(config.build).not.toHaveProperty("rollupOptions");
    expect(config.build?.rolldownOptions).toEqual(expect.objectContaining({
      output: expect.objectContaining({ exports: "named" }),
    }));
  });

  it("supports a direct default export for browser globals", () => {
    const config = createBrowserLibraryConfig({
      root,
      entry: `${root}/devtools/browser-entry.ts`,
      outDir: `${root}/dist`,
      globalName: "DevTools",
      fileName: "devtools.iife.js",
      minify: false,
      exports: "default",
    });

    expect(config.build?.rolldownOptions).toEqual(expect.objectContaining({
      output: expect.objectContaining({ exports: "default" }),
    }));
  });

  it("keeps package JavaScript on the shared Rolldown preserve-modules path", () => {
    const config = createPackageModulesConfig({
      root: `${root}/broto`,
      outDir: `${root}/broto`,
      input: { index: `${root}/broto/index.ts` },
    });

    expect(config.build?.minify).toBe(false);
    expect(config.build?.rolldownOptions).toEqual(expect.objectContaining({
      output: expect.objectContaining({ preserveModules: true }),
    }));
    expect(config.build).not.toHaveProperty("rollupOptions");
  });

  it("applies the shared site plugin to landing builds", () => {
    const config = createLandingConfig({
      root: `${root}/broto`,
      outDir: `${root}/dist/broto`,
      projectId: "broto",
    });

    expect(config.build?.minify).toBe("oxc");
    expect(config.resolve?.tsconfigPaths).toBe(true);
    expect(config.build?.cssMinify).toBe("lightningcss");
    expect(config.plugins).toEqual(expect.arrayContaining([expect.objectContaining({ name: "rod-ecosystem-site" })]));
  });
});
