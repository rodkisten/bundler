import path from "node:path";
import { build } from "vite";
import config from "../devtools/vite.config";

const root = process.cwd();
const library = config.build?.lib;

if (!library) {
  throw new Error("DevTools Vite config must define a library build.");
}

await build({
  ...config,
  configFile: false,
  plugins: (config.plugins ?? []).filter((plugin) => {
    return (
      plugin !== null
      && plugin !== false
      && typeof plugin === "object"
      && !Array.isArray(plugin)
      && "name" in plugin
      && plugin.name !== "roderuda-devtools-landing"
    );
  }),
  build: {
    ...config.build,
    emptyOutDir: false,
    outDir: path.resolve(root, "dist"),
    minify: false,
    lib: {
      ...library,
      formats: ["iife"],
      fileName: () => "devtools.iife.js",
    },
  },
});

// This helper is a dedicated build subprocess. Vite/esbuild may retain service
// handles, so terminate explicitly after all output files have been flushed.
process.exit(0);
