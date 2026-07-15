import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { env, fileName, walkFiles } from "./utils.mjs";

const scope = env("BUILD_SCOPE", "all");
const roots = scope === "devtools"
  ? [env("DEVTOOLS_DIST_DIR", "src/devtools/dist")]
  : scope === "all"
    ? [env("FULL_DIST_DIR", "dist"), env("DEVTOOLS_DIST_DIR", "src/devtools/dist")]
    : [env("FULL_DIST_DIR", "dist")];
let created = 0;
for (const root of roots.filter(existsSync)) {
  for (const source of walkFiles(root)) {
    const filename = fileName(source);
    if (!filename.endsWith(".iife.min.js") || filename.endsWith(".canary.iife.min.js")) continue;
    const canary = join(dirname(source), filename.replace(/\.iife\.min\.js$/, ".canary.iife.min.js"));
    copyFileSync(source, canary);
    created += 1;
    console.log(`${source} -> ${canary}`);
  }
}
if (created === 0) console.warn(`No minified IIFE bundle was available for canary aliases in: ${roots.join(", ")}`);
