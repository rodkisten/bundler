import { runLogged } from "./utils.mjs";
await runLogged("pnpm", ["bench:all"], "artifacts/test/benchmarks-output.log");
