import { describe, expect, it } from "vitest";
import { devtoolsCipoConfigCss } from "../cipo-config";

describe("DevTools Cipó build configuration", () => {
  it("keeps the readable CSS-first directives instead of compiled runtime CSS", () => {
    expect(devtoolsCipoConfigCss).toContain("@cipo");
    expect(devtoolsCipoConfigCss).toContain("@theme");
    expect(devtoolsCipoConfigCss).toContain("@breakpoints");
    expect(devtoolsCipoConfigCss).not.toContain("@media");
  });
});
