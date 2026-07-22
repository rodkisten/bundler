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

  it(
    "restores line numbers and updates them with the document",
    () => {
      const parent = document.createElement("div");
      document.body.append(parent);
      const editor = mountMaquina({
        parent,
        value: "one\ntwo\nthree",
      });

      expect(readLineNumbers(parent)).toEqual(["1", "2", "3"]);

      editor.setValue("one\ntwo\nthree\nfour");

      expect(readLineNumbers(parent)).toEqual(["1", "2", "3", "4"]);
    },
  );

  it("can explicitly disable the line-number gutter", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    mountMaquina({
      parent,
      value: "one\ntwo",
      lineNumbers: false,
    });

    const root = parent.firstElementChild as HTMLElement;

    expect(readLineNumbers(parent)).toEqual([]);
    expect(root.style.getPropertyValue("--maq-gutter-width")).toBe("0px");
  });

  it(
    "aligns textarea and highlight metrics without root scaling",
    () => {
      const parent = document.createElement("div");
      document.body.append(parent);
      mountMaquina({
        parent,
        value: "const x = 1",
        fontSize: 12,
      });

      const root = parent.firstElementChild as HTMLElement;
      const textarea = parent.querySelector("textarea")!;
      const highlight = parent.querySelector<HTMLElement>(
        "[aria-hidden='true']",
      )!;

      expect(root.style.transform).toBe("");
      expect(root.style.width).toBe("100%");
      expect(root.style.height).toBe("100%");
      expect(textarea.style.fontSize).toBe(highlight.style.fontSize);
      expect(textarea.style.fontSize).toBe("16px");
    },
  );

  it("keeps the textarea sized to the editor container", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    mountMaquina({ parent, value: "x" });

    const textarea = parent.querySelector("textarea")!;
    const root = parent.firstElementChild as HTMLElement;

    expect(root.style.width).toBe("100%");
    expect(root.style.height).toBe("100%");
    expect(textarea.getAttribute("role")).toBe("combobox");
  });

  it("renders touch-friendly accessible scope completions", async () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const value = "const localThing = 1;\nloc";

    mountMaquina({
      parent,
      value,
      language: "javascript",
    });

    const textarea = parent.querySelector("textarea")!;

    textarea.setSelectionRange(value.length, value.length);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();

    const listbox = parent.querySelector<HTMLElement>("[role='listbox']")!;
    const options = Array.from(
      listbox.querySelectorAll<HTMLElement>("[role='option']"),
    );

    expect(textarea.getAttribute("aria-expanded")).toBe("true");
    expect(options.some((option) => {
      return option.textContent?.includes("localThing");
    })).toBe(true);
    expect(options.every((option) => option.tagName === "DIV")).toBe(true);
  });

  it(
    "provides object members declared in the current source scope",
    async () => {
      const parent = document.createElement("div");
      document.body.append(parent);
      const value = [
        "const machine = {",
        "  name: 'Máquina',",
        "  write(message) { return message; },",
        "};",
        "machine.w",
      ].join("\n");

      mountMaquina({
        parent,
        value,
        language: "javascript",
      });

      const textarea = parent.querySelector("textarea")!;

      textarea.setSelectionRange(value.length, value.length);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();

      const optionLabels = Array.from(
        parent.querySelectorAll<HTMLElement>("[role='option'] > span"),
      ).map((node) => node.textContent);

      expect(optionLabels).toContain("write");
    },
  );

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

function readLineNumbers(parent: HTMLElement): string[] {
  return Array.from(
    parent.querySelectorAll<HTMLElement>("[data-maquina-line-number]"),
  ).map((node) => node.textContent ?? "");
}
