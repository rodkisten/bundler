import { env, git, writeOutput, run } from "./utils.mjs";
run("git", ["config", "user.name", "github-actions[bot]"]);
run("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
run("git", ["add", "bench/cipo.json", "bench/fabrica.json", "bench/runner.json", "bench/README.md", "bench/COMPARISON.md"]);
try {
  run("git", ["diff", "--cached", "--quiet"]);
  writeOutput("changed", false);
} catch {
  run("git", ["commit", "-m", "chore(bench): refresh reliable baselines [skip benchmark]"]);
  run("git", ["push", "origin", `HEAD:${env("GITHUB_REF_NAME")}`]);
  writeOutput("changed", true);
}
