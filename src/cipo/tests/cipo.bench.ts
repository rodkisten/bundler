import { bench, beforeEach, describe } from "vitest";
import {
  atomic,
  css,
  inline,
  registerAlias,
  registerHelper,
  registerProperty,
  reset,
  setup,
  sheet,
} from "../src/index";

function setupBenchCipo() {
  reset();

  setup({
    prefix: "bench",
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
}

const ATOMIC_CASE = `
  px: 4
  py: 2
  bg: $brand
  color: saturate($brand, 20%)
  #box-shadow: outlineGlow($brand)
  $glassCard
  bleed: -4

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

const INLINE_CASE = `
  px: 4
  py: 2
  color: $brand
  bg: alpha($panel / 72%)
  rounded: $xl
`;

const SHEET_CASE = `
  :root {
    $$baseZ: 88888

    $dock(
      radius: 14px,
      zIndex: $$baseZ + 1,
      size: (
        sm: 1rem,
        md: 4px,
        full: 100%
      )
    )

    $$panelRadius: $$dockRadius / 2 + 4px
  }

  .card {
    $glassCard
    px: 4
    py: 2

    .card-inner {
      stack(gap: 8px)
      color: color(brand)
      shadow: elevation(4)
    }

    &:hover {
      bg: alpha($brand / 72%)
    }

    x:md {
      grid-template(cols: 1fr 1fr)
    }
  }
`;

const CONFIG_CASE = `
  @cipo {
    prefix: benchcfg;
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

describe("Cipó benchmark baseline", () => {
  beforeEach(() => {
    setupBenchCipo();
  });

  bench("baseline: String.raw tiny css", () => {
    String.raw`color:red;`;
  });

  bench("atomic.css: classic atomic compile", () => {
    atomic.css`
      px: 4
      bg: $brand
      rounded: $xl
    `;
  });

  bench("css: polymorphic atomic detection", () => {
    css`
      px: 4
      bg: $brand
      rounded: $xl
    `;
  });

  bench("inline.css: inline style compile", () => {
    inline.css`${INLINE_CASE}`;
  });

  bench("atomic.css: aliases helpers comments variants", () => {
    atomic.css`${ATOMIC_CASE}`;
  });

  bench("sheet.css: nested sheet runtime DSL", () => {
    sheet.css`${SHEET_CASE}`;
  });

  bench("css: polymorphic sheet detection", () => {
    css`${SHEET_CASE}`;
  });

  bench("css: polymorphic configure detection", () => {
    css`${CONFIG_CASE}`;
  });

  bench("sheet.css.withImportant: full stylesheet important", () => {
    sheet.css.withImportant`${SHEET_CASE}`;
  });

  bench("atomic.css.withImportant: atomic important", () => {
    atomic.css.withImportant`${ATOMIC_CASE}`;
  });
});
