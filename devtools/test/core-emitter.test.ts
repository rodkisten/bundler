import { describe, expect, it, vi } from "vitest";
import { Emitter } from "@rodkisten/devtools/core-emitter";

type TestEvents = {
  value: [value: number];
};

describe.skip("Emitter", () => {
  it("isolates subscriber failures without rethrowing them globally", async () => {
    const emitter = new Emitter<TestEvents>();
    const healthy = vi.fn();

    emitter.on("value", () => {
      throw new Error("subscriber exploded");
    });
    emitter.on("value", healthy);

    expect(() => emitter.emit("value", 42)).not.toThrow();
    expect(healthy).toHaveBeenCalledWith(42);

    await Promise.resolve();
  });
});
