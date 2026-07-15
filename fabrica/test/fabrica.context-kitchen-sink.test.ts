/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  component,
  createContextProvider,
  createRequiredFabricaContext,
  flushSync,
  html,
  portal,
  render,
  signal,
} from "@rodkisten/fabrica";

describe("Fábrica context kitchen sink", () => {
  beforeEach(() => document.body.replaceChildren());

  it("preserves store identity and updates only bindings connected to changed signals", () => {
    const StoreContext = createRequiredFabricaContext<{
      count: ReturnType<typeof signal<number>>;
      label: ReturnType<typeof signal<string>>;
    }>("KitchenSinkStore");
    const StoreProvider = createContextProvider(StoreContext, "KitchenSinkStoreProvider");
    StoreProvider.register();

    const countReads = vi.fn();
    const labelReads = vi.fn();
    let consumedStore: ReturnType<typeof createStore> | null = null;

    function createStore() {
      return {
        count: signal(0),
        label: signal("forest"),
      };
    }

    const Consumer = component("KitchenSinkConsumer", (_props, ctx) => {
      const store = ctx.requireContext(StoreContext);
      consumedStore = store;

      return html`
        <output :count=${() => { countReads(); return store.count(); }}>
          ${() => { labelReads(); return store.label(); }}
        </output>
      `;
    });

    const store = createStore();
    const dispose = render(document.body, html`
      <KitchenSinkStoreProvider .value=${store}>
        <KitchenSinkConsumer />
      </KitchenSinkStoreProvider>
    `);

    expect(consumedStore).toBe(store);
    countReads.mockClear();
    labelReads.mockClear();

    store.count.set(1);
    flushSync();
    expect(document.querySelector("output")?.getAttribute("data-count")).toBe("1");
    expect(countReads).toHaveBeenCalled();
    expect(labelReads).not.toHaveBeenCalled();

    countReads.mockClear();
    store.label.set("canopy");
    flushSync();
    expect(document.querySelector("output")?.textContent?.trim()).toBe("canopy");
    expect(labelReads).toHaveBeenCalled();
    expect(countReads).not.toHaveBeenCalled();

    dispose();
  });

  it("supports nested providers and restores the nearest ancestor value", () => {
    const Theme = createRequiredFabricaContext<string>("KitchenSinkTheme");
    const ThemeProvider = createContextProvider(Theme, "KitchenSinkThemeProvider");
    ThemeProvider.register();

    const Consumer = component<{ id: string }>("KitchenSinkThemeConsumer", (props, ctx) =>
      html`<span id=${props.id}>${ctx.requireContext(Theme)}</span>`,
    );

    const dispose = render(document.body, html`
      <KitchenSinkThemeProvider .value=${"outer"}>
        <KitchenSinkThemeConsumer id="before" />
        <KitchenSinkThemeProvider .value=${"inner"}>
          <KitchenSinkThemeConsumer id="inside" />
        </KitchenSinkThemeProvider>
        <KitchenSinkThemeConsumer id="after" />
      </KitchenSinkThemeProvider>
    `);

    expect(document.querySelector("#before")?.textContent).toBe("outer");
    expect(document.querySelector("#inside")?.textContent).toBe("inner");
    expect(document.querySelector("#after")?.textContent).toBe("outer");
    dispose();
  });

  it("carries context through portals into a shadow root", () => {
    const Service = createRequiredFabricaContext<{ readonly name: string }>("KitchenSinkService");
    const ServiceProvider = createContextProvider(Service, "KitchenSinkServiceProvider");
    ServiceProvider.register();

    const host = document.createElement("div");
    const shadowRoot = host.attachShadow({ mode: "open" });
    document.body.append(host);

    const Consumer = component("KitchenSinkPortalConsumer", (_props, ctx) =>
      html`<strong>${ctx.requireContext(Service).name}</strong>`,
    );

    const service = Object.freeze({ name: "shadow-service" });
    const dispose = render(document.body, html`
      <KitchenSinkServiceProvider .value=${service}>
        ${portal(shadowRoot, Consumer())}
      </KitchenSinkServiceProvider>
    `);

    expect(shadowRoot.querySelector("strong")?.textContent).toBe("shadow-service");
    dispose();
    expect(shadowRoot.childNodes).toHaveLength(0);
  });

  it("disposes consumer effects and subscriptions with the component owner", () => {
    const Count = createRequiredFabricaContext<ReturnType<typeof signal<number>>>("KitchenSinkCount");
    const CountProvider = createContextProvider(Count, "KitchenSinkCountProvider");
    CountProvider.register();

    const cleanup = vi.fn();
    const runs = vi.fn();
    const count = signal(0);

    const Consumer = component("KitchenSinkCleanupConsumer", (_props, ctx) => {
      const value = ctx.requireContext(Count);
      ctx.effect((onCleanup) => {
        value();
        runs();
        onCleanup(cleanup);
      });
      return html`<span>${value}</span>`;
    });

    const dispose = render(document.body, html`
      <KitchenSinkCountProvider .value=${count}>
        <KitchenSinkCleanupConsumer />
      </KitchenSinkCountProvider>
    `);

    expect(runs).toHaveBeenCalledTimes(1);
    count.set(1);
    flushSync();
    expect(runs).toHaveBeenCalledTimes(2);

    dispose();
    const runsAfterDispose = runs.mock.calls.length;
    count.set(2);
    flushSync();

    expect(cleanup).toHaveBeenCalled();
    expect(runs).toHaveBeenCalledTimes(runsAfterDispose);
    expect(document.body.textContent).toBe("");
  });

  it("throws a descriptive error when a required context has no provider", () => {
    const Missing = createRequiredFabricaContext<string>("KitchenSinkMissing");
    const Consumer = component("KitchenSinkMissingConsumer", (_props, ctx) =>
      html`<span>${ctx.requireContext(Missing)}</span>`,
    );

    expect(() => render(document.body, html`<KitchenSinkMissingConsumer />`)).toThrow(
      /KitchenSinkMissing/,
    );
  });

  it("uses a new store reference after the provider tree is replaced", () => {
    const Store = createRequiredFabricaContext<{ id: string }>("KitchenSinkReplaceableStore");
    const Provider = createContextProvider(Store, "KitchenSinkReplaceableStoreProvider");
    Provider.register();
    const Consumer = component("KitchenSinkReplaceableConsumer", (_props, ctx) =>
      html`<span>${ctx.requireContext(Store).id}</span>`,
    );

    const firstDispose = render(document.body, html`
      <KitchenSinkReplaceableStoreProvider .value=${{ id: "first" }}>
        <KitchenSinkReplaceableConsumer />
      </KitchenSinkReplaceableStoreProvider>
    `);
    expect(document.body.textContent?.trim()).toBe("first");

    firstDispose();
    const secondDispose = render(document.body, html`
      <KitchenSinkReplaceableStoreProvider .value=${{ id: "second" }}>
        <KitchenSinkReplaceableConsumer />
      </KitchenSinkReplaceableStoreProvider>
    `);
    expect(document.body.textContent?.trim()).toBe("second");
    secondDispose();
  });
});
