import { appendSummary, env } from "./utils.mjs";
appendSummary(`## 🧭 Benchmark revisions\n\n| Field | Value |\n| --- | --- |\n| Run | \`${env("SHOULD_RUN")}\` |\n| Reason | \`${env("REASON")}\` |\n| Baseline | \`${env("BASE_SHA")}\` |\n| Current | \`${env("HEAD_SHA")}\` |\n| Rounds | \`${env("ROUNDS")}\` |`);
