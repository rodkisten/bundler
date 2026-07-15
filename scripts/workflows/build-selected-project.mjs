import { env, run } from "./utils.mjs";
const scope = env("BUILD_SCOPE", "all");
if (scope === "all") {
  run("pnpm", ["build"]);
  run("pnpm", ["build:devtools"]);
} else if (scope === "devtools") {
  run("pnpm", ["build:devtools"]);
} else {
  run("pnpm", ["build"], { env: { BUILD_ENTRIES: scope } });
}
