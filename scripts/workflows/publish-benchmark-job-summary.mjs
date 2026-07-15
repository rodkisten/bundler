import { existsSync, readFileSync } from "node:fs";
import { appendSummary } from "./utils.mjs";
appendSummary(existsSync("bench/COMPARISON.md") ? readFileSync("bench/COMPARISON.md", "utf8") : "## ⚠️ Benchmark report was not generated");
