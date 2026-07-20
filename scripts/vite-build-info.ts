import { loadEnv, type Plugin } from "vite";

export interface BuildInfoViteOptions {
  readonly packageName: string;
  readonly envName?: string;
}

function normalizePackageName(packageName: string): string {
  return packageName
    .replace(/^@/, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function parseBuildInfo(value: string | undefined): unknown {
  if (value === undefined || value === "") {
    return {};
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Exposes build information from an environment variable on `window`.
 *
 * @example
 * ```ts
 * buildInfoVite({
 *   packageName: "devtools",
 * })
 * ```
 *
 * With:
 *
 * ```bash
 * BUILD_INFO='{"version":"1.0.0","commit":"abc123"}'
 * ```
 *
 * Produces:
 *
 * ```ts
 * window.__BUILD_INFO_DEVTOOLS__
 * ```
 */
export function buildInfoVite(
  options: BuildInfoViteOptions,
): Plugin {
  const envName = options.envName ?? "BUILD_INFO";
  const normalizedName = normalizePackageName(options.packageName);
  const globalName = `__BUILD_INFO_${normalizedName}__`;

  let serializedBuildInfo = "{}";

  return {
    name: `rodkisten-build-info:${normalizedName.toLowerCase()}`,
    apply: "build",
    enforce: "pre",

    configResolved(config) {
      const env = loadEnv(
        config.mode,
        config.envDir,
        "",
      );

      const rawBuildInfo =
        process.env[envName] ??
        env[envName];

      const buildInfo = parseBuildInfo(rawBuildInfo);

      serializedBuildInfo = JSON.stringify(
        buildInfo ?? {},
      );
    },

    renderChunk(code, chunk) {
      if (!chunk.isEntry) {
        return null;
      }

      const serializedGlobalName =
        JSON.stringify(globalName);

      const injection = [
        "",
        ";if (typeof window !== \"undefined\") {",
        `  window[${serializedGlobalName}] = ${serializedBuildInfo};`,
        `  console.log(`,
        `    "🐬 ${globalName}:",`,
        `    window[${serializedGlobalName}],`,
        `  );`,
        "}",
        "",
      ].join("\n");

      return {
        code: `${code}${injection}`,
        map: null,
      };
    },
  };
}
