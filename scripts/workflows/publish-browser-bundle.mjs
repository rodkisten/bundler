import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { env, output, relativeFiles, resetDir, run, summary, walkFiles } from "./lib.mjs";

const command = process.argv[2];
const ALL_PROJECTS = ["broto", "cipo", "fabrica", "fabrica-elements", "seiva-state", "bundle", "devtools", "maquina"];
const EMPTY_SHA = "0000000000000000000000000000000000000000";

function getChangedFiles() {
  const event = env("EVENT_NAME");
  if (event === "pull_request") return run("git", ["diff", "--name-only", env("PR_BASE_SHA"), env("PR_HEAD_SHA")], { capture: true }).split(/\r?\n/).filter(Boolean);
  if (event === "push") {
    const before = env("BEFORE_SHA");
    const valid = before && before !== EMPTY_SHA && run("git", ["cat-file", "-e", `${before}^{commit}`], { allowFailure: true }) === 0;
    const args = valid ? ["diff", "--name-only", before, env("HEAD_SHA")] : ["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", env("HEAD_SHA")];
    return run("git", args, { capture: true }).split(/\r?\n/).filter(Boolean);
  }
  return [`manual:${env("REQUESTED_PROJECT", "auto")}`];
}

function affectedProjects(files) {
  const affected = new Set();
  let shared = false;
  for (const file of files) {
    if (!file || file.startsWith("manual:")) continue;
    if (/^src\/devtools\/|^src\/devtools\.ts$/.test(file)) affected.add("devtools");
    else if (/^src\/fabrica\/|^src\/fabrica\.ts$/.test(file)) affected.add("fabrica");
    else if (/^src\/cipo\/|^src\/cipo\.ts$/.test(file)) affected.add("cipo");
    else if (/^src\/broto\/|^src\/broto\.ts$/.test(file)) affected.add("broto");
    else if (/^src\/fabrica-elements\/|^src\/fabrica-elements\.ts$/.test(file)) affected.add("fabrica-elements");
    else if (/^src\/seiva-state\/|^src\/seiva-state\.ts$/.test(file)) affected.add("seiva-state");
    else if (/^src\/maquina\/|^src\/maquina\.ts$/.test(file)) affected.add("maquina");
    else if (/^src\/(bundle|index)\.ts$/.test(file)) affected.add("bundle");
    else if (/^(package\.json|pnpm-lock\.yaml|package-lock\.json|tsconfig.*\.json|vite\.config\.|scripts\/|\.github\/workflows\/)/.test(file)) shared = true;
  }
  if (shared) ALL_PROJECTS.forEach((project) => affected.add(project));
  return affected;
}

function previousRunAge() {
  if (env("EVENT_NAME") !== "push") return 0;
  const endpoint = `/repos/${env("GITHUB_REPOSITORY")}/actions/workflows/${env("WORKFLOW_FILE")}/runs?branch=${env("DEFAULT_BRANCH", "main")}&event=push&per_page=20`;
  const raw = run("gh", ["api", "-H", "Accept: application/vnd.github+json", endpoint], { capture: true, allowFailure: true, quiet: true });
  if (!raw) return 999999;
  try {
    const current = Number(env("CURRENT_RUN_ID"));
    const runs = JSON.parse(raw).workflow_runs.filter((item) => item.id !== current).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    if (!runs[0]) return 999999;
    return Math.max(0, Math.floor((Date.now() - Date.parse(runs[0].created_at)) / 1000));
  } catch {
    return 999999;
  }
}

function resolveScope() {
  const files = getChangedFiles();
  const requestedProject = env("REQUESTED_PROJECT", "auto");
  const affected = affectedProjects(files);
  const testsChanged = files.some((file) => /(^|\/)(tests?|__tests__)\/|\.(test|spec)\.[cm]?[jt]sx?$|^vitest\.config\.|^scripts\/.*benchmark/.test(file));
  const age = previousRunAge();
  const interval = Number(env("MAIN_FULL_INTERVAL_SECONDS", "300"));
  let buildScope = "none";
  let projects = [...affected].sort();
  let reason = "";

  if (requestedProject !== "auto") {
    if (requestedProject === "all") { buildScope = "all"; projects = [...ALL_PROJECTS]; reason = "manual all"; }
    else { buildScope = requestedProject; projects = [requestedProject]; }
  } else if (env("EVENT_NAME") === "push" && (files.length > 1 || age >= interval)) {
    buildScope = "all"; projects = [...ALL_PROJECTS];
    reason = files.length > 1 ? "main push changed more than one file" : "main push is at least five minutes after the previous run";
  } else if (env("EVENT_NAME") === "pull_request" && affected.size > 1) {
    buildScope = "all"; projects = [...ALL_PROJECTS]; reason = "pull request affects more than one project";
  } else if (affected.size === 1) buildScope = projects[0];
  else if (affected.size > 1) { buildScope = "all"; projects = [...ALL_PROJECTS]; reason = "more than one project affected"; }

  const release = env("EVENT_NAME") === "pull_request" ? "canary" : env("EVENT_NAME") === "push" ? "production" : env("REQUESTED_CHANNEL", "canary");
  const mode = env("TEST_MODE", "auto");
  const shouldTest = mode === "always" ? true : mode === "never" ? false : buildScope === "all" || testsChanged || affected.size > 1;
  if (!['auto','always','never'].includes(mode)) throw new Error(`Unknown test mode: ${mode}`);
  const shouldDeploy = env("EVENT_NAME") !== "pull_request" && env("REQUESTED_DEPLOY") === "true" && buildScope !== "none";

  const values = {
    build_scope: buildScope,
    affected_projects: projects.join(","),
    affected_count: projects.length,
    changed_file_count: files.length,
    tests_changed: testsChanged,
    should_test: shouldTest,
    release_channel: release,
    should_deploy: shouldDeploy,
    full_reason: reason,
    seconds_since_previous_run: age,
    changed_files: files.join("\n"),
  };
  for (const [key, value] of Object.entries(values)) output(key, value);
}

function writeScopeSummary() {
  summary(`## 🧭 Build policy

| Field | Value |
| --- | --- |
| Scope | \`${env("BUILD_SCOPE")}\` |
| Affected projects | \`${env("AFFECTED_PROJECTS")}\` |
| Affected count | \`${env("AFFECTED_COUNT")}\` |
| Changed files | \`${env("CHANGED_FILE_COUNT")}\` |
| Tests changed | \`${env("TESTS_CHANGED")}\` |
| Run tests | \`${env("SHOULD_TEST")}\` |
| Release channel | \`${env("RELEASE_CHANNEL")}\` |
| Deploy Pages | \`${env("SHOULD_DEPLOY")}\` |
| Seconds since previous main run | \`${env("SECONDS_SINCE_PREVIOUS_RUN")}\` |
| Full-build reason | \`${env("FULL_REASON")}\` |

### Changed files

\`\`\`text
${env("CHANGED_FILES")}
\`\`\``);
}

function runTests() {
  run("pnpm", env("BUILD_SCOPE") === "all" ? ["test"] : ["test", "--", `src/${env("BUILD_SCOPE")}`]);
}
function runBenchmarks() {
  const scope = env("BUILD_SCOPE");
  if (scope === "devtools") {
    const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts ?? {};
    run("pnpm", [scripts["bench:devtools"] ? "bench:devtools" : "bench:ci"]);
  } else if (scope === "cipo") run("pnpm", ["bench:cipo"]);
  else if (scope === "fabrica") run("pnpm", ["bench:fabrica"]);
  else run("pnpm", ["bench:ci"]);
}
function build() {
  const scope = env("BUILD_SCOPE");
  if (scope === "all") { run("pnpm", ["build"]); run("pnpm", ["build:devtools"]); }
  else if (scope === "devtools") run("pnpm", ["build:devtools"]);
  else if (scope === "maquina") run("pnpm", ["build:maquina"]);
  else run("pnpm", ["build"], { env: { BUILD_ENTRIES: scope } });
}
function sourceDir() { return env("BUILD_SCOPE") === "devtools" ? env("DEVTOOLS_DIST_DIR", "src/devtools/dist") : env("FULL_DIST_DIR", "dist"); }
function createCanary() {
  const root = sourceDir();
  const files = walkFiles(root).filter((file) => file.endsWith(".iife.min.js") && !file.endsWith(".canary.iife.min.js"));
  for (const file of files) cpSync(file, file.replace(/\.iife\.min\.js$/, ".canary.iife.min.js"));
  if (!files.length) console.warn(`::warning::No minified IIFE bundle was available for canary aliases in ${root}`);
}
function collectPublication() {
  const root = sourceDir();
  const delta = resetDir(join(env("RUNNER_TEMP"), "publication-delta"));
  const channel = env("RELEASE_CHANNEL");
  for (const file of walkFiles(root)) {
    const name = basename(file);
    const isCanary = name.endsWith(".canary.iife.min.js");
    if (channel === "canary" && !isCanary) continue;
    if (channel === "production" && isCanary) continue;
    if (!["canary", "production", "both"].includes(channel)) throw new Error(`Unknown release channel: ${channel}`);
    const destination = join(delta, relative(root, file));
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(file, destination);
  }
  const files = relativeFiles(delta);
  if (!files.length) throw new Error("No files were selected for publication");
  output("path", delta);
  summary(`## 📦 Publication delta

\`\`\`text
${files.join("\n")}
\`\`\``);
}
async function restorePagesState() {
  const stateDir = resetDir(join(env("RUNNER_TEMP"), "pages-state"));
  const endpoint = `/repos/${env("GITHUB_REPOSITORY")}/actions/artifacts?name=${env("PAGES_STATE_ARTIFACT")}&per_page=100`;
  const raw = run("gh", ["api", "-H", "Accept: application/vnd.github+json", endpoint], { capture: true, allowFailure: true, quiet: true });
  if (!raw) return console.log("No previous Pages state found. Starting with an empty publication tree.");
  const artifacts = JSON.parse(raw).artifacts.filter((item) => !item.expired).sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)));
  if (!artifacts[0]) return console.log("No previous Pages state found. Starting with an empty publication tree.");
  const zip = join(env("RUNNER_TEMP"), "pages-state.zip");
  const token = env("GH_TOKEN") || env("GITHUB_TOKEN");
  const response = await fetch(`https://api.github.com/repos/${env("GITHUB_REPOSITORY")}/actions/artifacts/${artifacts[0].id}/zip`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      "user-agent": "rodkisten-bundler-workflow",
    },
  });
  if (!response.ok) throw new Error(`Unable to download Pages state artifact: ${response.status} ${response.statusText}`);
  writeFileSync(zip, Buffer.from(await response.arrayBuffer()));
  run("unzip", ["-q", zip, "-d", stateDir]);
}
function copyDirectoryContents(source, destination) {
  if (!existsSync(source)) return;
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    cpSync(join(source, entry.name), join(destination, entry.name), { recursive: true, force: true });
  }
}

function mergePublication() {
  const publication = resetDir(join(env("RUNNER_TEMP"), "pages-publication"));
  const state = join(env("RUNNER_TEMP"), "pages-state");
  if (env("FORCE_CLEAN_DEPLOY") !== "true") copyDirectoryContents(state, publication);
  copyDirectoryContents(env("DELTA_PATH"), publication);
  output("path", publication);
  summary(`## 🌐 Complete Pages state

| Clean deploy | \`${env("FORCE_CLEAN_DEPLOY")}\` |

\`\`\`text
${relativeFiles(publication).join("\n")}
\`\`\``);
}
async function notifyPushcut() {
  const response = await fetch("https://api.pushcut.io/l-nh53UuliQPN7-1JMPbg/notifications/Bundler%20Build%20Published", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input: env("WORKFLOW_ID"), text: "Open browser bundle pipeline", title: "Build finished" }) });
  if (!response.ok) throw new Error(`Pushcut notification failed: ${response.status} ${response.statusText}`);
}
const commands = { "resolve-scope": resolveScope, "write-scope-summary": writeScopeSummary, "run-tests": runTests, "run-benchmarks": runBenchmarks, build, "create-canary": createCanary, "collect-publication": collectPublication, "restore-pages-state": restorePagesState, "merge-publication": mergePublication, "notify-pushcut": notifyPushcut };
if (!commands[command]) throw new Error(`Unknown publish workflow command: ${command}`);
await commands[command]();
