/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import {
  component,
  createContextProvider,
  createReactiveFabricaContext,
  createRequiredFabricaContext,
  html,
  render,
} from "../index";

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
});
