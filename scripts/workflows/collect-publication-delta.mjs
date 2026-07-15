import { existsSync } from "node:fs";
import { env, ensureEmptyDir, walkFiles, copyFilePreservingRoot, fileName, writeOutput, appendSummary } from "./utils.mjs";

const scope = env("BUILD_SCOPE", "all");
const channel = env("RELEASE_CHANNEL", "production");
const runnerTemp = env("RUNNER_TEMP", ".tmp");
const deltaDir = `${runnerTemp}/publication-delta`;
const roots = scope === "devtools"
  ? [env("DEVTOOLS_DIST_DIR", "src/devtools/dist")]
  : scope === "all"
    ? [env("FULL_DIST_DIR", "dist"), env("DEVTOOLS_DIST_DIR", "src/devtools/dist")]
    : [env("FULL_DIST_DIR", "dist")];

ensureEmptyDir(deltaDir);
const copied = [];
for (const root of roots.filter(existsSync)) {
  for (const source of walkFiles(root)) {
    const filename = fileName(source);
    const isCanary = filename.endsWith(".canary.iife.min.js");
    if (channel === "canary" && !isCanary) continue;
    if (channel === "production" && isCanary) continue;
    if (!["canary", "production", "both"].includes(channel)) throw new Error(`Unknown release channel: ${channel}`);
    copied.push(copyFilePreservingRoot(source, root, deltaDir));
  }
}
if (copied.length === 0) throw new Error("No files were selected for publication");
writeOutput("path", deltaDir);
const relativeFiles = walkFiles(deltaDir).map((file) => file.slice(deltaDir.length + 1));
appendSummary(`## 📦 Publication delta\n\n\`\`\`text\n${relativeFiles.join("\n")}\n\`\`\``);
