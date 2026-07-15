import { writeFileSync } from "node:fs";
import { env, ensureEmptyDir, githubJson, run } from "./utils.mjs";

const runnerTemp = env("RUNNER_TEMP", ".tmp");
const stateDir = `${runnerTemp}/pages-state`;
const zipPath = `${runnerTemp}/pages-state.zip`;
ensureEmptyDir(stateDir);

try {
  const artifactName = env("PAGES_STATE_ARTIFACT", "browser-pages-state");
  const data = await githubJson(`/actions/artifacts?name=${encodeURIComponent(artifactName)}&per_page=100`);
  const artifact = (data.artifacts ?? [])
    .filter((item) => !item.expired)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  if (!artifact?.id) {
    console.log("No previous Pages state found. Starting with an empty publication tree.");
    process.exit(0);
  }
  const token = env("GH_TOKEN");
  const response = await fetch(`https://api.github.com/repos/${env("GITHUB_REPOSITORY")}/actions/artifacts/${artifact.id}/zip`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) throw new Error(`Unable to download Pages state artifact: ${response.status} ${response.statusText}`);
  writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()));
  run("unzip", ["-q", zipPath, "-d", stateDir]);
} catch (error) {
  console.warn(`Unable to restore previous Pages state: ${error instanceof Error ? error.message : String(error)}`);
}
