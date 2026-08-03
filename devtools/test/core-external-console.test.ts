import { afterEach, describe, expect, it, vi } from "vitest";
import { ConsoleCapture } from "@rodkisten/devtools/core/console-capture";
import { createExternalConsoleStream } from "@rodkisten/devtools/core/external-console";
import type { ConsoleLike, ExternalConsoleStream } from "@rodkisten/devtools/types";

describe("external console ingestion", () => {
  const captures: ConsoleCapture[] = [];
  const streams: ExternalConsoleStream[] = [];

  afterEach(() => {
    for (const stream of streams.splice(0)) stream.destroy();
    for (const capture of captures.splice(0)) capture.destroy();
    vi.restoreAllMocks();
  });

  it("appends external records with an isolated source badge", () => {
    const capture = new ConsoleCapture();
    const stream = createExternalConsoleStream(capture, {
      source: "worker-a",
      badge: "wrk",
    });
    captures.push(capture);
    streams.push(stream);

    stream.log("ready", { port: 7 });
    stream.group("nested");
    stream.warn("inside");
    stream.append("info", "appended inside");
    stream.groupEnd();
    stream.count("jobs");
    stream.count("jobs");

    const records = capture.getRecords();
    expect(records).toHaveLength(6);
    expect(records[0]).toMatchObject({
      level: "log",
      args: ["ready", { port: 7 }],
      groupDepth: 0,
      origin: {
        kind: "external",
        label: "wrk",
        source: "worker-a",
      },
    });
    expect(records[2]?.groupDepth).toBe(1);
    expect(records[3]).toMatchObject({
      level: "info",
      args: ["appended inside"],
      groupDepth: 1,
    });
    expect(records[5]?.args).toEqual(["jobs: 2"]);
  });

  it("intercepts and restores every supported console method without losing passthrough", () => {
    const capture = new ConsoleCapture();
    const originalLog = vi.fn();
    const originalWarn = vi.fn();
    const target = {
      log: originalLog,
      warn: originalWarn,
    } as ConsoleLike & {
      log: (...args: unknown[]) => unknown;
      warn: (...args: unknown[]) => unknown;
    };
    const stream = createExternalConsoleStream(capture, {
      source: "sdk",
      console: target,
    });
    captures.push(capture);
    streams.push(stream);

    target.log("hello");
    target.warn("slow");
    target.assert?.(false, "broken");
    target.time?.("load");
    target.timeEnd?.("load");

    expect(originalLog).toHaveBeenCalledWith("hello");
    expect(originalWarn).toHaveBeenCalledWith("slow");
    expect(capture.getRecords().map((record) => record.level)).toEqual([
      "log",
      "warn",
      "error",
      "info",
    ]);
    expect(typeof target.groupCollapsed).toBe("function");
    expect(typeof target.profileEnd).toBe("function");

    stream.restore();
    expect(target.log).toBe(originalLog);
    expect(target.warn).toBe(originalWarn);
    expect("groupCollapsed" in target).toBe(false);
    expect("profileEnd" in target).toBe(false);
  });

  it("can disable passthrough while keeping native method semantics", () => {
    const capture = new ConsoleCapture();
    const original = vi.fn();
    const target = { log: original } as ConsoleLike & {
      log: (...args: unknown[]) => unknown;
    };
    const stream = createExternalConsoleStream(capture, {
      console: target,
      passthrough: false,
    });
    captures.push(capture);
    streams.push(stream);

    target.log("captured only");

    expect(original).not.toHaveBeenCalled();
    expect(capture.getRecords()[0]?.args).toEqual(["captured only"]);
  });
});
