import { effect, flushSync } from "@rodkisten/broto";
import { describe, expect, it } from "vitest";
import { createDocumentSnapshot } from "@rodkisten/maquina/document";
import { createMaquinaEditorState } from "@rodkisten/maquina/editor-state";

describe("Maquina editor state", () => {
  it("publishes complete document snapshots through Broto", () => {
    const state = createState("abc");
    const snapshots: Array<[string, number, number]> = [];
    const dispose = effect(() => {
      snapshots.push([
        state.value(),
        state.selection().anchor,
        state.version(),
      ]);
    });

    state.setDocument(createDocumentSnapshot(
      "abcd",
      { anchor: 4, head: 4 },
      1,
    ));
    flushSync();

    expect(snapshots).toEqual([
      ["abc", 3, 0],
      ["abcd", 4, 1],
    ]);

    dispose();
  });

  it("keeps selection updates isolated from document text observers", () => {
    const state = createState("abc");
    let valueRuns = 0;
    const dispose = effect(() => {
      state.value();
      valueRuns += 1;
    });

    state.setDocument(createDocumentSnapshot(
      "abc",
      { anchor: 1, head: 1 },
      1,
    ));
    flushSync();

    expect(valueRuns).toBe(1);
    expect(state.selection.peek()).toEqual({
      anchor: 1,
      head: 1,
    });
    expect(state.version.peek()).toBe(1);

    dispose();
  });

  it("keeps completion state independent from document state", () => {
    const state = createState("const value = 1");
    const documentState = state.getDocument();

    state.patchCompletion({
      suggestions: [{ label: "value", type: "variable" }],
      suggestionFrom: 6,
      activeSuggestion: 0,
      open: true,
    });

    expect(state.open.peek()).toBe(true);
    expect(state.suggestions.peek()).toEqual([
      { label: "value", type: "variable" },
    ]);
    expect(state.suggestionFrom.peek()).toBe(6);
    expect(state.getDocument()).toEqual(documentState);
  });

  it("does not publish identical viewport measurements", () => {
    const state = createState("abc");
    let viewportRuns = 0;
    const dispose = effect(() => {
      state.viewport();
      viewportRuns += 1;
    });

    state.setViewport({
      scrollTop: 0,
      scrollLeft: 0,
      width: 0,
      height: 0,
    });
    flushSync();

    expect(viewportRuns).toBe(1);

    state.setViewport({
      scrollTop: 48,
      scrollLeft: 12,
      width: 320,
      height: 480,
    });
    flushSync();

    expect(viewportRuns).toBe(2);
    expect(state.viewport.peek()).toEqual({
      scrollTop: 48,
      scrollLeft: 12,
      width: 320,
      height: 480,
    });

    dispose();
  });
});

function createState(value: string) {
  return createMaquinaEditorState({
    document: createDocumentSnapshot(value),
    language: "javascript",
    theme: "obsidian",
  });
}
