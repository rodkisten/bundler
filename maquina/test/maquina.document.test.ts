import { describe, expect, it } from "vitest";
import {
  applyDocumentTransaction,
  createDocumentSnapshot,
} from "@rodkisten/maquina/document";
import { MaquinaHistory } from "@rodkisten/maquina/history";
import { diffInputValue } from "@rodkisten/maquina/input";
import { getVisibleLineRange } from "@rodkisten/maquina/viewport";

describe("Maquina document model", () => {
  it("applies transactions without using the DOM as source of truth", () => {
    const initial = createDocumentSnapshot("const x = 1");
    const result = applyDocumentTransaction(initial, {
      changes: [{ from: 10, to: 11, insert: "2" }],
      selection: { anchor: 11, head: 11 },
      origin: "input",
    });

    expect(result.snapshot.value).toBe("const x = 2");
    expect(result.snapshot.selection).toEqual({
      anchor: 11,
      head: 11,
    });
    expect(result.snapshot.version).toBe(1);
  });

  it("produces an inverse transaction for undo", () => {
    const initial = createDocumentSnapshot("hello");
    const changed = applyDocumentTransaction(initial, {
      changes: [{ from: 0, to: 5, insert: "world" }],
    });
    const restored = applyDocumentTransaction(
      changed.snapshot,
      changed.inverse,
    );

    expect(restored.snapshot.value).toBe("hello");
  });

  it("rejects overlapping changes", () => {
    const initial = createDocumentSnapshot("abcdef");

    expect(() => applyDocumentTransaction(initial, {
      changes: [
        { from: 1, to: 4, insert: "x" },
        { from: 3, to: 5, insert: "y" },
      ],
    })).toThrow(/cannot overlap/);
  });
});

describe("Maquina input controller", () => {
  it("reduces a textarea update to the smallest contiguous change", () => {
    const diff = diffInputValue(
      "const value = 1;",
      "const value = 20;",
      { anchor: 16, head: 16 },
    );

    expect(diff.changes).toEqual([{ from: 14, to: 15, insert: "20" }]);
  });
});

describe("Maquina history", () => {
  it("moves entries between undo and redo stacks", () => {
    const history = new MaquinaHistory();
    const entry = {
      undo: { changes: [{ from: 0, to: 1, insert: "a" }] },
      redo: { changes: [{ from: 0, to: 1, insert: "b" }] },
    };

    history.push(entry);
    expect(history.canUndo).toBe(true);
    expect(history.takeUndo()).toBe(entry);
    expect(history.canRedo).toBe(true);
    expect(history.takeRedo()).toBe(entry);
  });
});

describe("Maquina viewport", () => {
  it("returns only the visible line window plus overscan", () => {
    const value = Array.from(
      { length: 1_000 },
      (_, index) => `line ${index}`,
    ).join("\n");
    const range = getVisibleLineRange(value, 5_000, 500, 20, 5);

    expect(range.fromLine).toBe(245);
    expect(range.toLine).toBe(281);
    expect(value.slice(range.from, range.to)).toContain("line 250");
    expect(value.slice(range.from, range.to)).not.toContain("line 900");
  });
});
