import { env, git, writeOutput } from "./utils.mjs";
const headSha = git(["rev-parse", "HEAD"]);
const subject = git(["log", "-1", "--pretty=%s"]);
const author = git(["log", "-1", "--pretty=%ae"]);
let rounds = Number(env("INPUT_ROUNDS", "3"));
if (subject.startsWith("chore(bench): refresh reliable baselines") && author.includes("github-actions")) {
  writeOutput("should_run", false); writeOutput("reason", "generated_benchmark_commit"); process.exit(0);
}
if (!Number.isInteger(rounds)) throw new Error(`Invalid rounds input: ${env("INPUT_ROUNDS")}`);
let baseSha = "";
if (env("INPUT_BASELINE_SHA")) baseSha = git(["rev-parse", `${env("INPUT_BASELINE_SHA")}^{commit}`]);
else {
  baseSha = git(["log", "--first-parent", "-n", "1", "--format=%H", "HEAD^", "--", "src", "scripts", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig*.json", ".github/workflows/benchmark-regression.yml"], { allowFailure: true });
}
if (!baseSha) baseSha = git(["rev-parse", "HEAD^"], { allowFailure: true });
if (!baseSha) { writeOutput("should_run", false); writeOutput("reason", "no_baseline_commit"); process.exit(0); }
rounds = Math.max(1, Math.min(7, rounds));
writeOutput("should_run", true);
writeOutput("reason", "benchmark_relevant_source_commit");
writeOutput("head_sha", headSha);
writeOutput("base_sha", baseSha);
writeOutput("rounds", rounds);
