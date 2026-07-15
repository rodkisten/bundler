import { existsSync, readFileSync } from "node:fs";
import { env, githubJson } from "./utils.mjs";
const reportPath = env("REPORT_PATH", "bench/COMPARISON.md");
if (!existsSync(reportPath)) { console.warn(`Missing ${reportPath}; PR comment skipped.`); process.exit(0); }
const [owner] = env("GITHUB_REPOSITORY").split("/");
const branch = env("GITHUB_REF_NAME");
const pulls = await githubJson(`/pulls?head=${encodeURIComponent(`${owner}:${branch}`)}&state=open&per_page=10`);
if (!pulls.length) { console.log(`No open pull request found for ${branch}.`); process.exit(0); }
const issueNumber = pulls[0].number;
const marker = "<!-- rod-benchmark-report -->";
const body = readFileSync(reportPath, "utf8");
const comments = await githubJson(`/issues/${issueNumber}/comments?per_page=100`);
const existing = comments.find((comment) => comment.user?.type === "Bot" && comment.body?.includes(marker));
if (existing) await githubJson(`/issues/comments/${existing.id}`, { method: "PATCH", body: { body } });
else await githubJson(`/issues/${issueNumber}/comments`, { method: "POST", body: { body } });
