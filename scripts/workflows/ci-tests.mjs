import { dirname } from "node:path";
import { ensureDir, env, json, output, readText, run, runLogged, summary, tail } from "./lib.mjs";
import { writeFileSync } from "node:fs";

const command = process.argv[2];
const EMPTY_SHA = "0000000000000000000000000000000000000000";
const interestingPattern = /^(src|scripts|packages|apps|tests|test|bench|benchmark|benchmarks)\/|(^|\/)(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig[^/]*\.json|vitest\.config\.(js|cjs|mjs|ts|cts|mts)|vitest\.workspace\.(js|cjs|mjs|ts|cts|mts)|vite\.config\.(js|cjs|mjs|ts|cts|mts))$|^\.github\/workflows\/.*\.ya?ml$/;
const globalPattern = /(^|\/)(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig[^/]*\.json|vitest\.config\.(js|cjs|mjs|ts|cts|mts)|vitest\.workspace\.(js|cjs|mjs|ts|cts|mts)|vite\.config\.(js|cjs|mjs|ts|cts|mts))$|^\.github\/workflows\/.*\.ya?ml$/;
const benchmarkPattern = /^(src|packages)\/(fabrica|broto|cipo|fabrica-elements)\//;

function changedFiles() {
  const eventName = env("EVENT_NAME");
  const headSha = env("HEAD_SHA");
  let baseSha = "";
  if (eventName === "pull_request" && env("PR_BASE_SHA")) baseSha = env("PR_BASE_SHA");
  else if (env("BEFORE_SHA") && env("BEFORE_SHA") !== EMPTY_SHA) {
    const valid = run("git", ["cat-file", "-e", `${env("BEFORE_SHA")}^{commit}`], { allowFailure: true });
    if (valid === 0) baseSha = env("BEFORE_SHA");
  }
  const text = baseSha
    ? run("git", ["diff", "--name-only", "--diff-filter=AMR", baseSha, headSha], { capture: true })
    : run("git", ["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", "--diff-filter=AMR", headSha], { capture: true });
  return [...new Set(text.split(/\r?\n/).filter(Boolean))].sort();
}

function detectChanges() {
  const testMode = env("INPUT_TEST_MODE", "smart");
  const shouldRunTests = env("INPUT_SHOULD_RUN_TESTS", "true");
  if (testMode === "none" || shouldRunTests === "false") {
    for (const [key, value] of Object.entries({ should_test: "false", should_benchmark: "false", test_scope: "none", reason: "tests_disabled_by_input", benchmark_reason: "tests_disabled_by_input", affected_dirs_json: "[]", affected_dirs_text: "" })) output(key, value);
    return;
  }
  if (env("EVENT_NAME") === "workflow_dispatch" || testMode === "all") {
    for (const [key, value] of Object.entries({ should_test: "true", should_benchmark: "true", test_scope: "all", reason: "manual_or_forced_all_tests", benchmark_reason: "manual_or_forced_all_tests", affected_dirs_json: "[]", affected_dirs_text: "all" })) output(key, value);
    return;
  }

  const files = changedFiles();
  ensureDir("artifacts/changes");
  writeFileSync("artifacts/changes/changed-files.txt", `${files.join("\n")}${files.length ? "\n" : ""}`);
  const interesting = files.filter((file) => interestingPattern.test(file));
  const globals = interesting.filter((file) => globalPattern.test(file));
  const benchmark = interesting.filter((file) => benchmarkPattern.test(file));

  if (!interesting.length) {
    for (const [key, value] of Object.entries({ should_test: "false", should_benchmark: "false", test_scope: "none", reason: "no_test_relevant_files_changed", benchmark_reason: "no_benchmark_relevant_files_changed", affected_dirs_json: "[]", affected_dirs_text: "" })) output(key, value);
    return;
  }

  if (globals.length) {
    output("should_test", "true");
    output("test_scope", "all");
    output("reason", "global_test_relevant_files_changed");
    output("affected_dirs_json", "[]");
    output("affected_dirs_text", "all");
  } else {
    const dirs = [...new Set(interesting.map((file) => {
      const parts = file.split("/");
      if (["src", "packages", "apps"].includes(parts[0]) && parts.length >= 3) return `${parts[0]}/${parts[1]}`;
      if (parts[0] === "scripts") return "scripts";
      return dirname(file);
    }))].sort();
    writeFileSync("artifacts/changes/affected-dirs.txt", `${dirs.join("\n")}\n`);
    output("should_test", "true");
    output("test_scope", "affected");
    output("reason", "affected_test_folders_detected");
    output("affected_dirs_json", json(dirs));
    output("affected_dirs_text", dirs.join(" "));
  }
  output("should_benchmark", benchmark.length ? "true" : "false");
  output("benchmark_reason", benchmark.length ? "benchmark_relevant_packages_changed" : "no_fabrica_broto_cipo_or_fabrica_elements_changes");
}

function writeChangesSummary() {
  summary(`## 🧭 Change Detector

| Field | Value |
| --- | --- |
| Should test | \`${env("SHOULD_TEST")}\` |
| Test scope | \`${env("TEST_SCOPE")}\` |
| Reason | \`${env("REASON")}\` |
| Should benchmark | \`${env("SHOULD_BENCHMARK")}\` |
| Benchmark reason | \`${env("BENCHMARK_REASON")}\` |

### Changed files

\`\`\`txt
${readText("artifacts/changes/changed-files.txt") || "(none)"}\`\`\`

### Affected folders

\`\`\`txt
${env("AFFECTED_DIRS_TEXT") || "(none)"}
\`\`\``);
}

function runTests() {
  const dirs = JSON.parse(env("AFFECTED_DIRS_JSON", "[]"));
  const args = env("TEST_SCOPE") === "all" || !dirs.length
    ? ["test"]
    : ["exec", "vitest", "run", ...dirs, "--passWithNoTests"];
  runLogged("pnpm", args, "artifacts/test/test-output.log");
}

function writeTestSummary() {
  summary(`## 🧪 Test Report

| Field | Value |
| --- | --- |
| Status | \`${env("TEST_OUTCOME")}\` |
| Scope | \`${env("TEST_SCOPE")}\` |
| Affected folders | \`${env("AFFECTED_DIRS_TEXT")}\` |
| Blocking build | \`false\` |

### Last test output lines

\`\`\`markdown
${tail("artifacts/test/test-output.log", 200)}
\`\`\``);
}

function runBenchmarks() {
  runLogged("pnpm", ["bench:all"], "artifacts/test/benchmarks-output.log", { allowFailure: true });
}

function runCipoBenchmarks() {
  // Keep the output deterministic without shell pipelines: Vitest output is captured, ANSI is stripped, then persisted.
  const result = run("pnpm", ["exec", "vitest", "bench", "cipo/test/cipo.bench.ts", "--run"], { capture: true, allowFailure: true });
  const stripped = result.replace(/\u001b\[[0-9;]*m/g, "");
  ensureDir("artifacts/test");
  writeFileSync("artifacts/test/cipo-benchmark.log", stripped);
  process.stdout.write(stripped);
}

function writeBenchmarkSummary() {
  summary(`## ⏱️ Benchmark Report

| Field | Value |
| --- | --- |
| Should benchmark | \`${env("SHOULD_BENCHMARK")}\` |
| Reason | \`${env("BENCHMARK_REASON")}\` |
| Status | \`${env("BENCHMARK_OUTCOME", "skipped")}\` |`);
}

const commands = {
  "detect-changes": detectChanges,
  "write-changes-summary": writeChangesSummary,
  "run-tests": runTests,
  "write-test-summary": writeTestSummary,
  "run-benchmarks": runBenchmarks,
  "run-cipo-benchmarks": runCipoBenchmarks,
  "write-benchmark-summary": writeBenchmarkSummary,
};
if (!commands[command]) throw new Error(`Unknown CI workflow command: ${command}`);
await commands[command]();
