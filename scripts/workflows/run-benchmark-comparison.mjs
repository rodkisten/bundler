import { env, run } from "./utils.mjs";
run("pnpm", ["exec", "tsx", "scripts/benchmarks.ts", "--mode=compare", `--baseline-root=${env("BASELINE_ROOT")}`, `--current-root=${env("GITHUB_WORKSPACE")}`, `--baseline-commit=${env("BASELINE_SHA")}`, `--current-commit=${env("CURRENT_SHA")}`, `--branch=${env("GITHUB_REF_NAME")}`, `--rounds=${env("ROUNDS", "3")}`]);
