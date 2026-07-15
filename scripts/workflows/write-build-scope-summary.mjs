import { appendSummary, env } from "./utils.mjs";

appendSummary(`## 🧭 Build policy

| Field | Value |
| --- | --- |
| Scope | \`${env("BUILD_SCOPE_OUTPUT")}\` |
| Affected projects | \`${env("AFFECTED_PROJECTS_OUTPUT")}\` |
| Affected count | \`${env("AFFECTED_COUNT_OUTPUT")}\` |
| Changed files | \`${env("CHANGED_FILE_COUNT_OUTPUT")}\` |
| Tests changed | \`${env("TESTS_CHANGED_OUTPUT")}\` |
| Run tests | \`${env("SHOULD_TEST_OUTPUT")}\` |
| Release channel | \`${env("RELEASE_CHANNEL_OUTPUT")}\` |
| Deploy Pages | \`${env("SHOULD_DEPLOY_OUTPUT")}\` |
| Seconds since previous main run | \`${env("SECONDS_SINCE_PREVIOUS_RUN_OUTPUT")}\` |
| Full-build reason | \`${env("FULL_REASON_OUTPUT")}\` |

### Changed files

\`\`\`text
${env("CHANGED_FILES_OUTPUT")}
\`\`\``);
