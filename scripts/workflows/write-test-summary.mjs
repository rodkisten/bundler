import { existsSync, readFileSync } from "node:fs";
import { appendSummary, env } from "./utils.mjs";
let tail = "";
if (existsSync("artifacts/test/test-output.log")) tail = readFileSync("artifacts/test/test-output.log", "utf8").split("\n").slice(-200).join("\n");
appendSummary(`## 🧪 Test Report\n\n| Field | Value |\n| --- | --- |\n| Status | \`${env("TEST_STATUS")}\` |\n| Scope | \`${env("TEST_SCOPE")}\` |\n| Affected folders | \`${env("AFFECTED_DIRS_TEXT")}\` |\n| Blocking build | \`false\` |\n\n### Last test output lines\n\n\`\`\`markdown\n${tail}\n\`\`\``);
