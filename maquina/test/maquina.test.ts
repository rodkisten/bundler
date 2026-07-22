/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from "vitest";
import { mountMaquina } from "@rodkisten/maquina/editor";
import { tokenizeMaquina } from "@rodkisten/maquina/tokenizer";

describe("Maquina", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("mounts, edits and destroys without external editor dependencies", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const changes: string[] = [];
    const editor = mountMaquina({
      parent,
      value: "const x = 1",
      language: "javascript",
      onChange: (value) => changes.push(value),
    });

    expect(editor.getValue()).toBe("const x = 1");
    editor.setValue("const x = 2");
    expect(editor.getValue()).toBe("const x = 2");
    editor.destroy();
    expect(parent.childNodes).toHaveLength(0);
  });

  it("dispatches transactions and supports undo and redo", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const editor = mountMaquina({ parent, value: "abc" });

    editor.dispatch({
      changes: [{ from: 1, to: 2, insert: "X" }],
      selection: { anchor: 2, head: 2 },
      origin: "api",
    });

    expect(editor.getValue()).toBe("aXc");
    expect(editor.getState().selection).toEqual({
      anchor: 2,
      head: 2,
    });
    expect(editor.undo()).toBe(true);
    expect(editor.getValue()).toBe("abc");
    expect(editor.redo()).toBe(true);
    expect(editor.getValue()).toBe("aXc");
  });

  it("keeps the actual textarea font at 16px while scaling the editor", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    mountMaquina({ parent, value: "x", fontSize: 12 });
    const textarea = parent.querySelector("textarea")!;

    expect(getComputedStyle(textarea).fontSize).toBe("16px");
    expect(
      (parent.firstElementChild as HTMLElement).style.transform,
    ).toContain("scale(0.75)");
  });

  it("tokenizes supported languages", () => {
    const javascriptTokens = tokenizeMaquina(
      "const x = 'a'",
      "javascript",
    );
    const htmlTokens = tokenizeMaquina(
      '<main id="x">',
      "html",
    );
    const cssTokens = tokenizeMaquina(
      ".x{color:red}",
      "css",
    );

    expect(
      javascriptTokens.some((token) => token.kind === "keyword"),
    ).toBe(true);
    expect(
      htmlTokens.some((token) => token.kind === "tag"),
    ).toBe(true);
    expect(
      cssTokens.some((token) => token.kind === "tag"),
    ).toBe(true);
  });

  it("provides a CodeMirror-compatible completion context shape", async () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    let seen = "";

    mountMaquina({
      parent,
      value: "doc",
      activateCompletionOnTyping: true,
      completions(context) {
        seen = context.matchBefore(/[$\w.]+$/)?.text ?? "";

        return {
          from: 0,
          options: [{ label: "document" }],
        };
      },
    });

    const textarea = parent.querySelector("textarea")!;
    textarea.setSelectionRange(
      textarea.value.length,
      textarea.value.length,
    );
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();

    expect(seen).toBe("doc");
  });
});
