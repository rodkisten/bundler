import fs from "node:fs/promises";
import path from "node:path";
import { build as buildWithEsbuild, type Plugin } from "esbuild";
import { DIST_DIR, ROOT_DIR, WORKSPACE_PACKAGES, workspaceSourceCandidates } from "./config";

export const DEVTOOLS_LANDING_DIR = path.join(DIST_DIR, "devtools");

export type BuildDevtoolsLandingOptions = {
  readonly outputDirectory?: string;
  readonly minify?: boolean;
  readonly sourcemap?: boolean;
};

/**
 * Converts the development HTML entry into a static, relocatable Pages entry.
 * Keeping this transform shared prevents the root builder and Vite builder from
 * producing subtly different landing pages.
 */
export function createBuiltDevtoolsLandingHtml(source: string): string {
  return source
    .replace(/\s*<base\s+href=["'][^"']*["']\s*\/?>(?:\s*)/i, "\n")
    .replace(/href=["']\/landing\.css["']/i, 'href="./landing.css"')
    .replace(
      /<script\s+type=["']module["']\s+src=["']\/landing\.ts["']\s*><\/script>/i,
      '<script defer src="./devtools.landing.js"></script>',
    );
}

function workspaceAliasPlugin(): Plugin {
  return {
    name: "workspace-alias",
    setup(buildApi) {
      buildApi.onResolve({ filter: /^@rodkisten\// }, async (args) => {
        const rest = args.path.slice("@rodkisten/".length);
        const slash = rest.indexOf("/");
        const pkg = slash === -1 ? rest : rest.slice(0, slash);
        const subpath = slash === -1 ? "index" : rest.slice(slash + 1);
        if (!(WORKSPACE_PACKAGES as readonly string[]).includes(pkg)) return undefined;

        const candidates = workspaceSourceCandidates(
          pkg as (typeof WORKSPACE_PACKAGES)[number],
          subpath,
        );
        for (const candidate of candidates) {
          try {
            await fs.access(candidate);
            return { path: candidate };
          } catch {
            // try next
          }
        }
        return { path: candidates[0]! };
      });
    },
  };
}

export async function buildDevtoolsLanding(
  options: BuildDevtoolsLandingOptions = {},
): Promise<string[]> {
  const sourceDirectory = path.join(ROOT_DIR, "devtools");
  const outputDirectory = options.outputDirectory ?? DEVTOOLS_LANDING_DIR;
  const htmlSource = path.join(sourceDirectory, "index.html");
  const cssSource = path.join(sourceDirectory, "landing.css");
  const scriptSource = path.join(sourceDirectory, "landing.ts");

  await fs.mkdir(outputDirectory, { recursive: true });

  await buildWithEsbuild({
    entryPoints: [scriptSource],
    outfile: path.join(outputDirectory, "devtools.landing.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2022", "safari16.4"],
    minify: options.minify ?? true,
    sourcemap: options.sourcemap ?? true,
    legalComments: "none",
    plugins: [workspaceAliasPlugin()],
  });

  const html = createBuiltDevtoolsLandingHtml(await fs.readFile(htmlSource, "utf8"));
  await Promise.all([
    fs.copyFile(cssSource, path.join(outputDirectory, "landing.css")),
    fs.writeFile(path.join(outputDirectory, "index.html"), html, "utf8"),
  ]);

  const emitted = [
    path.join(outputDirectory, "index.html"),
    path.join(outputDirectory, "landing.css"),
    path.join(outputDirectory, "devtools.landing.js"),
    path.join(outputDirectory, "devtools.landing.js.map"),
  ];

  const existing = await Promise.all(
    emitted.map(async (file) => {
      try {
        await fs.access(file);
        return path.relative(DIST_DIR, file);
      } catch {
        return null;
      }
    }),
  );

  return existing.filter((file): file is string => file !== null);
}
