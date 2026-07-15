import { readFileSync, existsSync } from "node:fs";
import { appendSummary, env } from "./utils.mjs";
const changed = existsSync("artifacts/changes/changed-files.txt") ? readFileSync("artifacts/changes/changed-files.txt", "utf8").trim() : "";
appendSummary(`## 🧭 Change Detector\n\n| Field | Value |\n| --- | --- |\n| Should test | \`${env("SHOULD_TEST_OUTPUT")}\` |\n| Test scope | \`${env("TEST_SCOPE_OUTPUT")}\` |\n| Reason | \`${env("REASON_OUTPUT")}\` |\n| Should benchmark | \`${env("SHOULD_BENCHMARK_OUTPUT")}\` |\n| Benchmark reason | \`${env("BENCHMARK_REASON_OUTPUT")}\` |\n\n### Changed files\n\n\`\`\`txt\n${changed}\n\`\`\`\n\n### Affected folders\n\n\`\`\`txt\n${env("AFFECTED_DIRS_TEXT_OUTPUT")}\n\`\`\``);
