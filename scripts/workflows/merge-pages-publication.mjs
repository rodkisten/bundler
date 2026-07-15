import { existsSync } from "node:fs";
import { env, envBoolean, ensureEmptyDir, copyTree, walkFiles, writeOutput, appendSummary } from "./utils.mjs";

const runnerTemp = env("RUNNER_TEMP", ".tmp");
const publicationDir = `${runnerTemp}/pages-publication`;
const stateDir = `${runnerTemp}/pages-state`;
const deltaDir = env("DELTA_PATH");
const forceClean = envBoolean("FORCE_CLEAN_DEPLOY", false);
if (!deltaDir || !existsSync(deltaDir)) throw new Error(`Publication delta does not exist: ${deltaDir}`);

ensureEmptyDir(publicationDir);
if (!forceClean && existsSync(stateDir)) copyTree(stateDir, publicationDir);
copyTree(deltaDir, publicationDir);
writeOutput("path", publicationDir);
const files = walkFiles(publicationDir).map((file) => file.slice(publicationDir.length + 1));
appendSummary(`## 🌐 Complete Pages state\n\n| Clean deploy | \`${forceClean}\` |\n\n\`\`\`text\n${files.join("\n")}\n\`\`\``);
