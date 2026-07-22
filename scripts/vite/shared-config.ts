import path from "node:path";
import type { InlineConfig, Plugin, UserConfig } from "vite";
import { ecosystemSitePlugin } from "./site-plugin";
import type { EcosystemProjectId } from "../site/ecosystem";
import { workspaceAliasPlugin } from "./workspace-alias";

export type SharedLibraryBuildOptions = {
  readonly root: string;
  readonly entry: string;
  readonly outDir: string;
  readonly globalName: string;
  readonly fileName: string;
  readonly minify: boolean;
  readonly banner?: string;
  readonly plugins?: readonly Plugin[];
  readonly define?: Record<string, string>;
};

export type SharedLandingBuildOptions = {
  readonly root: string;
  readonly outDir: string;
  readonly projectId: EcosystemProjectId;
  readonly title?: string;
  readonly description?: string;
  readonly plugins?: readonly Plugin[];
  readonly emptyOutDir?: boolean;
};

/** Shared Vite 8 browser-library contract. Rolldown bundles and Oxc minifies every published IIFE. */
export function createBrowserLibraryConfig(options: SharedLibraryBuildOptions): InlineConfig {
  return {
    configFile: false,
    root: options.root,
    base: "./",
    publicDir: false,
    resolve: { tsconfigPaths: true },
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
      ...options.define,
    },
    plugins: [workspaceAliasPlugin(), ...(options.plugins ?? [])],
    build: {
      outDir: options.outDir,
      emptyOutDir: false,
      target: ["es2022", "safari16.4"],
      sourcemap: true,
      minify: options.minify ? "oxc" : false,
      copyPublicDir: false,
      lib: {
        entry: options.entry,
        name: options.globalName,
        formats: ["iife"],
        fileName: () => options.fileName,
      },
      rolldownOptions: {
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
        },
        output: options.banner ? { banner: options.banner } : undefined,
      },
    },
  };
}

/** Shared static-site contract used by every ecosystem landing page. */
export function createLandingConfig(options: SharedLandingBuildOptions): InlineConfig {
  return {
    configFile: false,
    root: options.root,
    base: "./",
    publicDir: false,
    resolve: { tsconfigPaths: true },
    plugins: [
      workspaceAliasPlugin(),
      ...(options.plugins ?? []),
      ecosystemSitePlugin({
        projectId: options.projectId,
        title: options.title,
        description: options.description,
      }),
    ],
    build: {
      outDir: path.resolve(options.outDir),
      emptyOutDir: options.emptyOutDir ?? true,
      target: ["es2022", "safari16.4"],
      sourcemap: true,
      minify: "oxc",
      cssMinify: "lightningcss",
      copyPublicDir: false,
      rolldownOptions: {
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
        },
      },
    },
  };
}

export type MultiFormatLibraryBuildOptions = {
  readonly root: string;
  readonly entry: string;
  readonly outDir: string;
  readonly globalName: string;
  readonly baseFileName: string;
  readonly formats: readonly ("es" | "cjs" | "umd" | "iife")[];
  readonly banner?: string;
  readonly plugins?: readonly Plugin[];
  readonly define?: Record<string, string>;
  readonly emptyOutDir?: boolean;
};

/** Shared multi-format library config for local tool builds such as DevTools and Máquina. */
export function createMultiFormatLibraryConfig(options: MultiFormatLibraryBuildOptions): UserConfig {
  return {
    root: options.root,
    publicDir: false,
    resolve: { tsconfigPaths: true },
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
      ...options.define,
    },
    plugins: [workspaceAliasPlugin(), ...(options.plugins ?? [])],
    build: {
      outDir: options.outDir,
      emptyOutDir: options.emptyOutDir ?? false,
      target: ["es2022", "safari16.4"],
      sourcemap: true,
      minify: "oxc",
      copyPublicDir: false,
      lib: {
        entry: options.entry,
        name: options.globalName,
        formats: [...options.formats],
        fileName: (format) => `${options.baseFileName}.${format}.js`,
      },
      rolldownOptions: {
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
        },
        output: options.banner ? { banner: options.banner } : undefined,
      },
    },
  };
}


export type PackageModulesBuildOptions = {
  readonly root: string;
  readonly outDir: string;
  readonly input: Record<string, string>;
};

/** Shared preserve-modules contract for publishable workspace packages. */
export function createPackageModulesConfig(options: PackageModulesBuildOptions): InlineConfig {
  return {
    configFile: false,
    root: options.root,
    publicDir: false,
    resolve: { tsconfigPaths: true },
    build: {
      outDir: options.outDir,
      emptyOutDir: false,
      target: ["es2022", "safari16.4"],
      sourcemap: true,
      minify: false,
      copyPublicDir: false,
      rolldownOptions: {
        input: options.input,
        external: (id) => !id.startsWith(".") && !id.startsWith("/") && !id.startsWith("\0"),
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
        },
        output: {
          format: "es",
          preserveModules: true,
          preserveModulesRoot: options.root,
          entryFileNames: "[name].js",
          chunkFileNames: "[name].js",
        },
      },
    },
  };
}

export type DocumentationSiteBuildOptions = {
  readonly root: string;
  readonly outDir: string;
  readonly input: Record<string, string>;
};

/** Shared Vite config for the generated multi-page documentation portal. */
export function createDocumentationSiteConfig(options: DocumentationSiteBuildOptions): InlineConfig {
  return {
    configFile: false,
    root: options.root,
    base: "./",
    publicDir: false,
    build: {
      outDir: options.outDir,
      emptyOutDir: false,
      target: ["es2022", "safari16.4"],
      sourcemap: true,
      minify: "oxc",
      cssMinify: "lightningcss",
      copyPublicDir: false,
      rolldownOptions: {
        input: options.input,
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
        },
      },
    },
  };
}
