import { describe, expect, it } from "vitest";
import { findFirstMeaningful, findNextTopLevelAt, splitPolymorphicCssSource } from "../src/css-mode";

describe("Cipó css-mode scanner", () => {
  it("detects inline templates without invoking the compiler", () => {
    const result = splitPolymorphicCssSource(`\n /* comment */\n @inline { px: 2; color: red }`);
    expect(result.inline).toBe(true);
    expect(result.css).toContain("px: 2");
    expect(result.configCss).toBe("");
  });

  it("splits CSS-first config blocks from remaining stylesheet text", () => {
    const result = splitPolymorphicCssSource(`
      @cipo { prefix: demo; }
      @theme { colors: (brand: red); }
      .card { color: $colors.brand }
    `);
    expect(result.inline).toBe(false);
    expect(result.configCss).toContain("@cipo");
    expect(result.configCss).toContain("@theme");
    expect(result.css).toContain(".card");
    expect(result.css).not.toContain("@cipo");
  });

  it("leaves normal at-rules in stylesheet text", () => {
    const result = splitPolymorphicCssSource(`@media (min-width: 1px) { .card { color: red } }`);
    expect(result.configCss).toBe("");
    expect(result.css).toContain("@media");
  });

  it("finds meaningful characters and top-level at-rules while ignoring comments and nested content", () => {
    const source = `/* hidden @theme {} */ .card { content: "@nope" } @theme { colors: (brand: red); }`;
    expect(findFirstMeaningful(source)).toBe(source.indexOf("."));
    expect(findNextTopLevelAt(source, 0)).toBe(source.lastIndexOf("@theme"));
  });
});
