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
} from "../src/index";

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

  it("supports runtime token objects, nested token flattening and variable math", () => {
    const styleText = sheet.css`
      :root {
        $$baseZ: 88888

        $dock(
          radius: 14px,
          zIndex: $$baseZ + 1,
          size: (
            sm: 1rem,
            md: 4px,
            full: 100%
          ),
          nested: (
            width: 22px,
            color: hsla(22, 87%, 8%, 0.88)
          )
        )

        $$panelRadius: $$dockRadius / 2 + 4px
        $$iconWrapSize: 16px
        $$iconSize: $$iconWrapSize - 1px
      }
    `;

    const output = String(styleText);

    expect(output).toContain("--test-base-z");
    expect(output).toContain("--test-dock-radius");
    expect(output).toContain("--test-dock-z-index");
    expect(output).toContain("--test-dock-size-sm");
    expect(output).toContain("--test-dock-size-md");
    expect(output).toContain("--test-dock-size-full");
    expect(output).toContain("--test-dock-nested-width");
    expect(output).toContain("--test-dock-nested-color");
    expect(output).toContain("--test-panel-radius");
    expect(output).toContain("calc(");
  });

  it("supports runtime mixins with params, fallbacks and simple if macro blocks", () => {
    const styleText = sheet.css`
      $$reset(type: string = partial) {
        p: auto

        if type = "all" {
          clear: both
          margin: auto
        }
      }

      $$glass(c: color = $colors.panel, b: length = 18px) {
        bg: alpha(*c / 72%)
        backdrop-filter: blur(*b)
        reset(all)
      }

      .card {
        glass($colors.panel, 20px)
      }
    `;

    const output = String(styleText);

    expect(output).toContain("background:color-mix");
    expect(output).toContain("backdrop-filter:blur(1.25rem)");
    expect(output).toContain("clear:both");
    expect(output).toContain("margin:auto");
    expect(output).not.toContain("$$glass");
    expect(output).not.toContain("$$reset");
  });

  it("supports latest smart shorthands", () => {
    const styleText = sheet.css`
      .layout {
        h(contain, min: 240px, max: 70vh)
        w(fill, min: 320px, max: 960px)
        pos(fixed, top: 0, right: 0, bottom: 0)
        grid-template(cols: 220px 1fr, rows: auto minmax(0, 1fr))
        grid-flow(row dense)
        text(nowrap)
        break(anywhere)
        bor: red
        bor-x: 2px $brand
        bg: gradient(linear, 180deg, red, blue)
        background-image: image("https://example.com/bg.png")
        scroll(smooth)
        scrollbar(thin)
        snap(x mandatory)
        overscroll(contain)
        tap(none)
        select(none)
        drag(none)
        focus-ring($brand)
        transition(colors, fast)
      }
    `;

    const output = String(styleText);

    expect(output).toContain("min-height:15rem");
    expect(output).toContain("max-height:70vh");
    expect(output).toContain("min-width:20rem");
    expect(output).toContain("max-width:60rem");
    expect(output).toContain("position:fixed");
    expect(output).toContain("top:0");
    expect(output).toContain("right:0");
    expect(output).toContain("grid-template-columns:13.75rem 1fr");
    expect(output).toContain("grid-template-rows:auto minmax(0,1fr)");
    expect(output).toContain("grid-auto-flow:row dense");
    expect(output).toContain("white-space:nowrap");
    expect(output).toContain("overflow-wrap:anywhere");
    expect(output).toContain("border:1px solid red");
    expect(output).toContain("border-inline");
    expect(output).toContain("linear-gradient");
    expect(output).toContain("url(");
    expect(output).toContain("scroll-behavior:smooth");
    expect(output).toContain("scrollbar-width:thin");
    expect(output).toContain("scroll-snap-type:x mandatory");
    expect(output).toContain("overscroll-behavior:contain");
    expect(output).toContain("touch-action:none");
    expect(output).toContain("user-select:none");
    expect(output).toContain("-webkit-user-drag:none");
    expect(output).toContain("outline");
    expect(output).toContain("transition");
  });

  it("supports layout helpers", () => {
    const styleText = sheet.css`
      .stack {
        stack(gap: 8px)
      }

      .cluster {
        cluster(gap: 8px, justify: space-between)
      }

      .center {
        center(max: 720px, px: 16px)
      }

      .cover {
        cover(header: auto, main: 1fr, footer: auto)
      }

      .sidebar {
        sidebar(side: left, width: 280px, gap: 16px)
      }
    `;

    const output = String(styleText);

    expect(output).toContain(".stack");
    expect(output).toContain("display:flex");
    expect(output).toContain("flex-direction:column");
    expect(output).toContain("gap:0.5rem");
    expect(output).toContain("justify-content:space-between");
    expect(output).toContain("max-width:45rem");
    expect(output).toContain("margin-inline:auto");
    expect(output).toContain("grid-template-rows:auto 1fr auto");
    expect(output).toContain("grid-template-columns:17.5rem minmax(0,1fr)");
  });

  it("supports container queries, supports blocks, layers and reduce motion", () => {
    const styleText = sheet.css`
      layer(components) {
        .card {
          container(card / inline-size)

          x:cq(md) {
            grid-template(cols: 1fr 1fr)
          }

          supports(backdrop-filter) {
            backdrop-filter: blur(18px)
          }

          reduce-motion {
            transition: none
            animation: none
          }
        }
      }
    `;

    const output = String(styleText);

    expect(output).toContain("@layer components");
    expect(output).toContain("@container md");
    expect(output).toContain("@container");
    expect(output).toContain("@supports");
    expect(output).toContain("@media (prefers-reduced-motion:reduce)");
  });

  it("supports modern color helpers, palette utilities, shadow and glass helpers", () => {
    const styleText = sheet.css`
      :root {
        palette(brand, sky)
      }

      .card {
        color: color(brand)
        background: color(brand/50)
        border-color: mix($brand, white, 20%)
        box-shadow: glow(sky-240 / 25%)
        shadow: elevation(4)
        glass(blur: 20px, opacity: .08)
      }
    `;

    const output = String(styleText);

    expect(output).toContain("--test-brand-50");
    expect(output).toContain("--test-brand-950");
    expect(output).toContain("color:var(--test-colors-brand)");
    expect(output).toContain("color-mix");
    expect(output).toContain("box-shadow");
    expect(output).toContain("box-shadow:elevation(4)");
  });

  it("supports custom @property blocks and typed custom properties", () => {
    const styleText = sheet.css`
      @property $$angle {
        syntax: "<angle>"
        inherits: false
        initial: 0deg
      }

      @property $$progress {
        syntax: "<percentage>"
        inherits: true
        initial-value: 0%
      }

      .knob {
        $$angle: 24deg
        rotate: $$angle
      }
    `;

    const output = String(styleText);

    expect(output).toContain("@property --test-angle");
    expect(output).toContain('syntax:"<angle>"');
    expect(output).toContain("inherits:false");
    expect(output).toContain("initial-value:0deg");
    expect(output).toContain("@property --test-progress");
    expect(output).toContain("--test-angle:24deg");
    expect(output).toContain("rotate:var(--test-angle)");
  });

  it("supports CSS-first configure.css with theme, alias, breakpoints, properties and presets", () => {
    reset();

    const result = css.configure`
      @cipo {
        prefix: cfg;
        layers: true;
        minify: true;
        rem: 16px;
        color-mode: oklch;
      }

      @theme {
        colors: (
          brand: #7dd3fc,
          ink: #e5e7eb,
          panel: rgb(12 13 15 / .94)
        );

        spacing: 0.25rem;

        radius: (
          lg: 22px,
          pill: 999px
        );
      }

      @breakpoints {
        sm: 640px;
        md: 720px;
      }

      @alias glass {
        bg: alpha($colors.panel / 72%)
        border: 1px solid alpha($colors.ink / 12%)
      }

      @property $$angle {
        syntax: "<angle>"
        inherits: false
        initial: 0deg
      }
    `;

    expect(result.config.prefix).toBe("cfg");

    const styleText = sheet.css`
      .card {
        glass
        rounded: $radius.lg
        color: $colors.ink

        x:md {
          px: 6
        }
      }
    `;

    const output = String(styleText);

    expect(output).toContain("var(--cfg-colors-ink)");
    expect(output).toContain("var(--cfg-radius-lg)");
    expect(output).toContain("background:color-mix");
    expect(output).toContain("@media (min-width:720px)");
    expect(getCssText()).toContain("@property --cfg-angle");
  });

  it("supports component variants, compound variants, slots and state blocks", () => {
    const styleText = sheet.css`
      .button {
        variant(size) {
          sm {
            px: 2
            py: 1
          }

          lg {
            px: 4
            py: 2
          }
        }

        variant(intent) {
          danger {
            bg: $colors.danger
          }
        }

        compound(size: lg, intent: danger) {
          shadow: glow(red-280 / 25%)
        }
      }

      .card {
        slot(header) {
          pb: 8px
        }

        slot(body) {
          p: 16px
        }

        state(open) {
          opacity: 1
        }

        state(closed) {
          opacity: .4
        }

        dark {
          bg: black
        }
      }
    `;

    const output = String(styleText);

    expect(output).toContain(".button[data-size=\"sm\"],.button.size-sm");
    expect(output).toContain(".button[data-size=\"lg\"],.button.size-lg");
    expect(output).toContain(".button[data-intent=\"danger\"],.button.intent-danger");
    expect(output).toContain(".button[data-size=\"lg\"][data-intent=\"danger\"],.button.size-lg.intent-danger");
    expect(output).toContain('.card [data-slot="header"]');
    expect(output).toContain('.card [data-slot="body"]');
    expect(output).toContain('.card state(open)');
    expect(output).toContain('.card state(closed)');
    expect(output).toContain("[data-theme=\"dark\"] .card");
  });

  it("supports context variables and reactive CSS placeholders", () => {
    const styleText = sheet.css`
      .card {
        provide(cardColor: sky-240)
        color: consume(cardColor)
        bg: signal(theme.cardBg)
        border-color: when(dark, zinc-900, white)
      }
    `;

    const output = String(styleText);

    expect(output).toContain("--test-context-card-color");
    expect(output).toContain("color:var(--test-context-card-color)");
    expect(output).toContain("--test-signal-theme-card-bg");
    expect(output).toContain("var(--test-signal-theme-card-bg)");
    expect(output).toContain("light-dark(");
  });

  it("supports CSS functions in JS-style runtime mixins", () => {
    const styleText = sheet.css`
      $$elev(level: number = 4) {
        shadow: 0 *levelpx calc(*level * 4px) rgb(0 0 0 / .2)
      }

      .card {
        elev(6)
      }
    `;

    const output = String(styleText);

    expect(output).toContain("box-shadow");
    expect(output).toContain("calc(6 * 0.25rem)");
    expect(output).toContain("calc(");
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
