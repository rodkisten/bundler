/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import {
  component,
  createContextProvider,
  createFabricaContext,
  createReactiveFabricaContext,
  createRequiredFabricaContext,
  signal,
  useRequiredContext,
  html,
  render,
} from "@rodkisten/fabrica";

describe("Fábrica context architecture", () => {
  beforeEach(() => document.body.replaceChildren());

  it("supports portable provider components and required consumers", () => {
    const Theme = createRequiredFabricaContext<string>("Theme");
    const ThemeProvider = createContextProvider(Theme, "ThemeProvider");
    ThemeProvider.register();

    const Consumer = component("ContextConsumer", (_props, ctx) => html`
      <span>${ctx.requireContext(Theme)}</span>
    `);

    const dispose = render(document.body, html`
      <ThemeProvider .value=${"forest"}>
        <ContextConsumer />
      </ThemeProvider>
    `);

    expect(document.body.textContent).toBe("forest");
    dispose();
  });

  it("makes reactive context signals available from component context", () => {
    const Density = createReactiveFabricaContext("comfortable", "Density");

    const Provider = component("DensityProvider", (props, ctx) => {
      const density = ctx.provideReactiveContext(Density, "compact");
      density.set("comfortable");
      return props.children ?? null;
    });

    const Consumer = component("DensityConsumer", (_props, ctx) => {
      const density = ctx.requireReactiveContext(Density);
      return html`<span>${density()}</span>`;
    });

    const dispose = render(document.body, html`
      <DensityProvider><DensityConsumer /></DensityProvider>
    `);

    expect(document.body.textContent).toBe("comfortable");
    dispose();
  });

  it("exposes Context.Provider and preserves store identity", () => {
    const store = {
      expanded: signal(false),
      label: signal("closed"),
    };
    const DevTools = createFabricaContext<typeof store | null>(null, "DevTools");
    let consumed: typeof store | null = null;

    const Consumer = component("StoreContextConsumer", (_props, ctx) => {
      consumed = ctx.useRequiredContext(DevTools);
      return html`<span :expanded=${consumed.expanded}>${consumed.label}</span>`;
    });

    const dispose = render(document.body, html`
      <${DevTools.Provider} .value=${store}>
        <StoreContextConsumer />
      </${DevTools.Provider}>
    `);

    const span = document.querySelector("span");
    expect(consumed).toBe(store);
    expect(span?.getAttribute("data-expanded")).toBe("false");
    expect(span?.textContent).toBe("closed");

    store.expanded.set(true);
    store.label.set("open");

    expect(span?.getAttribute("data-expanded")).toBe("true");
    expect(span?.textContent).toBe("open");
    expect(consumed).toBe(store);
    dispose();
  });

  it("preserves signals placed in ordinary contexts", () => {
    const selected = signal("console");
    const Selection = createRequiredFabricaContext<typeof selected>("Selection");
    let received: typeof selected | null = null;

    const Consumer = component("SignalContextConsumer", (_props, ctx) => {
      received = ctx.useRequiredContext(Selection);
      return html`<span>${received}</span>`;
    });

    const dispose = render(document.body, html`
      <${Selection.Provider} .value=${selected}>
        <SignalContextConsumer />
      </${Selection.Provider}>
    `);

    expect(received).toBe(selected);
    expect(document.body.textContent).toBe("console");
    selected.set("network");
    expect(document.body.textContent).toBe("network");
    dispose();
  });

  it("offers useRequiredContext as the strict context helper", () => {
    const Missing = createRequiredFabricaContext<string>("MissingService");
    expect(() => useRequiredContext(Missing)).toThrow(
      'Missing provider for required context "MissingService"',
    );
  });

});
