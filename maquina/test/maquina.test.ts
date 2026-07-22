/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from "vitest";
import {
  MaquinaGutter,
  MaquinaLineNumbers,
} from "@rodkisten/maquina/components";
import { mountMaquina } from "@rodkisten/maquina/editor";
import { tokenizeMaquina } from "@rodkisten/maquina/tokenizer";

function createParent(): HTMLDivElement {
  const parent = document.createElement("div");
  document.body.append(parent);
  return parent;
}

describe("Maquina", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("mounts, edits and destroys without external editor dependencies", () => {
    const parent = createParent();
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

  it("keeps the native caret in layout space while visually scaling", () => {
    const parent = createParent();
    const value = "const x = 1;\nconsole.log(x);";

    mountMaquina({
      parent,
      value,
      fontSize: 12,
    });

    const root = parent.firstElementChild as HTMLElement;
    const textarea = parent.querySelector("textarea")!;

    expect(getComputedStyle(textarea).fontSize).toBe("16px");
    expect(root.style.transform).toBe("");
    expect(root.style.getPropertyValue("zoom")).toBe("0.75");
    expect(textarea.selectionStart).toBe(value.length);
    expect(textarea.selectionEnd).toBe(value.length);
  });

  it("renders a CodeMirror-style non-selectable line-number gutter", () => {
    const parent = createParent();

    mountMaquina({
      parent,
      value: "first\nsecond\nthird",
      lineNumbers: true,
    });

    const gutter = parent.querySelector<HTMLElement>(
      "[data-maquina-gutter]",
    )!;
    const numbers = Array.from(
      parent.querySelectorAll<HTMLElement>("[data-maquina-line-number]"),
    );

    const gutterCss = MaquinaGutter.artifacts
      .map((artifact) => artifact.compiledCss)
      .join("\n");
    const lineNumberCss = MaquinaLineNumbers.artifacts
      .map((artifact) => artifact.compiledCss)
      .join("\n");

    expect(gutter.getAttribute("aria-hidden")).toBe("true");
    expect(gutter.dataset.enabled).toBe("true");
    expect(gutterCss).toContain("pointer-events:none");
    expect(gutterCss).toContain("user-select:none");
    expect(lineNumberCss).toContain("user-select:none");
    expect(numbers.map((number) => number.textContent?.trim())).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(numbers.every((number) => number.style.height !== "")).toBe(true);
  });

  it(
    "enables line numbers by default and allows explicitly disabling them",
    () => {
      const defaultParent = createParent();
      mountMaquina({
        parent: defaultParent,
        value: "one\ntwo",
      });

      expect(
        defaultParent.querySelectorAll("[data-maquina-line-number]"),
      ).toHaveLength(2);

      const disabledParent = createParent();
      mountMaquina({
        parent: disabledParent,
        value: "one\ntwo",
        lineNumbers: false,
      });

      const disabledGutter = disabledParent.querySelector<HTMLElement>(
        "[data-maquina-gutter]",
      )!;
      const disabledRoot = disabledParent.firstElementChild as HTMLElement;

      expect(disabledGutter.dataset.enabled).toBe("false");
      expect(
        disabledParent.querySelectorAll("[data-maquina-line-number]"),
      ).toHaveLength(0);
      expect(
        disabledRoot.style.getPropertyValue("--maq-gutter-width"),
      ).toBe("0px");
    },
  );

  it(
    "keeps line numbers vertically synced while code scrolls both axes",
    () => {
      const parent = createParent();

      mountMaquina({
        parent,
        value: "one\ntwo\nthree",
        lineNumbers: true,
        lineWrapping: false,
      });

      const textarea = parent.querySelector("textarea")!;
      const codeLine = parent.querySelector<HTMLElement>(
        "[data-maquina-code-line]",
      )!;
      const numberLine = parent.querySelector<HTMLElement>(
        "[data-maquina-line-number]",
      )!;
      const highlight = codeLine.parentElement as HTMLElement;
      const lineNumbers = numberLine.parentElement as HTMLElement;

      textarea.scrollLeft = 24;
      textarea.scrollTop = 40;
      textarea.dispatchEvent(new Event("scroll", { bubbles: true }));

      expect(highlight.style.transform).toBe("translate(-24px, -40px)");
      expect(lineNumbers.style.transform).toBe("translateY(-40px)");
    },
  );

  it("tokenizes supported languages", () => {
    expect(
      tokenizeMaquina("const x = 'a'", "javascript").some(
        (token) => token.kind === "keyword",
      ),
    ).toBe(true);
    expect(
      tokenizeMaquina('<main id="x">', "html").some(
        (token) => token.kind === "tag",
      ),
    ).toBe(true);
    expect(
      tokenizeMaquina(".x{color:red}", "css").some(
        (token) => token.kind === "tag",
      ),
    ).toBe(true);
  });

  it("provides a CodeMirror-compatible completion context shape", async () => {
    const parent = createParent();
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
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();

    expect(seen).toBe("doc");
  });
});
