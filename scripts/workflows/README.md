# Workflow scripts

GitHub Actions workflows should keep orchestration in YAML and move procedural logic here.

Each workflow-facing script exposes explicit subcommands and communicates with Actions through the standard environment files:

- `GITHUB_OUTPUT` for step outputs;
- `GITHUB_STEP_SUMMARY` for Markdown summaries;
- environment variables for GitHub expressions and workflow inputs.

## Files

- `benchmark-regression.mjs`: revision resolution, benchmark orchestration, freshness checks, benchmark commits and PR comments.
- `ci-tests.mjs`: affected-folder detection, focused tests, benchmark execution and summaries.
- `cipo-check.mjs`: Cipó test log capture and outcome validation.
- `publish-browser-bundle.mjs`: project scope detection, selective builds, canary aliases, incremental Pages state and notifications.
- `lib.mjs`: process execution, output, summary and filesystem helpers shared by workflow scripts.

Keep simple declarative commands such as dependency installation and `pnpm typecheck` directly in YAML. New branching, filesystem manipulation, API calls, output generation, or multi-command procedures belong in this directory instead of inline `run: |` blocks.
