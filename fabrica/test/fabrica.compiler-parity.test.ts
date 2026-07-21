/** @vitest-environment jsdom */

import { flushSync, signal } from "@rodkisten/broto/reactivity";
import {
  html,
  render,
  type RenderValue,
} from "@rodkisten/fabrica";
import {
  createCompiledTemplate,
} from "@rodkisten/fabrica/compiler-runtime";
import { describe, expect, it, vi } from "vitest";

const NODE_ELEMENT = 0 as const;
const PROP_VALUE = 1 as const;
const PROP_SPREAD = 3 as const;

function compiledElement(
  tag: string,
  propName: string,
  value: RenderValue,
): ReturnType<typeof createCompiledTemplate> {
  return createCompiledTemplate(
    [
      [
        NODE_ELEMENT,
        tag,
        [[PROP_VALUE, propName, 0]],
        [],
      ],
    ] as const,
    value,
  );
}

describe("Fábrica runtime/compiler semantic parity", () => {
  it("keeps native attributes reactive in both renderers", () => {
    const title = signal("first");
    const runtime = html`<button title=${title}>Runtime</button>`;
    const compiled = compiledElement("button", "title", title);

    expect((runtime as unknown as HTMLElement).getAttribute("title")).toBe("first");
    expect((compiled as unknown as HTMLElement).getAttribute("title")).toBe("first");

    title.set("second");
    flushSync();

    expect((runtime as unknown as HTMLElement).getAttribute("title")).toBe("second");
    expect((compiled as unknown as HTMLElement).getAttribute("title")).toBe("second");
  });

  it("keeps DOM property bindings reactive in both renderers", () => {
    const value = signal("alpha");
    const runtime = html`<input .value=${value}>` as unknown as HTMLInputElement;
    const compiled = compiledElement(
      "input",
      ".value",
      value,
    ) as unknown as HTMLInputElement;

    expect(runtime.value).toBe("alpha");
    expect(compiled.value).toBe("alpha");

    value.set("beta");
    flushSync();

    expect(runtime.value).toBe("beta");
    expect(compiled.value).toBe("beta");
  });

  it("keeps boolean bindings reactive in both renderers", () => {
    const disabled = signal(false);
    const runtime = html`
      <button ?disabled=${disabled}>Runtime</button>
    ` as unknown as HTMLButtonElement;
    const compiled = compiledElement(
      "button",
      "?disabled",
      disabled,
    ) as unknown as HTMLButtonElement;

    expect(runtime.disabled).toBe(false);
    expect(compiled.disabled).toBe(false);

    disabled.set(true);
    flushSync();

    expect(runtime.disabled).toBe(true);
    expect(compiled.disabled).toBe(true);
  });

  it("keeps conditional classes reactive in both renderers", () => {
    const active = signal(false);
    const runtime = html`
      <button class:active=${active}>Runtime</button>
    ` as unknown as HTMLButtonElement;
    const compiled = compiledElement(
      "button",
      "class:active",
      active,
    ) as unknown as HTMLButtonElement;

    active.set(true);
    flushSync();

    expect(runtime.classList.contains("active")).toBe(true);
    expect(compiled.classList.contains("active")).toBe(true);
  });

  it("reconciles reactive compiled spreads", () => {
    const props = signal<Record<string, unknown>>({
      attrs: { title: "first" },
      dataset: { testId: "one" },
      disabled: true,
    });
    const view = createCompiledTemplate(
      [
        [
          NODE_ELEMENT,
          "button",
          [[PROP_SPREAD, 0]],
          [],
        ],
      ] as const,
      props,
    ) as unknown as HTMLButtonElement;

    expect(view.title).toBe("first");
    expect(view.dataset.testId).toBe("one");
    expect(view.disabled).toBe(true);

    props.set({
      attrs: { "aria-label": "second" },
      dataset: { nextId: "two" },
    });
    flushSync();

    expect(view.hasAttribute("title")).toBe(false);
    expect(view.dataset.testId).toBeUndefined();
    expect(view.getAttribute("aria-label")).toBe("second");
    expect(view.dataset.nextId).toBe("two");
    expect(view.disabled).toBe(false);
  });

  it("runs callback-ref cleanup for compiled templates", () => {
    const host = document.createElement("div");
    const cleanup = vi.fn();
    const callback = vi.fn(() => cleanup);
    const dispose = render(
      host,
      compiledElement("button", "ref", callback),
    );

    expect(callback).toHaveBeenCalledTimes(1);
    dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("clears object refs when compiled nodes are disposed", () => {
    const host = document.createElement("div");
    const ref = { current: null as Element | null };
    const dispose = render(
      host,
      compiledElement("button", "ref", ref),
    );

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    dispose();
    expect(ref.current).toBeNull();
  });
});
