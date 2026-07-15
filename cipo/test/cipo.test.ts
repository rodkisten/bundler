import { beforeEach, describe, expect, it } from "vitest";
import {
  atomic,
  css,
  explainCss,
  getCssText,
  inline,
  isAtomicCssArtifact,
  isStylesheetArtifact,
  registerAlias,
  registerHelper,
  registerNativeFunction,
  registerProperty,
  reset,
  setup,
  sheet,
  validateCss,
} from "@rodkisten/cipo";

describe("Cipó next kitchen sink", () => {
  beforeEach(() => {
    reset();

    setup({
      prefix: "test",
      minify: true,
      layers: true,
      theme: {
        colors: {
          brand: "#f97316",
          ink: "#fff",
          panel: "#111",
          strong: "#ffffff",
          cyan: "#7dd3fc",
          danger: "#ff7b72",
        },
        spacing: "0.25rem",
        radius: {
          sm: "calc(6 * 0.25rem)",
          md: "14px",
          xl: "24px",
          pill: "999px",
        },
        shadow: {
          panel: "0 28px 90px rgb(0 0 0 / 0.72)",
        },
        font: {
          ui: "Inter, system-ui, sans-serif",
          mono: "ui-monospace, monospace",
        },
      },
    });

    registerHelper("outlineGlow", (args, context) => {
      return `0 0 0 3px ${context.resolveValue(`alpha(${args || "$brand"} / 25%)`)}`;
    });

    registerAlias(
      "glassCard",
      `
        bg: alpha($panel / 72%)
        border: 1px solid alpha($ink / 12%)
        backdrop-filter: blur(18px)
      `,
    );

    registerProperty("bleed", {
      property: "margin-inline",
      scale: "spacing",
    });
  });

  it("keeps the classic css tagged template API", () => {
    const card = css`color:red;`;

    expect(String(card)).toMatch(/^test-color-red-[a-z0-9]+$/);
    expect(getCssText()).toContain("color:red");
  });

  it("supports token inference, property aliases and atomic artifacts", () => {
    const card = css`
      px: 4
      bg: $brand
      rounded: $xl
    `;

    expect(isAtomicCssArtifact(card)).toBe(true);
    if (!isAtomicCssArtifact(card)) throw new Error("Expected atomic artifact");

    expect(card.compiledCss).toContain("padding-inline");
    expect(card.compiledCss).toContain("background:var(--test-colors-brand)");
    expect(card.compiledCss).toContain("border-radius:var(--test-radius-xl)");
  });

  it("supports standalone aliases", () => {
    registerAlias("demoGlass", "bg:alpha($panel / 50%);");

    const card = css`
      demoGlass
    `;

    expect(isAtomicCssArtifact(card)).toBe(true);
    if (!isAtomicCssArtifact(card)) throw new Error("Expected atomic artifact");

    expect(card.compiledCss).toContain("background:color-mix");
  });

  it("supports inline.css", () => {
    const style = inline.css`
      px: 2
      color: $brand
    `;

    expect(String(style)).toContain("padding-inline");
    expect(String(style)).toContain("var(--test-colors-brand)");
  });

  it("supports hover and breakpoint x variants", () => {
    const button = css`
      x:hover {
        bg: $brand
      }

      x:md {
        px: 6
      }
    `;

    expect(isAtomicCssArtifact(button)).toBe(true);
    if (!isAtomicCssArtifact(button)) throw new Error("Expected atomic artifact");

    expect(button.compiledCss).toContain(":hover");
    expect(button.compiledCss).toContain("@media");
    expect(button.compiledCss).toContain("padding-inline");
  });

  it("handles comments, dollar aliases, raw property escape and helpers without semicolons", () => {
    const button = css`
      px: 4
      py: 2
      bg: $brand
      color: saturate($brand, 20%)

      /* bg: alpha($brand / 14%) */
      #box-shadow: outlineGlow($brand)

      $glassCard

      bleed: -4

      /*
      x:hover {
        bg: alpha($brand / 72%)
      }
      */
    `;

    expect(isAtomicCssArtifact(button)).toBe(true);
    if (!isAtomicCssArtifact(button)) throw new Error("Expected atomic artifact");

    expect(button.compiledCss).toContain("padding-inline");
    expect(button.compiledCss).toContain("padding-block");
    expect(button.compiledCss).toContain("background");
    expect(button.compiledCss).toContain("color-mix");
    expect(button.compiledCss).toContain("box-shadow");
    expect(button.compiledCss).toContain("margin-inline");
    expect(button.compiledCss).not.toContain("/*");
  });

  it("supports active x blocks and alpha helpers without recursive parser blowups", () => {
    const button = css`
      px: 4

      x:focus-visible {
        box-shadow: outlineGlow($brand)
      }

      x:hover {
        bg: alpha($brand / 72%)
      }

      x:md {
        px: 6
      }

      x:not(md) {
        width: 100%
      }
    `;

    expect(isAtomicCssArtifact(button)).toBe(true);
    if (!isAtomicCssArtifact(button)) throw new Error("Expected atomic artifact");

    expect(button.compiledCss).toContain(":focus-visible");
    expect(button.compiledCss).toContain(":hover");
    expect(button.compiledCss).toContain("@media");
    expect(button.compiledCss).toContain("not all and");
  });

  it("supports atomic, sheet and inline namespaces with important mode", () => {
    const atomicButton = atomic.css.withImportant`
      px: 4
      color: red !important
    `;

    expect(atomicButton.kind).toBe("cipo.css");
    expect(atomicButton.compiledCss).toContain("padding-inline");
    expect(atomicButton.compiledCss).toContain("!important");
    expect(atomicButton.compiledCss).not.toContain("!important !important");

    const inlineStyle = inline.css.withImportant`
      Px: 4
      color: red !important
    `;

    expect(String(inlineStyle)).toContain("padding-inline");
    expect(String(inlineStyle)).not.toContain("!important !important");

    const stylesheet = sheet.css.withImportant`
      .card {
        color: red !important
        px: 4
      }
    `;

    expect(stylesheet.kind).toBe("cipo.stylesheet");
    expect(String(stylesheet)).toContain(".card");
    expect(String(stylesheet)).toContain("padding-inline");
    expect(String(stylesheet)).not.toContain("!important !important");
  });

  it("compiles full stylesheets with theme tokens, $$ vars, selector lists, nesting and x blocks", () => {
    const ROOT_ID = "root";

    const styleText = sheet.css`
      :root {
        $$panel: rgb(12 13 15 / .93)
        --ra-panel: rgb(12 13 15 / .93)
        --ra-muted: $colors.brand
      }

      #${ROOT_ID},
      .ra-log-surface-host {
        font-family: var(--ra-font-ui)
        color: var(--ra-text)
      }

      .ra-dock {
        $glassCard
        px: 4

        .ra-dock-inner {
          py: 2
        }

        &:hover {
          bg: alpha($brand / 72%)
        }

        x:md {
          px: 6
        }

        x:not(md) {
          width: 100%
        }
      }
    `;

    expect(isStylesheetArtifact(styleText)).toBe(true);
    expect(String(styleText)).toContain("--test-panel");
    expect(String(styleText)).toContain("--ra-panel");
    expect(String(styleText)).toContain("#root,.ra-log-surface-host");
    expect(String(styleText)).toContain(".ra-dock .ra-dock-inner");
    expect(String(styleText)).toContain(".ra-dock:hover");
    expect(String(styleText)).toContain("@media");
    expect(String(styleText)).toContain("not all and");
    expect(String(styleText)).toContain("background:color-mix");
    expect(String(styleText)).not.toContain("bg:");
  });

  it("supports modern native CSS functions and multiline values without warning storms", () => {
    const warnings: string[] = [];

    setup({
      prefix: "modern",
      minify: true,
      debug: false,
      onWarning(warning) {
        warnings.push(warning.code);
      },
      theme: {
        colors: {
          brand: "#22c55e",
          ink: "#f8fafc",
          panel: "#020617",
        },
        spacing: "0.25rem",
      },
    });

    const styleText = sheet.css`
      .panel {
        right: max(0.5rem, env(safe-area-inset-right))
        bottom:
          max(1.125rem, env(safe-area-inset-bottom))
        left:
          max(0.5rem, env(safe-area-inset-left))
        width: min(100%, calc(100vw - env(safe-area-inset-left) - env(safe-area-inset-right)))
        background: linear-gradient(180deg, color-mix(in oklch, $panel 88%, transparent), light-dark(#fff, #000))
        color: oklch(from $brand l c h)
        filter: blur(2px) saturate(140%) drop-shadow(0 12px 24px rgb(0 0 0 / .3))
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr))
        clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%)
      }
    `;

    const output = String(styleText);

    expect(output).toContain("right:max(0.5rem,env(safe-area-inset-right))");
    expect(output).toContain("bottom:max(1.125rem,env(safe-area-inset-bottom))");
    expect(output).toContain("left:max(0.5rem,env(safe-area-inset-left))");
    expect(output).toContain("width:min(100%,calc(100vw - env(safe-area-inset-left) - env(safe-area-inset-right)))");
    expect(output).toContain("linear-gradient");
    expect(output).toContain("light-dark");
    expect(output).toContain("oklch(from var(--modern-colors-brand) l c h)");
    expect(output).toContain("repeat(auto-fit,minmax(min(100%,12rem),1fr))");

    expect(warnings).not.toContain("unknown-function-declaration");
    expect(warnings).not.toContain("invalid-declaration");
  });

  it("lets users register future native CSS functions", () => {
    const warnings: string[] = [];

    setup({
      prefix: "future",
      minify: true,
      debug: false,
      onWarning: (warning) => warnings.push(warning.code),
    });

    registerNativeFunction("future-size");

    const styleText = sheet.css`
      .box {
        width:
          future-size(width)
      }
    `;

    expect(String(styleText)).toContain("width:future-size(width)");
    expect(warnings).not.toContain("unknown-function-declaration");
    expect(warnings).not.toContain("invalid-declaration");
  });

  it("explains raw css input for diagnostics", () => {
    const info = explainCss(".card { bg: alpha($brand / 20%) }", "stylesheet");

    expect(info.mode).toBe("stylesheet");
    expect(info.transformedCss).toContain("color-mix");
    expect(info.cssText).toContain(".card");
    expect(info.validation.valid).toBe(true);
  });

  it("validates generated css for debug diagnostics", () => {
    const ok = validateCss(".card{color:red!important;}");
    expect(ok.valid).toBe(true);

    const broken = validateCss(".card{color:red!important!important;");
    expect(broken.valid).toBe(false);

    const codes = broken.issues.map((issue) => issue.code).join(",");
    expect(codes).toContain("duplicate-important");
    expect(codes).toContain("unclosed-block");
  });
});
