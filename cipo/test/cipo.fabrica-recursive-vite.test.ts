import { describe, expect, it } from "vitest";
import { cipoVite } from "@rodkisten/cipo/vite";

describe("Cipó Vite + recursive Fábrica compilation", () => {
  it("removes nested html runtime islands from DevTools-style component views", async () => {
    const plugin = cipoVite({
      root: "/project",
      mode: "build",
      compileFabrica: true,
    });
    const context = { emitFile: () => "asset" } as never;
    const source = [
      "const view = html`",
      "  <RodElementsStylesView>",
      "    ${props.rules.map((rule) => html`",
      "      <RodElementsStyleRule>",
      "        ${rule.source ? html`<RodElementsStyleSource>${rule.source}</RodElementsStyleSource>` : \"\"}",
      "      </RodElementsStyleRule>",
      "    `)}",
      "  </RodElementsStylesView>",
      "`;",
    ].join("\n");

    const transformed = await plugin.transform?.call(
      context,
      source,
      "/project/src/devtools/panels/elements.components.ts",
    );
    const code = transformed && "code" in transformed ? transformed.code : "";

    expect(code).toContain("createCompiledTemplate");
    expect(code).toContain("RodElementsStylesView");
    expect(code).toContain("RodElementsStyleRule");
    expect(code).toContain("RodElementsStyleSource");
    expect(code).not.toMatch(/\bhtml`/);
    expect(code).not.toContain("<RodElementsStyleRule>");
  });
});
