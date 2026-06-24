import { configureCss, sheet, validateCss } from '../src/index'
import type { CipoCssConfigResult, CipoStylesheetArtifact } from '../src/index'

export interface TypedThemeMegaSheetResult {
  readonly config: CipoCssConfigResult
  readonly stylesheet: CipoStylesheetArtifact
  readonly validation: ReturnType<typeof validateCss>
}

/**
 * Compiles a deliberately large, realistic application stylesheet using only
 * Cipó's CSS-first configuration and stylesheet DSL.
 *
 * The example exercises typed theme groups, semantic-only validators, native
 * `@property` generation, nested selectors, selector lists, `:is()`, `:where()`,
 * `:has()`, container wrappers, media contexts, variants, slots, stateful data
 * attributes and native at-rules in one file.
 */
export function createTypedThemeMegaSheet(): TypedThemeMegaSheetResult {
  const config = configureCss`
    @cipo {
      prefix: mega;
      layers: true;
      minify: false;
      color-mode: oklch;
      rem: 16px;
      theme-validation: strict;
      register-typed-theme-properties: true;
      theme-root: :root;
    }

    @theme {
      spacing<size>: 0.25rem;

      space<size>: (
        0: 0px,
        1: 0.25rem,
        2: 0.5rem,
        3: 0.75rem,
        4: 1rem,
        5: 1.25rem,
        6: 1.5rem,
        8: 2rem,
        10: 2.5rem,
        12: 3rem,
        16: 4rem,
        20: 5rem,
        24: 6rem
      );

      radius<length>: (
        xs: 3px,
        sm: 6px,
        md: 14px,
        lg: 22px,
        modal: 24px,
        round: 50px,
        pill: 999px
      );

      borderWidth<length>: (
        hairline: 1px,
        strong: 2px,
        focus: 3px
      );

      iconSize<length>: (
        xs: 12px,
        sm: 16px,
        md: 20px,
        lg: 24px,
        xl: 32px
      );

      controlHeight<length>: (
        sm: 32px,
        md: 40px,
        lg: 48px
      );

      duration<time>: (
        instant: 1ms,
        fast: 120ms,
        normal: 180ms,
        slow: 280ms,
        deliberate: 420ms
      );

      opacity<number>: (
        disabled: 0.42,
        muted: 0.64,
        soft: 0.78,
        solid: 1
      );

      angle<angle>: (
        zero: 0deg,
        tilt: -2deg,
        accent: 8deg,
        turn: 360deg
      );

      colors<color>: (
        canvas: #07090d,
        canvasElevated: #0d1118,
        panel: #111722,
        panelRaised: #171f2d,
        panelSoft: #1d2736,
        border: #2d394a,
        borderStrong: #41516a,
        ink: #f5f7fb,
        inkMuted: #a8b3c4,
        inkFaint: #778398,
        brand: #8b5cf6,
        brandStrong: #6d3ee8,
        brandSoft: #c4b5fd,
        accent: #22d3ee,
        success: #34d399,
        warning: #fbbf24,
        danger: #fb7185,
        info: #60a5fa,
        white: #ffffff,
        black: #000000
      );

      shadow<shadow>: (
        hairline: 0 1px 0 rgb(255 255 255 / 0.05),
        control: 0 1px 2px rgb(0 0 0 / 0.42),
        panel: 0 28px 90px rgb(0 0 0 / 0.72),
        modal: 0 32px 120px rgb(0 0 0 / 0.78),
        dock: 0 18px 50px rgb(0 0 0 / 0.58),
        focus: 0 0 0 3px rgb(139 92 246 / 0.32),
        danger: 0 0 0 3px rgb(251 113 133 / 0.24)
      );

      easing<easing>: (
        standard: cubic-bezier(0.2, 0, 0, 1),
        emphasized: cubic-bezier(0.2, 0.8, 0.2, 1),
        spring: cubic-bezier(0.16, 1, 0.3, 1),
        exit: cubic-bezier(0.4, 0, 1, 1)
      );

      gradient<gradient>: (
        brand: linear-gradient(135deg, #8b5cf6, #22d3ee),
        panel: linear-gradient(180deg, rgb(255 255 255 / 0.05), transparent),
        danger: linear-gradient(135deg, #fb7185, #f97316),
        shimmer: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.08), transparent)
      );

      border<border>: (
        subtle: 1px solid rgb(255 255 255 / 0.08),
        normal: 1px solid rgb(255 255 255 / 0.14),
        strong: 2px solid rgb(255 255 255 / 0.22)
      );

      transition<transition>: (
        colors: color 180ms ease, background-color 180ms ease, border-color 180ms ease,
        interactive: color 180ms ease, background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease,
        layout: inline-size 280ms cubic-bezier(0.2, 0, 0, 1), block-size 280ms cubic-bezier(0.2, 0, 0, 1)
      );

      typography<any>: (
        fontSans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif,
        fontMono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace,
        textXs: 0.75rem,
        textSm: 0.875rem,
        textMd: 1rem,
        textLg: 1.125rem,
        textXl: 1.375rem,
        text2xl: 1.75rem,
        text3xl: 2.25rem
      );

      layout<size>: (
        sidebar: 17rem,
        sidebarCollapsed: 4.5rem,
        contentMax: 90rem,
        inspector: 22rem,
        command: 42rem,
        prose: 68ch
      );
    }

    @breakpoints {
      xs: 30rem;
      sm: 40rem;
      md: 48rem;
      lg: 64rem;
      xl: 80rem;
      wide: 96rem;
      motion: (prefers-reduced-motion: no-preference);
      contrast: (prefers-contrast: more);
    }

    @alias interactiveSurface {
      border: $border.subtle;
      background: $colors.panel;
      color: $colors.ink;
      transition: $transition.interactive;
    }

    @alias focusRing {
      outline: none;
      box-shadow: $shadow.focus;
    }

    @alias truncateLine {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    @alias scrollArea {
      overflow: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
      scrollbar-color: $colors.border transparent;
    }

    @layer reset, tokens, base, components, utilities, overrides;
  `

  const stylesheet = sheet.css`
    @layer reset {
      *, *::before, *::after {
        box-sizing: border-box;
      }

      :where(html, body, #app) {
        min-block-size: 100%;
      }

      html {
        color-scheme: dark;
        scroll-behavior: smooth;
        text-size-adjust: 100%;
        -webkit-text-size-adjust: 100%;
      }

      body {
        margin: 0;
        background: $colors.canvas;
        color: $colors.ink;
        font-family: $typography.fontSans;
        font-size: $typography.textMd;
        line-height: 1.5;
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
      }

      :where(button, input, textarea, select) {
        color: inherit;
        font: inherit;
      }

      :where(button, [role="button"], summary) {
        -webkit-tap-highlight-color: transparent;
      }

      :where(img, svg, video, canvas) {
        display: block;
        max-inline-size: 100%;
      }

      :where(a) {
        color: inherit;
        text-decoration: none;
      }

      :where([hidden]) {
        display: none !important;
      }
    }

    @layer base {
      :root {
        $$appDensity: 1;
        $$sidebarWidth: $layout.sidebar;
        $$inspectorWidth: $layout.inspector;
        $$headerHeight: 4rem;
        $$selectionColor: $colors.brand;
        accent-color: $colors.brand;
      }

      ::selection {
        background: alpha($colors.brand / 34%);
        color: $colors.white;
      }

      :focus-visible {
        outline: 2px solid $colors.brandSoft;
        outline-offset: 3px;
      }

      :where(code, kbd, samp, pre) {
        font-family: $typography.fontMono;
      }

      :where(kbd) {
        border: $border.normal;
        border-radius: $radius.sm;
        background: $colors.panelRaised;
        box-shadow: $shadow.control;
        padding: 0.125rem 0.375rem;
        font-size: $typography.textXs;
      }

      :where(.sr-only, [data-visually-hidden="true"]) {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        margin: -1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }
    }

    @layer components {
      .app-shell {
        display: grid;
        grid-template-columns: var(--mega-sidebar-width) minmax(0, 1fr);
        min-block-size: 100dvh;
        background:
          radial-gradient(circle at 15% -10%, alpha($colors.brand / 20%), transparent 32rem),
          radial-gradient(circle at 100% 0%, alpha($colors.accent / 12%), transparent 28rem),
          $colors.canvas;
        transition: grid-template-columns $duration.slow $easing.standard;

        &:has(.app-sidebar[data-collapsed="true"]) {
          grid-template-columns: $layout.sidebarCollapsed minmax(0, 1fr);
        }

        &:has(.inspector-panel[data-open="true"]) .app-main {
          padding-inline-end: calc($layout.inspector + $space.4);
        }

        x:not(lg) {
          display: block;
        }
      }

      .app-sidebar {
        position: sticky;
        inset-block-start: 0;
        z-index: 30;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        block-size: 100dvh;
        border-inline-end: $border.subtle;
        background: alpha($colors.canvasElevated / 92%);
        backdrop-filter: blur(24px) saturate(1.25);
        transition: $transition.layout;

        &[data-collapsed="true"] {
          inline-size: $layout.sidebarCollapsed;

          :where(.sidebar-label, .sidebar-section-title, .workspace-meta) {
            opacity: 0;
            pointer-events: none;
          }
        }

        &:has(.sidebar-search input:not(:placeholder-shown)) .sidebar-navigation {
          mask-image: linear-gradient(to bottom, transparent, black 1rem, black);
        }

        x:not(lg) {
          position: fixed;
          inset: 0 auto 0 0;
          inline-size: min(86vw, $layout.sidebar);
          transform: translateX(-105%);
          box-shadow: $shadow.modal;

          &[data-open="true"] {
            transform: translateX(0);
          }
        }
      }

      .sidebar-header,
      .sidebar-footer {
        display: flex;
        align-items: center;
        gap: $space.3;
        min-block-size: var(--mega-header-height);
        padding: $space.3;
      }

      .sidebar-header {
        border-block-end: $border.subtle;
      }

      .sidebar-footer {
        border-block-start: $border.subtle;
      }

      .brand-mark {
        display: grid;
        place-items: center;
        flex: 0 0 auto;
        inline-size: $controlHeight.md;
        block-size: $controlHeight.md;
        border-radius: $radius.md;
        background: $gradient.brand;
        box-shadow: 0 10px 30px alpha($colors.brand / 28%);
        color: $colors.white;
        rotate: $angle.tilt;
        transition: transform $duration.normal $easing.spring;

        &:hover {
          transform: translateY(-2px) scale(1.04);
          rotate: $angle.zero;
        }
      }

      .sidebar-navigation {
        scrollArea;
        padding: $space.2;
      }

      .sidebar-section + .sidebar-section {
        margin-block-start: $space.4;
      }

      .sidebar-section-title {
        margin: 0 0 $space.2;
        padding-inline: $space.3;
        color: $colors.inkFaint;
        font-size: $typography.textXs;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        transition: opacity $duration.fast ease;
      }

      .sidebar-list {
        display: grid;
        gap: $space.1;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .sidebar-link {
        interactiveSurface;
        display: grid;
        grid-template-columns: $iconSize.md minmax(0, 1fr) auto;
        align-items: center;
        gap: $space.3;
        min-block-size: $controlHeight.md;
        border-color: transparent;
        border-radius: $radius.md;
        padding-inline: $space.3;
        background: transparent;

        :where(svg, [data-icon]) {
          inline-size: $iconSize.md;
          block-size: $iconSize.md;
          color: $colors.inkMuted;
        }

        &:is(:hover, [data-active="true"]) {
          border-color: alpha($colors.brand / 22%);
          background: alpha($colors.brand / 12%);
          color: $colors.white;

          :where(svg, [data-icon]) {
            color: $colors.brandSoft;
          }
        }

        &[aria-current="page"] {
          border-color: alpha($colors.brand / 30%);
          background:
            linear-gradient(90deg, alpha($colors.brand / 18%), transparent),
            $colors.panelRaised;
          box-shadow: inset 3px 0 $colors.brand;
        }

        &:has(.sidebar-badge[data-count="0"]) .sidebar-badge {
          display: none;
        }
      }

      .sidebar-badge {
        min-inline-size: 1.5rem;
        border-radius: $radius.pill;
        padding-inline: $space.2;
        background: $colors.panelSoft;
        color: $colors.inkMuted;
        font-size: $typography.textXs;
        font-variant-numeric: tabular-nums;
        text-align: center;
      }

      .app-main {
        min-inline-size: 0;
        padding: $space.4;
        transition: padding-inline-end $duration.slow $easing.standard;

        x:lg {
          padding: $space.6;
        }

        x:wide {
          padding-inline: $space.10;
        }
      }

      .app-header {
        position: sticky;
        inset-block-start: $space.3;
        z-index: 20;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: $space.4;
        max-inline-size: $layout.contentMax;
        min-block-size: var(--mega-header-height);
        margin-inline: auto;
        border: $border.subtle;
        border-radius: $radius.lg;
        padding-inline: $space.4;
        background: alpha($colors.canvasElevated / 82%);
        box-shadow: $shadow.control;
        backdrop-filter: blur(20px) saturate(1.2);

        &:has(.global-search:focus-within) {
          border-color: alpha($colors.brand / 38%);
          box-shadow: $shadow.focus;
        }
      }

      .global-search {
        display: grid;
        grid-template-columns: auto minmax(8rem, 30rem) auto;
        align-items: center;
        gap: $space.2;
        flex: 1 1 32rem;
        min-block-size: $controlHeight.md;
        border: $border.subtle;
        border-radius: $radius.md;
        padding-inline: $space.3;
        background: alpha($colors.panel / 72%);
        transition: $transition.interactive;

        &:focus-within {
          border-color: $colors.brand;
          background: $colors.panelRaised;
          box-shadow: $shadow.focus;
        }

        input {
          min-inline-size: 0;
          border: 0;
          outline: 0;
          background: transparent;

          &::placeholder {
            color: $colors.inkFaint;
          }
        }
      }

      .page-container {
        container-type: inline-size;
        container-name: page;
        max-inline-size: $layout.contentMax;
        margin-inline: auto;
        padding-block: $space.8;
      }

      .page-heading {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: end;
        gap: $space.6;
        margin-block-end: $space.8;

        h1 {
          max-inline-size: 18ch;
          margin: 0;
          font-size: clamp(2rem, 5cqi, $typography.text3xl);
          line-height: 1.02;
          letter-spacing: -0.045em;
        }

        p {
          max-inline-size: $layout.prose;
          margin: $space.3 0 0;
          color: $colors.inkMuted;
        }

        x:cq(page) {
          grid-template-columns: 1fr;
          align-items: start;
        }
      }

      .metric-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: $space.4;

        x:not(xl) {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        x:not(sm) {
          grid-template-columns: 1fr;
        }
      }

      .metric-card {
        interactiveSurface;
        position: relative;
        isolation: isolate;
        overflow: clip;
        min-block-size: 9rem;
        border-radius: $radius.lg;
        padding: $space.5;
        box-shadow: $shadow.control;

        &::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          background: $gradient.panel;
          pointer-events: none;
        }

        &::after {
          content: "";
          position: absolute;
          inset: auto -20% -55% 35%;
          z-index: -1;
          aspect-ratio: 1;
          border-radius: 50%;
          background: alpha($colors.brand / 16%);
          filter: blur(24px);
        }

        &:hover {
          border-color: alpha($colors.brand / 34%);
          transform: translateY(-3px);
          box-shadow: $shadow.panel;
        }

        &[data-tone="success"]::after {
          background: alpha($colors.success / 18%);
        }

        &[data-tone="warning"]::after {
          background: alpha($colors.warning / 18%);
        }

        &[data-tone="danger"]::after {
          background: alpha($colors.danger / 18%);
        }
      }

      .metric-label {
        color: $colors.inkMuted;
        font-size: $typography.textSm;
        font-weight: 700;
      }

      .metric-value {
        margin-block-start: $space.3;
        font-size: clamp(1.75rem, 4cqi, 2.75rem);
        font-weight: 850;
        letter-spacing: -0.04em;
        line-height: 1;
        font-variant-numeric: tabular-nums;
      }

      .metric-delta {
        display: inline-flex;
        align-items: center;
        gap: $space.1;
        margin-block-start: $space.3;
        border-radius: $radius.pill;
        padding: $space.1 $space.2;
        background: alpha($colors.success / 12%);
        color: $colors.success;
        font-size: $typography.textXs;
        font-weight: 800;

        &[data-direction="down"] {
          background: alpha($colors.danger / 12%);
          color: $colors.danger;
        }
      }

      .dashboard-grid {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(18rem, 1fr);
        gap: $space.4;
        margin-block-start: $space.4;

        x:not(lg) {
          grid-template-columns: 1fr;
        }
      }

      .panel {
        interactiveSurface;
        min-inline-size: 0;
        border-radius: $radius.lg;
        box-shadow: $shadow.control;

        &:has(> .panel-header [data-busy="true"]) {
          cursor: progress;
        }

        &:has(.panel-empty-state:not([hidden])) .panel-body {
          display: grid;
          place-items: center;
          min-block-size: 18rem;
        }
      }

      .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: $space.4;
        min-block-size: 4rem;
        border-block-end: $border.subtle;
        padding: $space.3 $space.4;

        :where(h2, h3) {
          margin: 0;
          font-size: $typography.textLg;
          letter-spacing: -0.02em;
        }
      }

      .panel-body {
        min-inline-size: 0;
        padding: $space.4;
      }

      .chart-shell {
        position: relative;
        min-block-size: 20rem;
        overflow: hidden;
        border-radius: 0 0 $radius.lg $radius.lg;
        background:
          linear-gradient(alpha($colors.border / 22%) 1px, transparent 1px),
          linear-gradient(90deg, alpha($colors.border / 22%) 1px, transparent 1px);
        background-size: 2rem 2rem;

        svg {
          inline-size: 100%;
          block-size: 100%;
          overflow: visible;
        }

        :where(.chart-line, .chart-area) {
          vector-effect: non-scaling-stroke;
        }

        .chart-line {
          fill: none;
          stroke: $colors.brand;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 3;
        }

        .chart-area {
          fill: alpha($colors.brand / 14%);
        }

        .chart-point {
          fill: $colors.panel;
          stroke: $colors.brandSoft;
          stroke-width: 3;
          transition: transform $duration.fast $easing.spring;
          transform-box: fill-box;
          transform-origin: center;

          &:hover {
            transform: scale(1.65);
          }
        }
      }

      .data-table-shell {
        scrollArea;
        border: $border.subtle;
        border-radius: $radius.lg;
        background: $colors.panel;
      }

      .data-table {
        inline-size: 100%;
        border-collapse: separate;
        border-spacing: 0;
        font-size: $typography.textSm;

        :where(th, td) {
          padding: $space.3 $space.4;
          text-align: start;
          vertical-align: middle;
        }

        thead th {
          position: sticky;
          inset-block-start: 0;
          z-index: 2;
          border-block-end: $border.normal;
          background: alpha($colors.panelRaised / 96%);
          color: $colors.inkMuted;
          font-size: $typography.textXs;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          backdrop-filter: blur(14px);
        }

        tbody tr {
          transition: background-color $duration.fast ease;

          &:nth-child(even) {
            background: alpha($colors.white / 0.018);
          }

          &:is(:hover, [data-selected="true"]) {
            background: alpha($colors.brand / 10%);
          }

          &:has(input[type="checkbox"]:checked) {
            background: alpha($colors.brand / 14%);
            box-shadow: inset 3px 0 $colors.brand;
          }

          &:not(:last-child) td {
            border-block-end: $border.subtle;
          }
        }

        td[data-align="numeric"] {
          font-variant-numeric: tabular-nums;
          text-align: end;
        }
      }

      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: $space.2;
        min-block-size: 1.75rem;
        border-radius: $radius.pill;
        padding-inline: $space.2;
        background: alpha($colors.inkMuted / 10%);
        color: $colors.inkMuted;
        font-size: $typography.textXs;
        font-weight: 800;

        &::before {
          content: "";
          inline-size: 0.5rem;
          block-size: 0.5rem;
          border-radius: 50%;
          background: currentColor;
          box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 18%, transparent);
        }

        &[data-status="online"] {
          background: alpha($colors.success / 12%);
          color: $colors.success;
        }

        &[data-status="warning"] {
          background: alpha($colors.warning / 12%);
          color: $colors.warning;
        }

        &[data-status="offline"] {
          background: alpha($colors.danger / 12%);
          color: $colors.danger;
        }
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: $space.4;

        x:not(sm) {
          grid-template-columns: 1fr;
        }
      }

      .field {
        display: grid;
        gap: $space.2;

        &:has(:required) .field-label::after {
          content: " *";
          color: $colors.danger;
        }

        &:has(:user-invalid) .field-control {
          border-color: $colors.danger;
          box-shadow: $shadow.danger;
        }

        &:has(:disabled) {
          opacity: $opacity.disabled;
          cursor: not-allowed;
        }
      }

      .field-label {
        color: $colors.inkMuted;
        font-size: $typography.textSm;
        font-weight: 750;
      }

      .field-control {
        interactiveSurface;
        inline-size: 100%;
        min-block-size: $controlHeight.md;
        border-radius: $radius.md;
        padding: $space.2 $space.3;
        background: $colors.canvasElevated;

        &:is(:hover, :focus-within) {
          border-color: alpha($colors.brand / 48%);
          background: $colors.panelRaised;
        }

        &:focus-within {
          focusRing;
        }

        :where(input, textarea, select) {
          inline-size: 100%;
          border: 0;
          outline: 0;
          background: transparent;
        }

        textarea {
          min-block-size: 8rem;
          resize: vertical;
        }
      }

      .segmented-control {
        display: inline-grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(0, 1fr);
        gap: $space.1;
        border: $border.subtle;
        border-radius: $radius.md;
        padding: $space.1;
        background: $colors.canvasElevated;

        label {
          position: relative;
          display: grid;
          place-items: center;
          min-block-size: $controlHeight.sm;
          border-radius: calc($radius.md - 3px);
          padding-inline: $space.3;
          color: $colors.inkMuted;
          cursor: pointer;
          transition: $transition.interactive;

          &:has(input:checked) {
            background: $colors.panelRaised;
            box-shadow: $shadow.control;
            color: $colors.white;
          }

          input {
            position: absolute;
            opacity: 0;
            pointer-events: none;
          }
        }
      }

      .button {
        interactiveSurface;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: $space.2;
        min-block-size: $controlHeight.md;
        border-radius: $radius.md;
        padding-inline: $space.4;
        font-size: $typography.textSm;
        font-weight: 800;
        line-height: 1;
        cursor: pointer;
        user-select: none;

        &:is(:hover, :focus-visible):not(:disabled) {
          border-color: $colors.borderStrong;
          background: $colors.panelRaised;
          transform: translateY(-1px);
        }

        &:active:not(:disabled) {
          transform: translateY(0) scale(0.985);
        }

        &:disabled,
        &[aria-disabled="true"] {
          opacity: $opacity.disabled;
          cursor: not-allowed;
        }

        &[data-tone="primary"] {
          border-color: transparent;
          background: $gradient.brand;
          color: $colors.white;
          box-shadow: 0 8px 24px alpha($colors.brand / 28%);
        }

        &[data-tone="danger"] {
          border-color: alpha($colors.danger / 34%);
          background: alpha($colors.danger / 14%);
          color: $colors.danger;
        }

        &[data-size="sm"] {
          min-block-size: $controlHeight.sm;
          padding-inline: $space.3;
        }

        &[data-size="lg"] {
          min-block-size: $controlHeight.lg;
          padding-inline: $space.5;
          font-size: $typography.textMd;
        }

        :where(svg, [data-icon]) {
          inline-size: $iconSize.sm;
          block-size: $iconSize.sm;
          flex: 0 0 auto;
        }
      }

      .icon-button {
        display: inline-grid;
        place-items: center;
        inline-size: $controlHeight.md;
        block-size: $controlHeight.md;
        border: $border.subtle;
        border-radius: $radius.md;
        background: transparent;
        color: $colors.inkMuted;
        cursor: pointer;
        transition: $transition.interactive;

        &:is(:hover, :focus-visible) {
          border-color: alpha($colors.brand / 34%);
          background: alpha($colors.brand / 12%);
          color: $colors.white;
        }

        &[data-active="true"] {
          background: $colors.brand;
          color: $colors.white;
        }
      }

      .tabs {
        display: flex;
        gap: $space.1;
        overflow-x: auto;
        border-block-end: $border.subtle;
        scrollbar-width: none;

        &::-webkit-scrollbar {
          display: none;
        }
      }

      .tab {
        position: relative;
        flex: 0 0 auto;
        border: 0;
        padding: $space.3 $space.4;
        background: transparent;
        color: $colors.inkMuted;
        font-weight: 750;
        cursor: pointer;

        &::after {
          content: "";
          position: absolute;
          inset: auto $space.4 -1px;
          block-size: 2px;
          border-radius: $radius.pill;
          background: $colors.brand;
          opacity: 0;
          transform: scaleX(0.5);
          transition: $transition.interactive;
        }

        &:is(:hover, [aria-selected="true"]) {
          color: $colors.white;
        }

        &[aria-selected="true"]::after {
          opacity: 1;
          transform: scaleX(1);
        }
      }

      .command-dialog {
        inline-size: min(calc(100vw - $space.6), $layout.command);
        max-block-size: min(80dvh, 42rem);
        margin: 10dvh auto 0;
        border: $border.normal;
        border-radius: $radius.modal;
        padding: 0;
        background: alpha($colors.canvasElevated / 96%);
        box-shadow: $shadow.modal;
        color: $colors.ink;
        backdrop-filter: blur(28px) saturate(1.35);

        &::backdrop {
          background: rgb(0 0 0 / 0.62);
          backdrop-filter: blur(8px);
        }

        &[open] {
          animation: dialog-enter $duration.slow $easing.spring both;
        }

        &:has(.command-input:not(:placeholder-shown)) .command-empty {
          display: none;
        }
      }

      .command-input-wrap {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: $space.3;
        border-block-end: $border.subtle;
        padding: $space.4;

        input {
          border: 0;
          outline: 0;
          background: transparent;
          font-size: $typography.textLg;
        }
      }

      .command-results {
        scrollArea;
        max-block-size: 30rem;
        padding: $space.2;
      }

      .command-group-label {
        padding: $space.2 $space.3;
        color: $colors.inkFaint;
        font-size: $typography.textXs;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .command-item {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: $space.3;
        min-block-size: $controlHeight.lg;
        border-radius: $radius.md;
        padding-inline: $space.3;
        cursor: pointer;

        &:is(:hover, [aria-selected="true"]) {
          background: alpha($colors.brand / 14%);
        }

        &:has(.command-shortcut) {
          padding-inline-end: $space.2;
        }
      }

      .context-menu,
      .popover-panel {
        min-inline-size: 14rem;
        border: $border.normal;
        border-radius: $radius.md;
        padding: $space.1;
        background: alpha($colors.panelRaised / 96%);
        box-shadow: $shadow.dock;
        color: $colors.ink;
        backdrop-filter: blur(18px);
      }

      .menu-item {
        display: grid;
        grid-template-columns: $iconSize.sm minmax(0, 1fr) auto;
        align-items: center;
        gap: $space.3;
        min-block-size: $controlHeight.sm;
        border-radius: $radius.sm;
        padding-inline: $space.2;
        color: $colors.inkMuted;
        cursor: pointer;

        &:is(:hover, :focus-visible, [data-highlighted="true"]) {
          background: alpha($colors.brand / 14%);
          color: $colors.white;
        }

        &[data-danger="true"] {
          color: $colors.danger;
        }

        &[aria-disabled="true"] {
          opacity: $opacity.disabled;
          pointer-events: none;
        }
      }

      .toast-region {
        position: fixed;
        inset: auto $space.4 $space.4 auto;
        z-index: 100;
        display: grid;
        gap: $space.2;
        inline-size: min(calc(100vw - $space.8), 24rem);
        pointer-events: none;
      }

      .toast {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: start;
        gap: $space.3;
        border: $border.normal;
        border-radius: $radius.lg;
        padding: $space.3;
        background: alpha($colors.panelRaised / 94%);
        box-shadow: $shadow.dock;
        backdrop-filter: blur(18px);
        pointer-events: auto;
        animation: toast-enter $duration.slow $easing.spring both;

        &[data-state="closing"] {
          animation: toast-exit $duration.normal $easing.exit both;
        }

        &[data-tone="success"] {
          border-color: alpha($colors.success / 32%);
        }

        &[data-tone="danger"] {
          border-color: alpha($colors.danger / 36%);
        }
      }

      .timeline {
        display: grid;
        gap: 0;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .timeline-item {
        position: relative;
        display: grid;
        grid-template-columns: 2rem minmax(0, 1fr);
        gap: $space.3;
        padding-block-end: $space.5;

        &::before {
          content: "";
          position: absolute;
          inset: 1rem auto 0 0.9375rem;
          inline-size: 1px;
          background: $colors.border;
        }

        &:last-child::before {
          display: none;
        }

        &:has(.timeline-marker[data-tone="success"])::before {
          background: linear-gradient($colors.success, $colors.border);
        }
      }

      .timeline-marker {
        position: relative;
        z-index: 1;
        display: grid;
        place-items: center;
        inline-size: 2rem;
        block-size: 2rem;
        border: $border.normal;
        border-radius: 50%;
        background: $colors.panelRaised;
        color: $colors.inkMuted;

        &[data-tone="success"] {
          border-color: alpha($colors.success / 42%);
          background: alpha($colors.success / 14%);
          color: $colors.success;
        }
      }

      .kanban-board {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(18rem, 22rem);
        gap: $space.4;
        overflow-x: auto;
        padding-block-end: $space.4;
        scroll-snap-type: x proximity;
        overscroll-behavior-inline: contain;
      }

      .kanban-column {
        display: grid;
        grid-template-rows: auto minmax(8rem, 1fr);
        align-self: start;
        max-block-size: calc(100dvh - 12rem);
        border: $border.subtle;
        border-radius: $radius.lg;
        background: alpha($colors.panel / 76%);
        scroll-snap-align: start;

        &[data-drag-over="true"] {
          border-color: $colors.brand;
          box-shadow: $shadow.focus;
        }
      }

      .kanban-list {
        scrollArea;
        display: grid;
        align-content: start;
        gap: $space.2;
        padding: $space.2;
      }

      .kanban-card {
        border: $border.subtle;
        border-radius: $radius.md;
        padding: $space.3;
        background: $colors.panelRaised;
        box-shadow: $shadow.control;
        cursor: grab;
        transition: $transition.interactive;

        &:hover {
          border-color: alpha($colors.brand / 32%);
          transform: translateY(-2px);
        }

        &[data-dragging="true"] {
          opacity: $opacity.muted;
          rotate: $angle.accent;
          cursor: grabbing;
        }

        &:has(.status-pill[data-status="offline"]) {
          border-color: alpha($colors.danger / 24%);
        }
      }

      .inspector-panel {
        position: fixed;
        inset: $space.3 $space.3 $space.3 auto;
        z-index: 40;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        inline-size: min(calc(100vw - $space.6), $layout.inspector);
        border: $border.normal;
        border-radius: $radius.modal;
        background: alpha($colors.canvasElevated / 96%);
        box-shadow: $shadow.modal;
        backdrop-filter: blur(24px);
        transform: translateX(calc(100% + $space.6));
        transition: transform $duration.slow $easing.spring;

        &[data-open="true"] {
          transform: translateX(0);
        }

        &:has(.inspector-tabs [aria-selected="true"][data-tab="computed"]) {
          --mega-inspector-accent: var(--mega-colors-accent);
        }
      }

      .code-frame {
        position: relative;
        border: $border.subtle;
        border-radius: $radius.lg;
        background: $colors.canvasElevated;
        box-shadow: $shadow.control;

        &:has(pre:focus-within) {
          border-color: alpha($colors.brand / 36%);
          box-shadow: $shadow.focus;
        }
      }

      .code-frame-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: $space.3;
        min-block-size: $controlHeight.md;
        border-block-end: $border.subtle;
        padding-inline: $space.3;
        color: $colors.inkMuted;
      }

      .code-frame pre {
        scrollArea;
        margin: 0;
        padding: $space.4;
        tab-size: 2;
        white-space: pre;

        &[data-wrap="true"] {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }
      }

      .code-line {
        display: grid;
        grid-template-columns: 3rem minmax(0, 1fr);
        min-block-size: 1.5rem;

        &::before {
          content: attr(data-line);
          padding-inline-end: $space.3;
          color: $colors.inkFaint;
          font-variant-numeric: tabular-nums;
          text-align: end;
          user-select: none;
        }

        &[data-highlighted="true"] {
          background: alpha($colors.brand / 10%);
          box-shadow: inset 3px 0 $colors.brand;
        }
      }

      .skeleton {
        position: relative;
        overflow: hidden;
        border-radius: $radius.sm;
        background: $colors.panelSoft;
        color: transparent;

        &::after {
          content: "";
          position: absolute;
          inset: 0;
          background: $gradient.shimmer;
          transform: translateX(-100%);
          animation: skeleton-shimmer 1.4s linear infinite;
        }
      }

      .empty-state {
        display: grid;
        justify-items: center;
        gap: $space.3;
        max-inline-size: 28rem;
        margin-inline: auto;
        padding: $space.8;
        color: $colors.inkMuted;
        text-align: center;

        :where(h2, h3) {
          margin: 0;
          color: $colors.ink;
        }

        p {
          margin: 0;
        }
      }

      supports(backdrop-filter: blur(1px)) {
        .glass-surface {
          background: alpha($colors.panel / 72%);
          backdrop-filter: blur(22px) saturate(1.25);
        }
      }

      supports(selector(:has(*))) {
        .smart-list:has(> :nth-child(n + 8)) {
          max-block-size: 28rem;
          overflow-y: auto;
        }
      }

      @keyframes dialog-enter {
        from {
          opacity: 0;
          transform: translateY(18px) scale(0.97);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes toast-enter {
        from {
          opacity: 0;
          transform: translateX(24px) scale(0.96);
        }
        to {
          opacity: 1;
          transform: translateX(0) scale(1);
        }
      }

      @keyframes toast-exit {
        to {
          opacity: 0;
          transform: translateX(32px) scale(0.94);
        }
      }

      @keyframes skeleton-shimmer {
        to {
          transform: translateX(100%);
        }
      }
    }

    @layer utilities {
      .u-truncate {
        truncateLine;
      }

      .u-scroll-area {
        scrollArea;
      }

      .u-stack {
        display: grid;
        gap: var(--stack-gap, $space.4);
      }

      .u-cluster {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--cluster-gap, $space.3);
      }

      .u-surface {
        border: $border.subtle;
        border-radius: $radius.lg;
        background: $colors.panel;
        box-shadow: $shadow.control;
      }

      .u-full-bleed {
        inline-size: 100vw;
        margin-inline: calc(50% - 50vw);
      }

      .u-prose {
        max-inline-size: $layout.prose;

        :where(h2, h3, h4) {
          margin-block: 1.6em 0.6em;
          line-height: 1.15;
          letter-spacing: -0.025em;
        }

        :where(p, ul, ol, blockquote, pre) {
          margin-block: 1em;
        }

        a {
          color: $colors.brandSoft;
          text-decoration: underline;
          text-decoration-color: alpha($colors.brand / 38%);
          text-underline-offset: 0.2em;
        }
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        scroll-behavior: auto !important;
        animation-duration: 1ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 1ms !important;
      }
    }

    @media (prefers-contrast: more) {
      :root {
        --mega-colors-border: var(--mega-colors-border-strong);
      }

      :where(.button, .field-control, .panel, .data-table-shell) {
        border-width: $borderWidth.strong;
      }
    }

    @media print {
      :where(.app-sidebar, .app-header, .inspector-panel, .toast-region, .button) {
        display: none !important;
      }

      .app-shell,
      .app-main,
      .page-container {
        display: block;
        max-inline-size: none;
        padding: 0;
        background: white;
        color: black;
      }

      .panel,
      .metric-card,
      .data-table-shell {
        break-inside: avoid;
        border: 1px solid #bbb;
        box-shadow: none;
      }
    }
  `

  const validation = validateCss(stylesheet.cssText)
  if (!validation.valid) {
    throw new Error(
      `Cipó typed-theme mega stylesheet failed validation: ${validation.issues.map(issue => issue.message).join('; ')}`,
    )
  }

  return { config, stylesheet, validation }
}
