import { existsSync, readFileSync } from "node:fs";
import { env, output, run, summary } from "./lib.mjs";

const command = process.argv[2];

function resolveRevisions() {
  const headSha = run("git", ["rev-parse", "HEAD"], { capture: true });
  const headSubject = run("git", ["log", "-1", "--pretty=%s"], { capture: true });
  const headAuthor = run("git", ["log", "-1", "--pretty=%ae"], { capture: true });
  let rounds = Number.parseInt(env("INPUT_ROUNDS", "3"), 10);

  if (headSubject.startsWith("chore(bench): refresh reliable baselines") && headAuthor.includes("github-actions")) {
    output("should_run", "false");
    output("reason", "generated_benchmark_commit");
    return;
  }
  if (!Number.isInteger(rounds)) throw new Error(`Invalid rounds input: ${env("INPUT_ROUNDS")}`);

  let baseSha = "";
  const requested = env("INPUT_BASELINE_SHA");
  if (requested) {
    baseSha = run("git", ["rev-parse", `${requested}^{commit}`], { capture: true });
  } else {
    baseSha = run("git", ["log", "--first-parent", "-n", "1", "--format=%H", "HEAD^", "--", "src", "scripts", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig*.json", ".github/workflows/benchmark-regression.yml"], { capture: true, allowFailure: true, quiet: true });
  }
  if (!baseSha) baseSha = run("git", ["rev-parse", "HEAD^"], { capture: true, allowFailure: true, quiet: true });
  if (!baseSha) {
    output("should_run", "false");
    output("reason", "no_baseline_commit");
    return;
  }

  rounds = Math.max(1, Math.min(7, rounds));
  output("should_run", "true");
  output("reason", "benchmark_relevant_source_commit");
  output("head_sha", headSha);
  output("base_sha", baseSha);
  output("rounds", rounds);
}

function writeRevisionSummary() {
  summary(`## 🧭 Benchmark revisions

| Field | Value |
| --- | --- |
| Run | \`${env("SHOULD_RUN")}\` |
| Reason | \`${env("REASON")}\` |
| Baseline | \`${env("BASE_SHA")}\` |
| Current | \`${env("HEAD_SHA")}\` |
| Rounds | \`${env("ROUNDS")}\` |`);
}

function createWorktree() {
  const root = `${env("RUNNER_TEMP")}/rod-benchmark-baseline`;
  run("rm", ["-rf", root]);
  run("git", ["worktree", "add", "--detach", root, env("BASE_SHA")]);
  output("base_root", root);
}

function validateCurrent() {
  run("pnpm", ["typecheck"]);
  run("pnpm", ["test"]);
}

function runComparison() {
  run("pnpm", ["exec", "tsx", "scripts/benchmarks.ts", "--mode=compare", `--baseline-root=${env("BASE_ROOT")}`, `--current-root=${env("GITHUB_WORKSPACE")}`, `--baseline-commit=${env("BASE_SHA")}`, `--current-commit=${env("HEAD_SHA")}`, `--branch=${env("GITHUB_REF_NAME")}`, `--rounds=${env("ROUNDS")}`]);
}

function publishSummary() {
  if (existsSync("bench/COMPARISON.md")) summary(readFileSync("bench/COMPARISON.md", "utf8"));
  else summary("## ⚠️ Benchmark report was not generated");
}

function verifyFreshness() {
  const remote = run("git", ["ls-remote", "--exit-code", "origin", `refs/heads/${env("GITHUB_REF_NAME")}`], { capture: true }).split(/\s+/)[0] ?? "";
  if (remote !== env("HEAD_SHA")) {
    output("fresh", "false");
    console.log(`Branch advanced to ${remote}; refusing to commit stale benchmark data.`);
    return;
  }
  output("fresh", "true");
}

function commitResults() {
  run("git", ["config", "user.name", "github-actions[bot]"]);
  run("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
  run("git", ["add", "bench/cipo.json", "bench/fabrica.json", "bench/runner.json", "bench/README.md", "bench/COMPARISON.md"]);
  const changed = run("git", ["diff", "--cached", "--quiet"], { allowFailure: true });
  if (changed === 0) {
    output("changed", "false");
    return;
  }
  run("git", ["commit", "-m", "chore(bench): refresh reliable baselines [skip benchmark]"]);
  run("git", ["push", "origin", `HEAD:${env("GITHUB_REF_NAME")}`]);
  output("changed", "true");
}

async function updatePrComment() {
  const reportPath = env("REPORT_PATH", "bench/COMPARISON.md");
  if (!existsSync(reportPath)) {
    console.warn(`::warning::Missing ${reportPath}; PR comment skipped.`);
    return;
  }
  const [owner, repo] = env("GITHUB_REPOSITORY").split("/");
  const branch = env("GITHUB_REF").replace("refs/heads/", "");
  const token = env("GH_TOKEN") || env("GITHUB_TOKEN");
  if (!owner || !repo || !token) throw new Error("GitHub repository metadata or token is unavailable");
  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2022-11-28",
    "user-agent": "rodkisten-bundler-workflow",
  };
  const api = async (path, options = {}) => {
    const response = await fetch(`https://api.github.com${path}`, { ...options, headers: { ...headers, ...(options.headers ?? {}) } });
    if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
    return response.status === 204 ? null : response.json();
  };
  const pulls = await api(`/repos/${owner}/${repo}/pulls?head=${encodeURIComponent(`${owner}:${branch}`)}&state=open&per_page=10`);
  if (!pulls.length) {
    console.log(`No open pull request found for ${branch}.`);
    return;
  }
  const issueNumber = pulls[0].number;
  const marker = "<!-- rod-benchmark-report -->";
  const body = readFileSync(reportPath, "utf8");
  const comments = [];
  for (let page = 1; ; page += 1) {
    const batch = await api(`/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100&page=${page}`);
    comments.push(...batch);
    if (batch.length < 100) break;
  }
  const existing = comments.find((comment) => comment.user?.type === "Bot" && comment.body?.includes(marker));
  if (existing) {
    await api(`/repos/${owner}/${repo}/issues/comments/${existing.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) });
  } else {
    await api(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) });
  }
}

function removeWorktree() {
  run("git", ["worktree", "remove", "--force", env("BASE_ROOT")], { allowFailure: true });
  run("git", ["worktree", "prune"]);
}

const commands = {
  "resolve-revisions": resolveRevisions,
  "write-revision-summary": writeRevisionSummary,
  "create-worktree": createWorktree,
  "validate-current": validateCurrent,
  "run-comparison": runComparison,
  "publish-summary": publishSummary,
  "verify-freshness": verifyFreshness,
  "commit-results": commitResults,
  "update-pr-comment": updatePrComment,
  "remove-worktree": removeWorktree,
};

if (!commands[command]) throw new Error(`Unknown benchmark workflow command: ${command}`);
await commands[command]();
