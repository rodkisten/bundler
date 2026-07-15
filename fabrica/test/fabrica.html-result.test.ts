/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FABRICA_HTML_ARTIFACT,
  createCompiledTemplate,
  createFabrica,
  getHtmlArtifact,
  html,
  isHtmlResult,
  render,
} from "@rodkisten/fabrica";

let host: HTMLDivElement;

beforeEach(() => {
  document.body.replaceChildren();
  host = document.createElement("div");
  document.body.append(host);
});


describe("Fábrica polymorphic html results", () => {
  it("returns the real root Element for a single-root template", () => {
    const view = html`<button type="button">Save</button>`;

    expect(view).toBeInstanceOf(HTMLButtonElement);
    expect((view as HTMLButtonElement).type).toBe("button");
    expect(view.textContent).toBe("Save");
    expect(isHtmlResult(view)).toBe(true);
  });

  it("keeps DocumentFragment for multiple roots", () => {
    const view = html`<span>A</span><span>B</span>`;

    expect(view).toBeInstanceOf(DocumentFragment);
    expect(view.childNodes).toHaveLength(2);
    expect(view.textContent).toBe("AB");
    expect(isHtmlResult(view)).toBe(true);
  });

  it("attaches a non-enumerable artifact that materializes fresh DOM", () => {
    const click = vi.fn();
    const view = html`<button @click=${click}>Run</button>`;
    const artifact = html.artifact(view);

    expect(artifact).toBe(getHtmlArtifact(view));

    expect(artifact?.kind).toBe("fabrica.html");
    expect(artifact?.jsx).toBe(false);
    expect(Object.keys(view)).not.toContain(String(FABRICA_HTML_ARTIFACT));
    expect(Object.getOwnPropertyDescriptor(view, FABRICA_HTML_ARTIFACT)?.enumerable).toBe(false);

    const clone = artifact?.materialize();
    expect(clone).toBeInstanceOf(HTMLButtonElement);
    expect(clone).not.toBe(view);
    expect(clone?.textContent).toBe("Run");

    (view as HTMLButtonElement).click();
    (clone as HTMLButtonElement).click();
    expect(click).toHaveBeenCalledTimes(2);
  });

  it("exposes artifact helpers on isolated instance html tags", () => {
    const fabrica = createFabrica({ name: "artifact-test", isolated: true });
    const view = fabrica.html`<article>Instance</article>`;

    expect(view).toBeInstanceOf(HTMLElement);
    expect(fabrica.html.isResult(view)).toBe(true);
    expect(fabrica.html.artifact(view)?.materialize()).toBeInstanceOf(HTMLElement);
  });

  it("preserves the originating instance registry when materializing again", () => {
    const fabrica = createFabrica({ name: "artifact-registry", isolated: true });
    fabrica.component("LocalBadge", () => fabrica.html`<strong>Local</strong>`);

    const view = fabrica.html`<LocalBadge />`;
    const clone = fabrica.html.artifact(view)?.materialize();

    render(host, clone!);
    expect(host.querySelector("strong")?.textContent).toBe("Local");
  });

  it("keeps compiled templates polymorphic and artifact-backed", () => {
    const view = createCompiledTemplate(["<section>", "</section>"] as unknown as TemplateStringsArray, "Compiled");

    expect(view).toBeInstanceOf(HTMLElement);
    expect(view.textContent).toBe("Compiled");
    expect(isHtmlResult(view)).toBe(true);
    expect(getHtmlArtifact(view)?.materialize()).toBeInstanceOf(HTMLElement);
  });

  it("renders and disposes a single-root html result through the direct root path", () => {
    const click = vi.fn();
    const dispose = render(host, html`<button @click=${click}>Direct</button>`);

    const button = host.querySelector("button");
    expect(button).toBeInstanceOf(HTMLButtonElement);
    button?.click();
    expect(click).toHaveBeenCalledTimes(1);

    dispose();
    expect(host.childNodes).toHaveLength(0);
  });
  it("prunes indentation whitespace in runtime and compiled templates", () => {
    const runtimeView = html`
      <section>
        <span>A</span>
        <span>B</span>
      </section>
    ` as HTMLElement;
    expect(Array.from(runtimeView.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE)).toHaveLength(0);

    const compiledView = createCompiledTemplate({
      nodes: [{
        type: "element",
        tag: "section",
        props: [],
        children: [
          { type: "text", value: "\n  " },
          { type: "element", tag: "span", props: [], children: [{ type: "text", value: "A" }] },
          { type: "text", value: "\n  " },
          { type: "element", tag: "span", props: [], children: [{ type: "text", value: "B" }] },
          { type: "text", value: "\n" },
        ],
      }],
    });
    const section = compiledView as HTMLElement;
    expect(Array.from(section.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE)).toHaveLength(0);
  });


  it("materializes compact tuple instructions emitted by the production compiler", () => {
    const compactView = createCompiledTemplate([
      [0, "button", [[0, "type", "button"], [1, "class", 0]], [[1, "Compact"]]],
    ] as const, "primary");

    const button = compactView as HTMLButtonElement;
    expect(button.tagName).toBe("BUTTON");
    expect(button.type).toBe("button");
    expect(button.className).toBe("primary");
    expect(button.textContent).toBe("Compact");
  });

});
