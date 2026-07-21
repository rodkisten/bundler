import path from "node:path";
import { build, type InlineConfig } from "vite";
import config from "../devtools/vite.config";

const root = process.cwd();
const resolved = config as InlineConfig;

await build({
  ...resolved,
  configFile: false,
  resolve: {
    ...resolved.resolve,
    alias: [
      {
        find: /^@rodkisten\/broto$/,
        replacement: path.resolve(root, "broto/index.ts"),
      },
      {
        find: /^@rodkisten\/broto\//,
        replacement: `${path.resolve(root, "broto")}/`,
      },
      {
        find: /^@rodkisten\/cipo$/,
        replacement: path.resolve(root, "cipo/index.ts"),
      },
      {
        find: /^@rodkisten\/cipo\//,
        replacement: `${path.resolve(root, "cipo")}/`,
      },
      {
        find: /^@rodkisten\/fabrica$/,
        replacement: path.resolve(root, "fabrica/index.ts"),
      },
      {
        find: /^@rodkisten\/fabrica\//,
        replacement: `${path.resolve(root, "fabrica")}/`,
      },
      {
        find: /^@rodkisten\/fabrica-elements$/,
        replacement: path.resolve(root, "fabrica-elements/index.ts"),
      },
      {
        find: /^@rodkisten\/fabrica-elements\//,
        replacement: `${path.resolve(root, "fabrica-elements")}/`,
      },
    ],
  },
  build: {
    ...resolved.build,
    emptyOutDir: false,
    outDir: path.resolve(root, "dist"),
    minify: false,
    lib: {
      ...resolved.build?.lib,
      formats: ["iife"],
      fileName: () => "devtools.iife.js",
    },
  },
});
