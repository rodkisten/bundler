import { env, run } from "./utils.mjs";
const root = env("BASE_ROOT");
if (root) run("git", ["worktree", "remove", "--force", root], { allowFailure: true });
run("git", ["worktree", "prune"], { allowFailure: true });
