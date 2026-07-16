/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDebugRecords,
  debug,
  debugRecords,
  html,
  render,
  setDebug,
  subscribeDebug,
} from "@rodkisten/fabrica";
import type { DebugRecord } from "@rodkisten/fabrica";

describe("Fábrica automatic event delegation", () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    document.body.replaceChildren();
    host = document.createElement("div");
    document.body.append(host);
    clearDebugRecords();
    setDebug(false);
  });

  afterEach(() => {
    setDebug(false);
    vi.restoreAllMocks();
  });

  it("delegates bubbling template events through one transient tree root instead of each element", () => {
    const elementListenerSpy = vi.spyOn(Element.prototype, "addEventListener");
    const first = vi.fn();
    const second = vi.fn();

    render(
      host,
      html`
        <section>
          <button class="first" @click=${first}>First</button>
          <button class="second" @click=${second}>Second</button>
        </section>
      `,
    );

    const clickCallIndexes = elementListenerSpy.mock.calls
      .map(([eventName], index) => eventName === "click" ? index : -1)
      .filter((index) => index >= 0);
    expect(clickCallIndexes).toHaveLength(1);
    expect((elementListenerSpy.mock.instances[clickCallIndexes[0]!] as Element).tagName).toBe("SECTION");

    host.querySelector<HTMLButtonElement>(".first")?.click();
    host.querySelector<HTMLButtonElement>(".second")?.click();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("preserves bubbling order, modifiers, this, and delegated currentTarget", () => {
    const calls: string[] = [];
    let capturedEvent: MouseEvent | null = null;
    const outer = vi.fn(function (this: Element, event: MouseEvent) {
      calls.push(`outer:${this.tagName}:${(event.currentTarget as Element).tagName}`);
    });
    const inner = vi.fn(function (this: Element, event: MouseEvent) {
      capturedEvent = event;
      calls.push(`inner:${this.tagName}:${(event.currentTarget as Element).tagName}`);
      expect(event.defaultPrevented).toBe(true);
    });

    render(
      host,
      html`<div @click=${outer}><button @click.prevent.stop=${inner}>Hit</button></div>`,
    );

    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    host.querySelector("button")?.dispatchEvent(event);

    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
    expect(calls).toEqual(["inner:BUTTON:BUTTON"]);
    expect(event.defaultPrevented).toBe(true);
    expect(capturedEvent?.currentTarget).toBeNull();
  });

  it("implements once in the delegated registry after transient-root migration", () => {
    const handler = vi.fn();
    const elementListenerSpy = vi.spyOn(Element.prototype, "addEventListener");
    const elementRemoveListenerSpy = vi.spyOn(Element.prototype, "removeEventListener");

    render(host, html`<button @click.once=${handler}>Once</button>`);
    const button = host.querySelector<HTMLButtonElement>("button")!;

    button.click();
    button.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(
      elementListenerSpy.mock.calls.filter(([eventName]) => eventName === "click"),
    ).toHaveLength(1);
    expect(
      elementRemoveListenerSpy.mock.calls.filter(([eventName]) => eventName === "click"),
    ).toHaveLength(1);
  });

  it("uses direct listeners when explicit or required by event semantics", () => {
    const elementListenerSpy = vi.spyOn(Element.prototype, "addEventListener");
    const direct = vi.fn();
    const capture = vi.fn();
    const focus = vi.fn();

    render(
      host,
      html`
        <button @click.direct=${direct}>Direct</button>
        <button @click.capture=${capture}>Capture</button>
        <input @focus=${focus} />
      `,
    );

    const boundNames = elementListenerSpy.mock.calls.map(([eventName]) => eventName);
    expect(boundNames).toContain("click");
    expect(boundNames).toContain("focus");

    host.querySelector<HTMLButtonElement>("button")?.click();
    expect(direct).toHaveBeenCalledTimes(1);
  });

  it("reconnects delegated listeners when a detached template is rendered into a ShadowRoot", () => {
    const shadowHost = document.createElement("div");
    document.body.append(shadowHost);
    const shadow = shadowHost.attachShadow({ mode: "open" });
    const handler = vi.fn();

    render(shadow, html`<button @fabrica-test=${handler}>Shadow</button>`);
    shadow.querySelector("button")?.dispatchEvent(
      new Event("fabrica-test", { bubbles: true, composed: false }),
    );

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("routes onClick and on maps through the same delegated runtime", () => {
    const elementListenerSpy = vi.spyOn(Element.prototype, "addEventListener");
    const elementRemoveListenerSpy = vi.spyOn(Element.prototype, "removeEventListener");
    const onClick = vi.fn();
    const onMapClick = vi.fn();

    render(
      host,
      html`
        <section>
          <button class="on-click" ...${{ onClick }}>onClick</button>
          <button class="on-map" ...${{ on: { click: onMapClick } }}>on map</button>
        </section>
      `,
    );

    host.querySelector<HTMLButtonElement>(".on-click")?.click();
    host.querySelector<HTMLButtonElement>(".on-map")?.click();

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onMapClick).toHaveBeenCalledTimes(1);
    expect(
      elementListenerSpy.mock.calls.filter(([eventName]) => eventName === "click"),
    ).toHaveLength(1);
    expect(
      elementRemoveListenerSpy.mock.calls.filter(([eventName]) => eventName === "click"),
    ).toHaveLength(1);
  });

  it("emits bounded event telemetry only while debug mode is enabled", () => {
    const streamed: DebugRecord[] = [];
    const unsubscribe = subscribeDebug((record) => streamed.push(record));
    const handler = vi.fn();

    setDebug(true);
    render(host, html`<button id="debug-button" @click=${handler}>Debug</button>`);
    host.querySelector<HTMLButtonElement>("button")?.click();
    setDebug(false);
    host.querySelector<HTMLButtonElement>("button")?.click();
    unsubscribe();

    const records = debugRecords();
    expect(records.some((record) => record.kind === "event-binding" && record.mode === "delegated")).toBe(true);
    expect(records.some((record) => record.kind === "event-dispatch" && record.eventName === "click")).toBe(true);
    expect(records.some((record) => record.kind === "event-handler" && record.currentTarget === "button#debug-button")).toBe(true);
    expect(streamed).toEqual(records);
    expect(debug().eventHandlerCalls).toBeGreaterThanOrEqual(2);
  });
});
