import { env, runLogged } from "./lib.mjs";

const command = process.argv[2];

if (command === "run-tests") {
  runLogged("pnpm", ["test"], "test-output.log");
} else if (command === "assert-tests-success") {
  if (env("TEST_OUTCOME") !== "success") {
    throw new Error(`Cipó test step finished with outcome: ${env("TEST_OUTCOME", "unknown")}`);
  }
} else {
  throw new Error(`Unknown Cipó workflow command: ${command}`);
}
