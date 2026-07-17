import type { Reporter, TestCase, TestModule } from "vitest/node";

const IS_GITHUB_ACTIONS = process.env.GITHUB_ACTIONS === "true";

/**
 * Reporter focused on diagnosing tests that never finish.
 *
 * Vitest calls `onTestCaseReady` immediately before a test starts, including its
 * beforeEach/afterEach lifecycle. A START line without a matching DONE line is
 * therefore the exact test that was active when a worker timed out or stalled.
 */
export default class VitestDebugReporter implements Reporter {
  private readonly startedTests = new Map<string, number>();

  onTestModuleStart(testModule: TestModule): void {
    this.log("file:start", testModule.moduleId);
  }

  onTestCaseReady(testCase: TestCase): void {
    const key = this.testKey(testCase);
    this.startedTests.set(key, performance.now());
    this.log("test:start", this.testLabel(testCase));
  }

  onTestCaseResult(testCase: TestCase): void {
    const key = this.testKey(testCase);
    const startedAt = this.startedTests.get(key);
    const duration = startedAt == null
      ? "unknown"
      : this.formatDuration(performance.now() - startedAt);

    this.startedTests.delete(key);

    const result = testCase.result();
    this.log(
      "test:done",
      `${this.testLabel(testCase)} state=${result.state} duration=${duration}`,
    );
  }

  onTestModuleEnd(testModule: TestModule): void {
    this.log("file:done", testModule.moduleId);
  }

  private testKey(testCase: TestCase): string {
    return `${testCase.module.moduleId}::${testCase.fullName}`;
  }

  private testLabel(testCase: TestCase): string {
    return `${testCase.module.moduleId} > ${testCase.fullName}`;
  }

  private formatDuration(durationMs: number): string {
    if (durationMs < 1_000) return `${durationMs.toFixed(0)}ms`;
    return `${(durationMs / 1_000).toFixed(2)}s`;
  }

  private log(kind: string, message: string): void {
    const output = `[vitest:${kind}] ${message}`;

    // Keep progress as regular log output. GitHub annotations are reserved for
    // actual failures by the built-in github-actions reporter to avoid flooding
    // the workflow summary with one annotation per successful test.
    console.log(IS_GITHUB_ACTIONS ? `::debug::${this.escapeWorkflowCommand(output)}` : output);
  }

  private escapeWorkflowCommand(value: string): string {
    return value
      .replace(/%/g, "%25")
      .replace(/\r/g, "%0D")
      .replace(/\n/g, "%0A");
  }
}
