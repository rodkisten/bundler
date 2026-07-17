import type {
  Reporter,
  TestCase,
  TestModule,
  TestRunEndReason,
  TestSpecification,
} from "vitest/node";

const HEARTBEAT_INTERVAL_MS = 10_000;

/**
 * Reporter focused on diagnosing tests, files and collection phases that hang.
 *
 * All output is written directly to stdout. GitHub Actions hides `::debug::`
 * workflow commands by default, so using regular output is essential when the
 * process is eventually killed by a job or step timeout.
 */
export default class VitestDebugReporter implements Reporter {
  private readonly queuedModules = new Set<string>();
  private readonly activeModules = new Set<string>();
  private readonly startedTests = new Map<string, number>();
  private heartbeat: NodeJS.Timeout | null = null;

  onTestRunStart(specifications: TestSpecification[]): void {
    this.log("run:start", `files=${specifications.length}`);
    this.startHeartbeat();
  }

  onTestModuleQueued(testModule: TestModule): void {
    this.queuedModules.add(testModule.moduleId);
    this.log("file:queued", testModule.moduleId);
  }

  onTestModuleCollected(testModule: TestModule): void {
    this.queuedModules.delete(testModule.moduleId);
    this.log("file:collected", testModule.moduleId);
  }

  onTestModuleStart(testModule: TestModule): void {
    this.queuedModules.delete(testModule.moduleId);
    this.activeModules.add(testModule.moduleId);
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
    this.activeModules.delete(testModule.moduleId);
    this.log("file:done", testModule.moduleId);
  }

  onTestRunEnd(
    _testModules: ReadonlyArray<TestModule>,
    _unhandledErrors: ReadonlyArray<unknown>,
    reason: TestRunEndReason,
  ): void {
    this.stopHeartbeat();
    this.log("run:done", `reason=${reason}`);
    this.reportActiveWork("final");
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeat = setInterval(() => {
      this.reportActiveWork("heartbeat");
    }, HEARTBEAT_INTERVAL_MS);

    // Diagnostics must never become the reason Vitest itself cannot exit.
    this.heartbeat.unref();
  }

  private stopHeartbeat(): void {
    if (!this.heartbeat) return;
    clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  private reportActiveWork(kind: "heartbeat" | "final"): void {
    if (this.startedTests.size > 0) {
      for (const [key, startedAt] of this.startedTests) {
        this.log(
          `${kind}:test`,
          `${key} running=${this.formatDuration(performance.now() - startedAt)}`,
        );
      }
      return;
    }

    if (this.activeModules.size > 0) {
      this.log(`${kind}:files`, [...this.activeModules].join(" | "));
      return;
    }

    if (this.queuedModules.size > 0) {
      this.log(`${kind}:queued`, [...this.queuedModules].join(" | "));
    }
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
    process.stdout.write(`[vitest:${kind}] ${message}\n`);
  }
}
