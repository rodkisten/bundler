import { env, run } from "./utils.mjs";
const scope = env("BUILD_SCOPE", "all");
run("pnpm", scope === "all" ? ["test"] : ["test", "--", `src/${scope}`]);
