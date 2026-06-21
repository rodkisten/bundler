import { describe, expect, it } from "vitest";
import { createOklchUtilityColor, expandRuntimeDsl } from "../runtime-dsl";
import type { CipoWarning } from "../types";

function expand(input: string) {
  const warnings: CipoWarning[] = [];
  const css = expandRuntimeDsl(input, warnings);

  return { css, warnings };
}

describe("Cipó runtime DSL", () => {
  describe("token objects", () => {
    it("flattens token objects into runtime custom properties", () => {
      const { css, warnings } = expand(`
        :root {
          $dock(
            radius: 14px,
            zIndex: 1000,
            size: (
              sm: 4px,
              md: 1rem,
              lg: 100%
            )
          )
        }
      `);

      expect(warnings).toEqual([]);
      expect(css).toContain("$$dock-radius: 14px");
      expect(css).toContain("$$dock-z-index: 1000");
      expect(css).toContain("$$dock-size-sm: 4px");
      expect(css).toContain("$$dock-size-md: 1rem");
      expect(css).toContain("$$dock-size-lg: 100%");
    });

    it("supports nested token objects", () => {
      const { css } = expand(`
        :root {
          $dock(
            object: (
              nested: auto,
              width: 22px,
              color: hsla(22,87%,8%,88%)
            )
          )
        }
      `);

      expect(css).toContain("$$dock-object-nested: auto");
      expect(css).toContain("$$dock-object-width: 22px");
      expect(css).toContain("$$dock-object-color: hsla(22,87%,8%,88%)");
    });

    it("warns on unclosed token object", () => {
      const { warnings } = expand(`
        :root {
          $dock(radius: 14px
        }
      `);

      expect(warnings).toEqual([
        expect.objectContaining({
          code: "cipo-token-object-unclosed",
        }),
      ]);
    });
  });

  describe("runtime mixins", () => {
    it("extracts mixins and removes declarations from output", () => {
      const { css } = expand(`
        $$glass(c: color, b: length) {
          color: *c
          py: *b
        }

        .card {
          glass(red, 12px)
        }
      `);

      expect(css).not.toContain("$$glass");
      expect(css).toContain("color: red");
      expect(css).toContain("py: 12px");
    });

    it("supports fallback arguments", () => {
      const { css } = expand(`
        $$glass(c: color = blue, b: length = 8px) {
          color: *c
          py: *b
        }

        .card {
          glass()
        }
      `);

      expect(css).toContain("color: blue");
      expect(css).toContain("py: 8px");
    });

    it("supports dollar-prefixed params", () => {
      const { css } = expand(`
        $$tone($c: color = red) {
          color: $c
        }

        .card {
          tone(blue)
        }
      `);

      expect(css).toContain("color: blue");
    });

    it("supports simple if macro blocks", () => {
      const { css } = expand(`
        $$reset(type: string) {
          p: auto

          if type = "all" {
            clear: both
            margin: auto
          }
        }

        .card {
          reset(all)
        }

        .box {
          reset(partial)
        }
      `);

      expect(css).toContain("p: auto");
      expect(css).toContain("clear: both");
      expect(css).toContain("margin: auto");

      const clearCount = css.match(/clear: both/g)?.length ?? 0;
      expect(clearCount).toBe(1);
    });

    it("expands nested mixin calls up to bounded passes", () => {
      const { css } = expand(`
        $$reset() {
          margin: 0
        }

        $$glass() {
          reset()
          background: red
        }

        .card {
          glass()
        }
      `);

      expect(css).toContain("margin: 0");
      expect(css).toContain("background: red");
    });

    it("warns on unclosed mixin declaration", () => {
      const { warnings } = expand(`
        $$glass(c: color) {
          color: *c
      `);

      expect(warnings).toEqual([
        expect.objectContaining({
          code: "cipo-mixin-unclosed",
        }),
      ]);
    });

    it("warns on unclosed mixin call", () => {
      const { warnings } = expand(`
        $$glass(c: color) {
          color: *c
        }

        .card {
          glass(red
        }
      `);

      expect(warnings).toEqual([
        expect.objectContaining({
          code: "cipo-mixin-call-unclosed",
        }),
      ]);
    });

    it("does not expand native CSS functions as mixins", () => {
      const { css, warnings } = expand(`
        $$glass(c: color) {
          background: *c
        }

        .card {
          width: max(10px, 20px)
          background: linear-gradient(red, blue)
        }
      `);

      expect(warnings).toEqual([]);
      expect(css).toContain("max(10px, 20px)");
      expect(css).toContain("linear-gradient(red, blue)");
    });
  });

  describe("color utilities", () => {
    it("expands text color utility lines", () => {
      const { css } = expand(`
        .card {
          color-amber-245
        }
      `);

      expect(css).toContain("color: oklch(");
    });

    it("expands background color utility lines", () => {
      const { css } = expand(`
        .card {
          bg-sky-200
        }
      `);

      expect(css).toContain("background: oklch(");
    });

    it("does not rewrite declarations or selectors as color utilities", () => {
      const { css } = expand(`
        .color-amber-245 {
          color: color-amber-245
        }
      `);

      expect(css).toContain(".color-amber-245");
      expect(css).toContain("color: color-amber-245");
    });

    it("generates stable OKLCH colors for known names", () => {
      expect(createOklchUtilityColor("amber", 245)).toMatch(/^oklch\(/);
      expect(createOklchUtilityColor("amber", 245)).toBe(createOklchUtilityColor("amber", 245));
    });

    it("clamps shade values", () => {
      expect(createOklchUtilityColor("amber", -10)).toMatch(/^oklch\(/);
      expect(createOklchUtilityColor("amber", 5000)).toMatch(/^oklch\(/);
    });

    it("supports unknown names by hashing hue", () => {
      expect(createOklchUtilityColor("brotoforest", 420)).toMatch(/^oklch\(/);
    });
  });

  describe("runtime variable math", () => {
    it("converts runtime vars into prefixed CSS custom property refs", () => {
      const { css } = expand(`
        :root {
          $$iconSize: $$iconWrapSize
        }
      `);

      expect(css).toContain("$$iconSize: var(--");
      expect(css).toContain("icon-wrap-size");
    });

    it("wraps top-level math in calc()", () => {
      const { css } = expand(`
        :root {
          $$iconSize: $$iconWrapSize - 1px
        }
      `);

      expect(css).toContain("calc(");
      expect(css).toContain("var(--");
      expect(css).toContain("- 1px");
    });

    it("does not double-wrap existing calc()", () => {
      const { css } = expand(`
        :root {
          $$iconSize: calc($$iconWrapSize - 1px)
        }
      `);

      expect(css).toContain("$$iconSize: calc(");
      expect(css.match(/calc\(/g)?.length).toBe(1);
    });

    it("preserves nested CSS functions while detecting math", () => {
      const { css } = expand(`
        :root {
          $$safeWidth: max(10px, 20px)
          $$mathWidth: max(10px, 20px) - 1px
        }
      `);

      expect(css).toContain("$$safeWidth: max(10px, 20px)");
      expect(css).toContain("$$mathWidth: calc(max(10px, 20px) - 1px)");
    });

    it("handles multiplication and division as calc math", () => {
      const { css } = expand(`
        :root {
          $$spaceA: $$space * 2
          $$spaceB: $$space / 2
        }
      `);

      expect(css).toContain("$$spaceA: calc(");
      expect(css).toContain("* 2");
      expect(css).toContain("$$spaceB: calc(");
      expect(css).toContain("/ 2");
    });

    it("does not treat negative values as subtraction", () => {
      const { css } = expand(`
        .card {
          margin-inline: -4px
        }
      `);

      expect(css).toContain("margin-inline: -4px");
      expect(css).not.toContain("margin-inline: calc(-4px)");
    });
  });

  describe("full runtime DSL integration", () => {
    it("expands token objects, mixins, color utilities and variable math together", () => {
      const { css, warnings } = expand(`
        :root {
          $dock(
            radius: 14px,
            size: (
              sm: 4px,
              md: 1rem
            )
          )

          $$iconWrapSize: 16px
          $$iconSize: $$iconWrapSize - 1px

          $$reset(type: string) {
            p: auto

            if type = "all" {
              clear: both
              margin: auto
            }
          }

          $$glass(c: color = amber, b: length = 8px) {
            font-size: calc(14px + 5vw)
            py: *b
            color-amber-200
            bg-sky-245

            x:md {
              reset(all)
            }
          }

          .card {
            glass(orange, 12px)
          }
        }
      `);

      expect(warnings).toEqual([]);
      expect(css).toContain("$$dock-radius: 14px");
      expect(css).toContain("$$dock-size-sm: 4px");
      expect(css).toContain("$$iconSize: calc(");
      expect(css).toContain("font-size: calc(14px + 5vw)");
      expect(css).toContain("py: 12px");
      expect(css).toContain("color: oklch(");
      expect(css).toContain("background: oklch(");
      expect(css).toContain("clear: both");
      expect(css).not.toContain("$$glass");
      expect(css).not.toContain("$$reset");
    });
  });
});
