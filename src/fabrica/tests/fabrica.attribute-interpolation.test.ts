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

describe("Fabrica compound attribute interpolation", () => {
  it("combines every interpolation and static segment in DOM attributes", () => {
    render(host, html`
      <button
        class="${"ra-button"} ${"ra-button-neutral"}"
        title="Open ${"Elements"} panel"
        aria-label="${"Open"} ${"Elements"}"
      >Elements</button>
    `);

    const button = host.querySelector("button");
    expect(button?.className).toBe("ra-button ra-button-neutral");
    expect(button?.title).toBe("Open Elements panel");
    expect(button?.getAttribute("aria-label")).toBe("Open Elements");
    expect(host.innerHTML).not.toContain("__fabrica_attr_");
    expect(host.innerHTML).not.toContain("fabrica_attr_name_end");
  });

  it("updates compound attributes when any segment is reactive", () => {
    const tone = signal("neutral");
    const label = signal("Elements");

    render(host, html`
      <button
        class="ra-button ra-button-${tone}"
        title="Open ${label} panel"
      ></button>
    `);

    const button = host.querySelector("button");
    expect(button?.className).toBe("ra-button ra-button-neutral");
    expect(button?.title).toBe("Open Elements panel");

    tone.set("primary");
    label.set("Settings");
    flushSync();

    expect(button?.className).toBe("ra-button ra-button-primary");
    expect(button?.title).toBe("Open Settings panel");
  });

  it("preserves exact single-value component props without stringifying objects or fragments", () => {
    const received = vi.fn();
    const payload = { id: 42 };
    const icon = html`<svg data-icon="refresh"></svg>`;

    const Probe = component<{ payload: object; icon: RenderValue }>("RawPropProbe", (props) => {
      received(props);
      return html`<div>${props.icon}</div>`;
    });

    render(host, html`<${Probe} payload=${payload} icon=${icon} />`);

    const props = received.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(props.payload).toBe(payload);
    expect(props.icon).toBe(icon);
    expect(props.children).toBeUndefined();
    expect(host.querySelector("svg")?.getAttribute("data-icon")).toBe("refresh");
  });

  it("renders nested toolbar components with string labels instead of phantom DocumentFragments", () => {
    const buttonProps = vi.fn();

    const Button = component<{
      icon?: RenderValue;
      label?: string;
      className?: string;
      onClick?: (event: MouseEvent) => void;
    }>("AlertButton", (props) => {
      buttonProps(props);
      return html`
        <button
          class=${props.className}
          title=${props.label}
          aria-label=${props.label}
          @click=${props.onClick}
        >
          ${props.icon}
          ${props.label && html`<span class="ra-button-label">${props.label}</span>`}
        </button>
      `;
    });

    const ToolbarButton = component<{
      icon?: RenderValue;
      label: string;
      onClick?: (event: MouseEvent) => void;
      tone?: string;
    }>("AlertToolbarButton", (props) => html`
      <${Button}
        icon=${props.icon}
        label=${props.label}
        onClick=${props.onClick}
        className="ra-button ra-button-${props.tone || "neutral"} ra-button-md"
      />
    `);

    const onClick = vi.fn();
    render(host, html`
      <nav>
        <${ToolbarButton}
          icon=${html`<svg data-icon="refresh"></svg>`}
          label="Refresh"
          onClick=${onClick}
        />
        <${ToolbarButton}
          icon=${html`<svg data-icon="picker"></svg>`}
          label="Pick"
          tone="primary"
        />
      </nav>
    `);

    const buttons = host.querySelectorAll("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.className).toBe("ra-button ra-button-neutral ra-button-md");
    expect(buttons[0]?.title).toBe("Refresh");
    expect(buttons[0]?.getAttribute("aria-label")).toBe("Refresh");
    expect(buttons[0]?.querySelector(".ra-button-label")?.textContent).toBe("Refresh");
    expect(buttons[1]?.className).toBe("ra-button ra-button-primary ra-button-md");
    expect(buttons[1]?.title).toBe("Pick");
    expect(buttons[1]?.querySelector(".ra-button-label")?.textContent).toBe("Pick");

    const receivedProps = buttonProps.mock.calls.map((call) => call[0] as Record<string, unknown>);
    const refreshProps = receivedProps.find((props) => props.label === "Refresh");
    const pickProps = receivedProps.find((props) => props.label === "Pick");
    expect(refreshProps?.label).toBe("Refresh");
    expect(pickProps?.label).toBe("Pick");
    expect(refreshProps?.children).toBeUndefined();
    expect(pickProps?.children).toBeUndefined();
    expect(refreshProps?.label).not.toBeInstanceOf(DocumentFragment);
    expect(host.innerHTML).not.toContain("[object DocumentFragment]");
    expect(host.innerHTML).not.toContain("__fabrica_attr_");

    buttons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not pass a marker-only fragment as children when a conditional child is false", () => {
    const received = vi.fn();
    const Probe = component("ConditionalChildrenProbe", (props) => {
      received(props.children);
      return html`<div>ready</div>`;
    });

    render(host, html`
      <${Probe}>
        ${false && html`<span>hidden</span>`}
      </${Probe}>
    `);

    expect(received).toHaveBeenCalledWith(undefined);
    expect(host.querySelector("span")).toBeNull();
  });
});
