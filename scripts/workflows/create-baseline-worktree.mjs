import { env, ensureEmptyDir, run, writeOutput } from "./utils.mjs";
const root = `${env("RUNNER_TEMP", ".tmp")}/rod-benchmark-baseline`;
ensureEmptyDir(root);
// git worktree requires the target not to exist.
import { rmSync } from "node:fs";
rmSync(root, { recursive: true, force: true });
run("git", ["worktree", "add", "--detach", root, env("BASE_SHA")]);
writeOutput("base_root", root);
