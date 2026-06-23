import { beforeEach, describe, expect, it } from "vitest";
import {
  css,
  inline,
  isAtomicCssArtifact,
  isStylesheetArtifact,
  reset,
  setup,
} from "../src/index";

describe("Cipó polymorphic css entry point", () => {
  beforeEach(() => {
    reset();
    setup({
      prefix: "poly",
      minify: true,
      layers: true,
      theme: {
        colors: { brand: "#f97316", ink: "#ffffff", panel: "#111111" },
        spacing: "0.25rem",
        radius: { lg: "22px" },
      },
    });
  });

  it("keeps declaration templates in atomic mode for backwards compatibility", () => {
    const result = css`
      px: 4
      bg: $brand
    `;

    expect(isAtomicCssArtifact(result)).toBe(true);
    if (!isAtomicCssArtifact(result))
      throw new Error("Expected atomic artifact");
    expect(String(result)).toContain("poly-a-");
    expect(result.compiledCss).toContain("padding-inline");
    expect(result.compiledCss).toContain("background:var(--poly-colors-brand)");
  });

  it("detects full stylesheet roots automatically", () => {
    const result = css`
      .card {
        color: $colors.ink
        bg: alpha($colors.panel / 72%)
      }
    `;

    expect(isStylesheetArtifact(result)).toBe(true);
    if (!isStylesheetArtifact(result))
      throw new Error("Expected stylesheet artifact");
    expect(String(result)).toContain(".card");
    expect(String(result)).toContain("color:var(--poly-colors-ink)");
    expect(String(result)).toContain("background:color-mix");
  });

  it("detects inline style objects through the same css entry point", () => {
    const result = css({ px: 2, color: "$brand" });

    expect(result.kind).toBe("cipo.inline-css");
    expect(String(result)).toContain("padding-inline");
    expect(String(result)).toContain("var(--poly-colors-brand)");

    const explicit = inline.css({ px: 2, color: "$brand" });
    expect(String(result)).toBe(String(explicit));
  });

  it("detects @inline template mode without parsing the source twice", () => {
    const result = css`
      @inline {
        px: 3
        color: $brand
      }
    `;

    expect(result.kind).toBe("cipo.inline-css");
    expect(String(result)).toContain("padding-inline");
    expect(String(result)).toContain("var(--poly-colors-brand)");
  });

  it("applies CSS-first config and returns the config result when no style body remains", () => {
    const result = css`
      @cipo {
        prefix: configured;
        minify: true;
      }

      @theme {
        colors: (brand: #7dd3fc);
      }
    `;

    expect("config" in result).toBe(true);
    if (!("config" in result)) throw new Error("Expected config result");
    expect(result.config.prefix).toBe("configured");

    const card = css`
      color: $brand;
    `;

    expect(isAtomicCssArtifact(card)).toBe(true);
    if (!isAtomicCssArtifact(card)) throw new Error("Expected atomic artifact");
    expect(card.compiledCss).toContain("var(--configured-colors-brand)");
  });

  it("applies CSS-first config and compiles the remaining source as a stylesheet", () => {
    const result = css`
      @cipo {
        prefix: cfgsheet;
        minify: true;
      }

      @theme {
        colors: (brand: #38bdf8, ink: #e5e7eb);
      }

      @alias glass {
        bg: alpha($colors.brand / 20%)
        color: $colors.ink
      }

      .card {
        glass
      }
    `;

    expect(isStylesheetArtifact(result)).toBe(true);
    if (!isStylesheetArtifact(result))
      throw new Error("Expected stylesheet artifact");
    expect(String(result)).toContain(".card");
    expect(String(result)).toContain("var(--cfgsheet-colors-ink)");
    expect(String(result)).toContain("background:color-mix");
  });

  it("keeps regular @property stylesheets as stylesheet CSS unless config mode is active", () => {
    const result = css`
      @property $$angle {
        syntax: "<angle>"
        inherits: false
        initial: 0deg
      }

      .knob {
        $$angle: 24deg
        rotate: $$angle
      }
    `;

    expect(isStylesheetArtifact(result)).toBe(true);
    if (!isStylesheetArtifact(result))
      throw new Error("Expected stylesheet artifact");
    expect(String(result)).toContain("@property --poly-angle");
    expect(String(result)).toContain("rotate:var(--poly-angle)");
  });

  it("also exposes css.configure for compatibility", () => {
    const configureCss = (
      css as unknown as {
        configure: (
          strings: TemplateStringsArray,
          ...values: readonly unknown[]
        ) => { config: { prefix?: string } };
      }
    ).configure;
    const result = configureCss`
      @cipo {
        prefix: compat;
      }
    `;

    expect(result.config.prefix).toBe("compat");
  });
});
