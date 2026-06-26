/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync, signal } from "../../broto";
import { clearComponents, component, html, render } from "../index";
import type { RenderValue } from "../types";

let host: HTMLDivElement;

beforeEach(() => {
  document.body.replaceChildren();
  host = document.createElement("div");
  document.body.appendChild(host);
  clearComponents();
});

describe("Fabrica component rendering", () => {
  it("renders consecutive self-closing interpolated component tags without swallowing siblings", () => {
    const refresh = vi.fn();
    const pick = vi.fn();

    const ToolbarButton = component<{
      icon: RenderValue;
      label: string;
      onClick: (event: MouseEvent) => void;
    }>("ToolbarButton", (props) => html`
      <button type="button" aria-label=${props.label} @click=${props.onClick}>
        <span class="icon">${props.icon}</span>
        <span class="label">${props.label}</span>
      </button>
    `);

    render(host, html`
      <nav>
        <${ToolbarButton}
          icon=${html`<i>R</i>`}
          label="Refresh"
          onClick=${refresh}
        />
        <${ToolbarButton}
          icon=${html`<i>P</i>`}
          label="Pick"
          onClick=${pick}
        />
      </nav>
    `);

    const buttons = host.querySelectorAll("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.getAttribute("aria-label")).toBe("Refresh");
    expect(buttons[1]?.getAttribute("aria-label")).toBe("Pick");
    expect(buttons[0]?.textContent?.replace(/\s+/g, "").trim()).toBe("RRefresh");
    expect(buttons[1]?.textContent?.replace(/\s+/g, "").trim()).toBe("PPick");

    buttons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    buttons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(pick).toHaveBeenCalledTimes(1);
  });

  it("preserves camelCase dynamic component prop names through HTML parsing", () => {
    const received = vi.fn();
    const onPointerDown = vi.fn();
    const selected = document.createElement("section");

    const Probe = component<Record<string, unknown>>("Probe", (props) => {
      received(props);
      return html`<div data-probe="ready"></div>`;
    });

    render(host, html`
      <${Probe}
        selectedElement=${selected}
        showCodePanel=${true}
        onPointerDown=${onPointerDown}
      />
    `);

    expect(received).toHaveBeenCalledTimes(1);
    const props = received.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(props.selectedElement).toBe(selected);
    expect(props.showCodePanel).toBe(true);
    expect(props.onPointerDown).toBe(onPointerDown);
    expect(props).not.toHaveProperty("selectedelement");
    expect(props).not.toHaveProperty("showcodepanel");
    expect(props).not.toHaveProperty("onpointerdown");
  });

  it("does not pass an empty DocumentFragment as children for self-closing components", () => {
    const received = vi.fn();
    const Empty = component("Empty", (props) => {
      received(props.children);
      return html`<span>empty</span>`;
    });

    render(host, html`<${Empty} />`);

    expect(received).toHaveBeenCalledWith(undefined);
    expect(host.querySelector("span")?.textContent).toBe("empty");
  });

  it("passes real children for paired component tags", () => {
    const received = vi.fn();
    const Wrapper = component("Wrapper", (props) => {
      received(props.children);
      return html`<section>${props.children}</section>`;
    });

    render(host, html`<${Wrapper}><strong>child</strong></${Wrapper}>`);

    expect(received.mock.calls[0]?.[0]).toBeInstanceOf(DocumentFragment);
    expect(host.querySelector("strong")?.textContent).toBe("child");
  });

  it("renders React-like boolean-and component requests and ignores false branches", () => {
    const Panel = component<{ label?: string }>("Panel", (props) => html`<aside>${props.label || "Default"}</aside>`);

    render(host, html`
      ${false && Panel({ label: "Hidden" })}
      ${true && Panel({ label: "Visible" })}
    `);

    expect(host.querySelectorAll("aside")).toHaveLength(1);
    expect(host.querySelector("aside")?.textContent).toBe("Visible");
  });

  it("renders a bare component reference in a boolean-and expression", () => {
    const Panel = component("BarePanel", () => html`<aside>Bare</aside>`);

    render(host, html`${true && Panel}`);

    expect(host.querySelector("aside")?.textContent).toBe("Bare");
  });

  it("updates reactive boolean-and component expressions without a ternary", () => {
    const visible = signal(false);
    const Panel = component("ReactivePanel", () => html`<aside>Reactive</aside>`);

    render(host, html`${() => visible() && Panel()}`);
    expect(host.querySelector("aside")).toBeNull();

    visible.set(true);
    flushSync();
    expect(host.querySelector("aside")?.textContent).toBe("Reactive");

    visible.set(false);
    flushSync();
    expect(host.querySelector("aside")).toBeNull();
  });

  it("renders ternary branches containing self-closing component tags", () => {
    const codeZen = true;
    const selected = document.createElement("button");
    const CodePanel = component<{ selected: Element; zen: boolean }>("CodePanel", (props) => html`
      <section data-zen=${props.zen} data-selected=${props.selected.tagName}>Code</section>
    `);

    render(host, html`
      ${codeZen
        ? html`<${CodePanel} selected=${selected} zen=${true} />`
        : ""}
    `);

    const panel = host.querySelector("section");
    expect(panel?.getAttribute("data-zen")).toBe("true");
    expect(panel?.getAttribute("data-selected")).toBe("BUTTON");
    expect(panel?.textContent).toBe("Code");
  });
});
