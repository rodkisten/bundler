import { describe, expect, it } from "vitest";
import { reset, setup, sheet } from "../src";

describe("Cipó modern runtime features", () => {
  it("compiles reactive CSS values, dark blocks and context variables", () => {
    reset();
    setup({
      prefix: "rod",
      minify: false,
      layers: false,
      theme: { colors: { brand: "#f97316" } },
    });

    const card = sheet.css`
      .card {
        provide(cardColor: sky-240)
        bg: signal(theme.cardBg)
        color: when(dark, color(amber, 245), color(sky, 200))

        .icon {
          color: consume(cardColor)
        }

        dark {
          bg: color(zinc, 900)
        }
      }
    `;

    expect(card.cssText).toContain("--rod-context-card-color");
    expect(card.cssText).toContain("var(--rod-signal-theme-card-bg)");
    expect(card.cssText).toContain("light-dark(");
    expect(card.cssText).toContain('[data-theme="dark"] .card');
    expect(card.cssText).toContain("var(--rod-context-card-color)");
  });

  it("compiles variants, compound variants and slots in stylesheet mode", () => {
    reset();
    setup({ prefix: "rod", minify: false, layers: false });

    const css = sheet.css`
      .button {
        variant(size) {
          sm { px: 2 }
          lg { px: 6 }
        }

        variant(tone) {
          danger { bg: color(red, 300) }
        }

        compound(size: lg, tone: danger) {
          shadow: glow(red-300)
        }

        slot(icon) {
          size: 16px
        }
      }
    `;

    expect(css.cssText).toContain('.button[data-size="sm"],.button.size-sm');
    expect(css.cssText).toContain('.button[data-size="lg"],.button.size-lg');
    expect(css.cssText).toContain(
      '.button[data-tone="danger"],.button.tone-danger',
    );
    expect(css.cssText).toContain(
      '.button[data-size="lg"][data-tone="danger"],.button.size-lg.tone-danger',
    );
    expect(css.cssText).toContain('.button [data-slot="icon"]');
    expect(css.cssText).toContain("oklch(");
    expect(css.cssText).toContain("box-shadow:0 0 0");
  });

  it("generates palettes and supports computed runtime tokens", () => {
    reset();
    setup({ prefix: "rod", minify: false, layers: false });

    const css = sheet.css`
      :root {
        palette(brand, amber)
        $$space: 8px
        $$cardPadding: $$space * 2
        $$dialogPadding: $$cardPadding + 8px
      }
    `;

    expect(css.cssText).toContain("--rod-brand-50:oklch(");
    expect(css.cssText).toContain("--rod-brand-500:oklch(");
    expect(css.cssText).toContain(
      "--rod-card-padding:calc(var(--rod-space) * 2)",
    );
    expect(css.cssText).toContain(
      "--rod-dialog-padding:calc(var(--rod-card-padding) + 0.5rem)",
    );
  });

  it("supports smart shadows and color system helpers", () => {
    reset();
    setup({
      prefix: "rod",
      minify: false,
      layers: false,
      theme: { colors: { brand: "#38bdf8" } },
    });

    const css = sheet.css`
      .card {
        color: color(brand/45%)
        border-color: color(brand+12)
        background: color(amber-245)
        box-shadow: shadow(elevation(4))
      }
    `;

    expect(css.cssText).toContain("color-mix(");
    expect(css.cssText).toContain("oklch(from var(--rod-colors-brand)");
    expect(css.cssText).toContain("background:oklch(");
    expect(css.cssText).toContain("box-shadow:0 0.25rem 1rem");
  });
});
