import { env, git, writeOutput } from "./utils.mjs";
const output = git(["ls-remote", "--exit-code", "origin", `refs/heads/${env("GITHUB_REF_NAME")}`]);
const remoteSha = output.split(/\s+/)[0] ?? "";
if (remoteSha !== env("EXPECTED_HEAD_SHA")) {
  writeOutput("fresh", false);
  console.log(`Branch advanced to ${remoteSha}; refusing to commit stale benchmark data.`);
} else writeOutput("fresh", true);
