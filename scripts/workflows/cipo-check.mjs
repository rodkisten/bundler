import { env } from "./lib.mjs";
import { runLogged } from "./utils.mjs";

const command = process.argv[2];

if (command === "run-tests") {
  await runLogged("pnpm", ["test"], "test-output.log", {
    env: { LANG: "C.UTF-8", LC_ALL: "C.UTF-8" },
  });
} else if (command === "assert-tests-success") {
  if (env("TEST_OUTCOME") !== "success") {
    throw new Error(
      `Cipó test step finished with outcome: ${env("TEST_OUTCOME", "unknown")}`,
    );
  }
} else {
  throw new Error(`Unknown Cipó workflow command: ${command}`);
}
