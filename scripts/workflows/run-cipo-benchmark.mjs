import { mkdirSync, createWriteStream } from "node:fs";
import { spawn } from "node:child_process";

mkdirSync("artifacts/test", { recursive: true });
const log = createWriteStream("artifacts/test/cipo-benchmark.log");
const bench = spawn("pnpm", ["exec", "vitest", "bench", "cipo/test/cipo.bench.ts", "--run"], { stdio: ["inherit", "pipe", "inherit"] });
const strip = spawn("node", ["scripts/strip-ansi-stream.mjs"], { stdio: ["pipe", "pipe", "inherit"] });
bench.stdout.pipe(strip.stdin);
strip.stdout.on("data", (chunk) => { process.stdout.write(chunk); log.write(chunk); });
const wait = (child) => new Promise((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
const [benchCode, stripCode] = await Promise.all([wait(bench), wait(strip)]);
log.end();
if (benchCode !== 0 || stripCode !== 0) throw new Error(`Cipo benchmark pipeline failed (bench=${benchCode}, strip=${stripCode})`);
