// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { signal } from "../../broto/reactivity";
import { createDirectiveController } from "../dom-directives";
import { when, repeat } from "../directives";

describe("Fabrica DOM directive controllers", () => {
  function range() {
    const root = document.createElement("div");
    const start = document.createComment("start");
    const end = document.createComment("end");
    root.append(start, end);
    return { root, start, end };
  }

  it("updates when() branches inside a stable comment range", async () => {
    const { root, start, end } = range();
    const open = signal(false);
    const directive = when(open, () => "open", () => "closed");
    const controller = createDirectiveController(start, end, directive);

    controller.update(directive);
    expect(root.textContent).toBe("closed");

    open.set(true);
    await Promise.resolve();
    expect(root.textContent).toBe("open");

    controller.dispose();
    expect(root.textContent).toBe("");
  });

  it("renders repeat() records and clears them on dispose", () => {
    const { root, start, end } = range();
    const directive = repeat(["a", "b"], item => item, ctx => ctx.item());
    const controller = createDirectiveController(start, end, directive);

    controller.update(directive);
    expect(root.textContent).toBe("ab");
    controller.dispose();
    expect(root.textContent).toBe("");
  });
});
