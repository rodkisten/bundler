import { appendSummary, env } from "./utils.mjs";
appendSummary(`## ⏱️ Benchmark Report\n\n| Field | Value |\n| --- | --- |\n| Should benchmark | \`${env("SHOULD_BENCHMARK")}\` |\n| Reason | \`${env("BENCHMARK_REASON")}\` |\n| Status | \`${env("BENCHMARK_STATUS", "skipped")}\` |`);
