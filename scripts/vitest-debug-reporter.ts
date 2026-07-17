import type {
  Reporter,
  TestCase,
  TestModule,
  TestRunEndReason,
  TestSpecification,
} from "vitest/node";

const HEARTBEAT_INTERVAL_MS = 10_000;

type ModulePhase = "queued" | "collected" | "running";

type ModuleState = {
  readonly module: TestModule;
  phase: ModulePhase;
  since: number;
};

/**
 * Reporter focused on diagnosing tests, files and collection phases that hang.
 *
 * All output is written directly to stdout. GitHub Actions hides `::debug::`
 * workflow commands by default, so regular output is essential when a worker
 * or the surrounding job is eventually killed by a timeout.
 */
export default class VitestDebugReporter implements Reporter {
  private readonly modules = new Map<string, ModuleState>();
  private readonly startedTests = new Map<string, number>();
  private heartbeat: NodeJS.Timeout | null = null;

  onTestRunStart(specifications: readonly TestSpecification[]): void {
    this.log("run:start", `files=${specifications.length}`);
    this.startHeartbeat();
  }

  onTestModuleQueued(testModule: TestModule): void {
    this.setModulePhase(testModule, "queued");
    this.log("file:queued", testModule.moduleId);
  }

  onTestModuleCollected(testModule: TestModule): void {
    this.setModulePhase(testModule, "collected");
    this.log("file:collected", testModule.moduleId);
  }

  onTestModuleStart(testModule: TestModule): void {
    this.setModulePhase(testModule, "running");
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
    this.modules.delete(testModule.moduleId);
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

  private setModulePhase(testModule: TestModule, phase: ModulePhase): void {
    this.modules.set(testModule.moduleId, {
      module: testModule,
      phase,
      since: performance.now(),
    });
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
    const now = performance.now();

    for (const [key, startedAt] of this.startedTests) {
      this.log(
        `${kind}:test`,
        `${key} running=${this.formatDuration(now - startedAt)}`,
      );
    }

    for (const [moduleId, state] of this.modules) {
      const result = this.moduleProgress(state.module);
      this.log(
        `${kind}:file`,
        [
          `phase=${state.phase}`,
          `age=${this.formatDuration(now - state.since)}`,
          `tests=${result.completed}/${result.total}`,
          `pending=${result.pending}`,
          moduleId,
        ].join(" "),
      );
    }

    if (this.startedTests.size === 0 && this.modules.size === 0) {
      this.log(`${kind}:idle`, "no tracked test or module work");
    }
  }

  private moduleProgress(testModule: TestModule): {
    completed: number;
    pending: number;
    total: number;
  } {
    let total = 0;
    let pending = 0;

    try {
      for (const test of testModule.children.allTests()) {
        total += 1;
        if (test.result().state === "pending") pending += 1;
      }
    } catch {
      // Collection can still be incomplete while a module is queued.
    }

    return {
      completed: total - pending,
      pending,
      total,
    };
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
