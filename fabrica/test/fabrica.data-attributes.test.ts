import { describe, expect, it } from "vitest";
import {
  encodeLiteralDataAttributeName,
  toDataAttributeKebabCase,
  toDataAttributeName,
} from "@rodkisten/fabrica";

describe("Fábrica data attribute naming", () => {
  it("normalizes camelCase and data-prefixed names", () => {
    expect(toDataAttributeName("panelState")).toBe("data-panel-state");
    expect(toDataAttributeName("data-panelState")).toBe(
      "data-panel-state",
    );
    expect(toDataAttributeName("HTMLState")).toBe("data-html-state");
  });

  it("keeps quoted literal names literal", () => {
    expect(toDataAttributeName('"queroManterCase"')).toBe(
      "data-queroManterCase",
    );
  });

  it("round-trips encoded literal names used by the HTML parser", () => {
    const encoded = encodeLiteralDataAttributeName("panelState").slice(1);
    expect(toDataAttributeName(encoded)).toBe("data-panelState");
  });

  it("exposes the canonical dataset kebab-case normalizer", () => {
    expect(toDataAttributeKebabCase("toolTab")).toBe("tool-tab");
    expect(toDataAttributeKebabCase("HTMLState")).toBe("html-state");
    expect(toDataAttributeKebabCase("panel_state")).toBe("panel-state");
  });
});
