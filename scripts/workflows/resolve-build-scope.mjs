import { env, envBoolean, git, githubJson, writeOutput } from "./utils.mjs";

const EMPTY_SHA = "0000000000000000000000000000000000000000";
const ALL_PROJECTS = ["broto", "cipo", "fabrica", "fabrica-elements", "seiva-state", "bundle", "maquina", "devtools", "nascente"];
const TEST_FILE_PATTERN = /(^|\/)(tests?|__tests__)\/|\.(test|spec)\.[cm]?[jt]sx?$|^vitest\.config\.|^scripts\/.*benchmark/;

function changedFilesForEvent(eventName) {
  const before = env("BEFORE_SHA");
  const head = env("HEAD_SHA");
  const requestedProject = env("REQUESTED_PROJECT", "auto");

  if (eventName === "pull_request") {
    return git(["diff", "--name-only", env("PR_BASE_SHA"), env("PR_HEAD_SHA")]).split("\n").filter(Boolean);
  }

  if (eventName === "push") {
    const hasBefore = before && before !== EMPTY_SHA && spawnGitCatFile(before);
    const output = hasBefore
      ? git(["diff", "--name-only", before, head])
      : git(["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", head]);
    return output.split("\n").filter(Boolean);
  }

  return [`manual:${requestedProject}`];
}

function spawnGitCatFile(sha) {
  try {
    git(["cat-file", "-e", `${sha}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

function projectForPath(file) {
  if (/^nascente\//.test(file)) return "nascente";
  if (/^devtools\//.test(file)) return "devtools";
  if (/^fabrica\//.test(file)) return "fabrica";
  if (/^cipo\//.test(file)) return "cipo";
  if (/^broto\//.test(file)) return "broto";
  if (/^fabrica-elements\//.test(file)) return "fabrica-elements";
  if (/^seiva-state\//.test(file)) return "seiva-state";
  if (/^maquina\//.test(file)) return "maquina";
  if (/^rod\//.test(file)) return "bundle";
  return null;
}

function isSharedPath(file) {
  return /^(package\.json|pnpm-lock\.yaml|package-lock\.json|tsconfig[^/]*\.json|vite\.config\.|scripts\/|\.github\/workflows\/)/.test(file);
}

async function secondsSincePreviousPush() {
  if (env("EVENT_NAME") !== "push") return 0;
  try {
    const workflow = env("WORKFLOW_FILE", "publish-browser-bundle.yml");
    const branch = env("DEFAULT_BRANCH", "main");
    const currentRunId = Number(env("CURRENT_RUN_ID", "0"));
    const data = await githubJson(`/actions/workflows/${encodeURIComponent(workflow)}/runs?branch=${encodeURIComponent(branch)}&event=push&per_page=20`);
    const previous = (data.workflow_runs ?? [])
      .filter((run) => Number(run.id) !== currentRunId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    if (!previous?.created_at) return 999999;
    return Math.max(0, Math.floor((Date.now() - new Date(previous.created_at).getTime()) / 1000));
  } catch (error) {
    console.warn(`Unable to resolve previous workflow run: ${error instanceof Error ? error.message : String(error)}`);
    return 999999;
  }
}

const eventName = env("EVENT_NAME");
const requestedProject = env("REQUESTED_PROJECT", "auto");
const requestedChannel = env("REQUESTED_CHANNEL", "canary");
const testMode = env("TEST_MODE", "auto");
const requestedDeploy = envBoolean("REQUESTED_DEPLOY", true);
const fullInterval = Number(env("MAIN_FULL_INTERVAL_SECONDS", "300"));
const changedFiles = changedFilesForEvent(eventName);
const testsChanged = changedFiles.some((file) => TEST_FILE_PATTERN.test(file));
const affected = new Set();
let sharedChange = false;

for (const file of changedFiles) {
  if (!file || file.startsWith("manual:")) continue;
  const project = projectForPath(file);
  if (project) affected.add(project);
  if (isSharedPath(file)) sharedChange = true;
}
if (sharedChange) ALL_PROJECTS.forEach((project) => affected.add(project));

let affectedProjects = [...affected].sort();
let affectedCount = affectedProjects.length;
const secondsSincePreviousRun = await secondsSincePreviousPush();
let buildScope = "none";
let fullReason = "";

if (requestedProject !== "auto") {
  if (requestedProject === "all") {
    buildScope = "all";
    affectedProjects = [...ALL_PROJECTS];
    affectedCount = affectedProjects.length;
    fullReason = "manual all";
  } else {
    buildScope = requestedProject;
    affectedProjects = [requestedProject];
    affectedCount = 1;
  }
} else if (eventName === "push" && (changedFiles.length > 1 || secondsSincePreviousRun >= fullInterval)) {
  buildScope = "all";
  affectedProjects = [...ALL_PROJECTS];
  affectedCount = affectedProjects.length;
  fullReason = changedFiles.length > 1
    ? "main push changed more than one file"
    : "main push is at least five minutes after the previous run";
} else if (eventName === "pull_request" && affectedCount > 1) {
  buildScope = "all";
  affectedProjects = [...ALL_PROJECTS];
  affectedCount = affectedProjects.length;
  fullReason = "pull request affects more than one project";
} else if (affectedCount === 1) {
  buildScope = affectedProjects[0];
} else if (affectedCount > 1) {
  buildScope = "all";
  affectedProjects = [...ALL_PROJECTS];
  affectedCount = affectedProjects.length;
  fullReason = "more than one project affected";
}

const releaseChannel = eventName === "pull_request" ? "canary" : eventName === "push" ? "production" : requestedChannel;
let shouldTest;
if (testMode === "always") shouldTest = true;
else if (testMode === "never") shouldTest = false;
else if (testMode === "auto") shouldTest = buildScope === "all" || testsChanged || affectedCount > 1;
else throw new Error(`Unknown test mode: ${testMode}`);

const shouldDeploy = /* eventName !== "pull_request" && */ requestedDeploy && buildScope !== "none";
const outputs = {
  build_scope: buildScope,
  affected_projects: affectedProjects.join(","),
  affected_count: affectedCount,
  changed_file_count: changedFiles.length,
  tests_changed: testsChanged,
  should_test: shouldTest,
  release_channel: releaseChannel,
  should_deploy: shouldDeploy,
  full_reason: fullReason,
  seconds_since_previous_run: secondsSincePreviousRun,
  changed_files: changedFiles.join("\n"),
};
for (const [key, value] of Object.entries(outputs)) writeOutput(key, value);
console.log(outputs);
