import { performance } from "node:perf_hooks";

const startedAt = performance.now();
const githubActions = process.env.GITHUB_ACTIONS === "true";

export async function buildStep<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const stepStartedAt = performance.now();
  if (githubActions) console.log(`::group::🔨 ${escapeWorkflowCommand(name)}`);
  console.log(`[build +${formatDuration(performance.now() - startedAt)}] ▶ ${name}`);

  try {
    const result = await operation();
    console.log(`[build +${formatDuration(performance.now() - startedAt)}] ✓ ${name} (${formatDuration(performance.now() - stepStartedAt)})`);
    return result;
  } catch (error) {
    console.error(`[build +${formatDuration(performance.now() - startedAt)}] ✗ ${name}: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  } finally {
    if (githubActions) console.log("::endgroup::");
  }
}

export function buildInfo(message: string): void {
  console.log(`[build +${formatDuration(performance.now() - startedAt)}] • ${message}`);
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1_000) return `${Math.round(durationMs)}ms`;
  return `${(durationMs / 1_000).toFixed(2)}s`;
}

function escapeWorkflowCommand(value: string): string {
  return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}
