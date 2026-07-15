import { env, runLogged } from "./utils.mjs";
const scope = env("TEST_SCOPE", "all");
const dirs = JSON.parse(env("AFFECTED_DIRS_JSON", "[]"));
const args = scope === "all" || dirs.length === 0 ? ["test"] : ["exec", "vitest", "run", ...dirs, "--passWithNoTests"];
if (dirs.length && scope !== "all") console.log(`Running focused tests for:\n${dirs.map((dir) => ` - ${dir}`).join("\n")}`);
await runLogged("pnpm", args, "artifacts/test/test-output.log", { env: { LANG: "C.UTF-8", LC_ALL: "C.UTF-8" } });
