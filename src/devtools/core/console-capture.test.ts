import { afterEach, describe, expect, it, vi } from "vitest";
import { ConsoleCapture } from "./console-capture";

describe("ConsoleCapture", () => {
  const captures: ConsoleCapture[] = [];

  afterEach(() => {
    for (const capture of captures.splice(0)) capture.destroy();
    vi.restoreAllMocks();
  });

  it("restores Console.prototype after prototype capture is disabled", () => {
    const capture = new ConsoleCapture();
    captures.push(capture);

    const prototype = Object.getPrototypeOf(console);
    const before = Object.getOwnPropertyDescriptor(prototype, "log");

    capture.overrideConsole({ patchPrototype: true, watchdog: false });
    capture.restoreConsole();

    const after = Object.getOwnPropertyDescriptor(prototype, "log");
    expect(after).toEqual(before);
  });

  it("does not recursively emit when a record subscriber throws", () => {
    const capture = new ConsoleCapture();
    captures.push(capture);
    const healthy = vi.fn();

    capture.on("record", () => {
      throw new Error("broken console renderer");
    });
    capture.on("record", healthy);

    expect(() => capture.record("error", [new Error("page failure")])).not.toThrow();
    expect(healthy).toHaveBeenCalledTimes(1);
  });
});
