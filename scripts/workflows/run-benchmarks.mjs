import { env, run } from "./utils.mjs";
const scope = env("BUILD_SCOPE", "all");
if (scope === "devtools") {
  const scripts = run("pnpm", ["run"], { capture: true, allowFailure: true });
  run("pnpm", scripts.includes("bench:devtools") ? ["bench:devtools"] : ["bench:ci"]);
} else if (scope === "cipo") run("pnpm", ["bench:cipo"]);
else if (scope === "fabrica") run("pnpm", ["bench:fabrica"]);
else run("pnpm", ["bench:ci"]);
