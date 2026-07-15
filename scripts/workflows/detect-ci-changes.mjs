import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { env, git, writeOutput } from "./utils.mjs";

const EMPTY_SHA = "0000000000000000000000000000000000000000";
const INTERESTING = /^(broto|cipo|devtools|fabrica|fabrica-elements|maquina|seiva-state|rod|scripts|packages|apps|tests|test|bench|benchmark|benchmarks)\/|(^|\/)(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig[^/]*\.json|vitest\.config\.(js|cjs|mjs|ts|cts|mts)|vitest\.workspace\.(js|cjs|mjs|ts|cts|mts)|vite\.config\.(js|cjs|mjs|ts|cts|mts))$|^\.github\/workflows\/.*\.ya?ml$/;
const GLOBAL = /(^|\/)(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig[^/]*\.json|vitest\.config\.(js|cjs|mjs|ts|cts|mts)|vitest\.workspace\.(js|cjs|mjs|ts|cts|mts)|vite\.config\.(js|cjs|mjs|ts|cts|mts))$|^\.github\/workflows\/.*\.ya?ml$/;
const BENCHMARK = /^src\/(fabrica|broto|cipo|fabrica-elements)\/|^packages\/(fabrica|broto|cipo|fabrica-elements)\//;

function emit(values) { for (const [key, value] of Object.entries(values)) writeOutput(key, value); }
const testMode = env("INPUT_TEST_MODE", "smart");
const shouldRunTests = env("INPUT_SHOULD_RUN_TESTS", "true") !== "false";
if (testMode === "none" || !shouldRunTests) {
  emit({ should_test: false, should_benchmark: false, test_scope: "none", reason: "tests_disabled_by_input", benchmark_reason: "tests_disabled_by_input", affected_dirs_json: "[]", affected_dirs_text: "" });
  process.exit(0);
}
if (env("EVENT_NAME") === "workflow_dispatch" || testMode === "all") {
  emit({ should_test: true, should_benchmark: true, test_scope: "all", reason: "manual_or_forced_all_tests", benchmark_reason: "manual_or_forced_all_tests", affected_dirs_json: "[]", affected_dirs_text: "all" });
  process.exit(0);
}
let base = "";
if (env("EVENT_NAME") === "pull_request" && env("PR_BASE_SHA")) base = env("PR_BASE_SHA");
else if (env("BEFORE_SHA") && env("BEFORE_SHA") !== EMPTY_SHA) {
  try { git(["cat-file", "-e", `${env("BEFORE_SHA")}^{commit}`]); base = env("BEFORE_SHA"); } catch {}
}
const args = base
  ? ["diff", "--name-only", "--diff-filter=AMR", base, env("HEAD_SHA")]
  : ["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", "--diff-filter=AMR", env("HEAD_SHA")];
const changed = git(args).split("\n").filter(Boolean).sort();
mkdirSync("artifacts/changes", { recursive: true });
writeFileSync("artifacts/changes/changed-files.txt", `${[...new Set(changed)].join("\n")}\n`);
const interesting = changed.filter((file) => INTERESTING.test(file));
const globalFiles = interesting.filter((file) => GLOBAL.test(file));
const benchmarkFiles = interesting.filter((file) => BENCHMARK.test(file));
if (interesting.length === 0) {
  emit({ should_test: false, should_benchmark: false, test_scope: "none", reason: "no_test_relevant_files_changed", benchmark_reason: "no_benchmark_relevant_files_changed", affected_dirs_json: "[]", affected_dirs_text: "" });
  process.exit(0);
}
let testScope = "all";
let reason = "global_test_relevant_files_changed";
let affectedDirs = [];
if (globalFiles.length === 0) {
  const dirs = new Set();
  for (const file of interesting) {
    const parts = file.split("/");
    if (["broto", "cipo", "devtools", "fabrica", "fabrica-elements", "maquina", "seiva-state", "rod"].includes(parts[0])) dirs.add(parts[0]);
    else if (["packages", "apps"].includes(parts[0]) && parts.length >= 3) dirs.add(`${parts[0]}/${parts[1]}`);
    else if (parts[0] === "scripts") dirs.add("scripts");
    else dirs.add(dirname(file));
  }
  affectedDirs = [...dirs].sort();
  writeFileSync("artifacts/changes/affected-dirs.txt", `${affectedDirs.join("\n")}\n`);
  testScope = "affected";
  reason = "affected_test_folders_detected";
}
emit({
  should_test: true,
  should_benchmark: benchmarkFiles.length > 0,
  test_scope: testScope,
  reason,
  benchmark_reason: benchmarkFiles.length > 0 ? "benchmark_relevant_packages_changed" : "no_fabrica_broto_cipo_or_fabrica_elements_changes",
  affected_dirs_json: JSON.stringify(affectedDirs),
  affected_dirs_text: affectedDirs.join(" "),
});
