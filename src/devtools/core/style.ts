import { sheet } from "../../cipo/src/index";
import { STYLE_ELEMENT_ID } from "../../cipo/src/constants";
import { getCssText, injectStyle, setRuntimeStyleTarget } from "../../cipo/src/injection";
import type {
  CipoCssArtifact,
  CipoInlineCssArtifact,
  CipoInjectableStyleArtifact,
  CipoStylesheetArtifact,
} from "../../cipo/src/types";
import { bootstrapDevtoolsCipo } from "./cipo-bootstrap";

/* *************** */
/* Design system   */
/* *************** */

bootstrapDevtoolsCipo();

export const devtoolsStyles = sheet.css`
  @cipo {
    prefix: rd;
    layers: false;
    minify: true;
    rem: 16px;
    color-mode: oklch;
    theme-root: :host;
    theme-validation: warn;
  }

  @theme {
    zIndex<number>: (
      container: 9999999
      button: $container + 10 
    ); 
    colors<color>: (
      background: var(--background),
      backgroundDark: var(--darker-background),
      foreground: var(--foreground),
      primary: var(--primary),
      accent: var(--accent),
      border: var(--border),
      highlight: var(--highlight),
      contrast: var(--contrast),
      selectedForeground: var(--select-foreground),
      link: var(--link-color),
      success: #2e8b57,
      danger: var(--console-error-foreground),
      post: #8a63d2,
      statusRedirect: #c18401,
      warningBg: var(--console-warn-background),
      warningFg: var(--console-warn-foreground),
      warningBorder: var(--console-warn-border),
      errorBg: var(--console-error-background),
      errorFg: var(--console-error-foreground),
      errorBorder: var(--console-error-border),
      operator: var(--operator-color),
      keyword: var(--keyword-color),
      string: var(--string-color),
      number: var(--number-color),
      function: var(--function-color),
      tag: var(--tag-name-color),
      attr: var(--attribute-name-color),
      var: var(--var-color),
      comment: var(--comment-color)
    );

    spacing<size>: 0.25rem;

    radius<length>: (
      xs: 3px,
      sm: 4px,
      md: 5px,
      control: 6px,
      section: 7px,
      notification: 8px,
      panel: 10px,
      modal: 10px,
      pill: 999px
    );

    shadow<shadow>: (
      entry: 0 4px 18px rgb(0 0 0 / .22),
      panel: 0 -18px 60px rgb(0 0 0 / .2),
      notification: 0 8px 30px rgb(0 0 0 / .24),
      modal: 0 24px 90px rgb(0 0 0 / .4)
    );

    font<font>: (
      ui: -apple-system, system-ui, BlinkMacSystemFont, ".SFNSDisplay-Regular", "Helvetica Neue", "Lucida Grande", "Segoe UI", Tahoma, sans-serif,
      mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", monospace
    );
  }

  @breakpoints {
    xs: 520px;
    md: 680px;
  }

  @alias touchScroll {
    overscroll(contain)
    -webkit-overflow-scrolling: touch
  }

  @alias noScrollbar {
    scrollbar-width: none
    &::-webkit-scrollbar { display: none }
  }

  @alias controlStrip {
    display: flex
    items-center
    gap: 5px
    bg: $backgroundDark
    color: $primary
    border-bottom: 1px solid $border
  }

  @alias rdControlButton {
    flex: 0 0 auto
    minw: 28px
    h: 28px
    inline-grid
    place-items: center
    p: 0 7px
    rounded: $control
    bg: transparent
    color: $primary
    cursor: pointer
    transition: color .18s, background .18s, transform .1s
  }

  @alias rdInput {
    minw: 0
    bor: 1px solid $border
    outline: none
    bg: $background
    color: $primary
    select(text)
  }

  @alias rdCodeText {
    font: 12px / 1.45 $font.mono
    select(text)
  }

  @alias overflow: hidden; text-overflow: ellipsis; white-space: nowrap {
    overflow: hidden
    text-overflow: ellipsis
    text(nowrap)
  }

  @alias rdPanelSurface {
    bg: $background
    bor: 1px solid $border
  }

  :host {
    contain: layout style
    color-scheme: dark light
    user-select: none
    -webkit-user-select: none
    -webkit-touch-callout: none

    input, textarea, pre, code, [contenteditable="true"], .cm-editor, .cm-content {
      user-select: text
      -webkit-user-select: text
      -webkit-touch-callout: default
    }

    $$safeBottom: env(safe-area-inset-bottom, 0px)
    --rd-safe-bottom: max(env(safe-area-inset-bottom, 0px), 10px)
    $$tabHeight: 40px
    $$controlHeight: 40px
    $$entrySize: 40px
    $$entryZ: 2147483647
    $$toolsZ: 500
    $$overlayZ: 1200

    --rd-colors-background: var(--background)
    --rd-colors-backgroundDark: var(--darker-background)
    --rd-colors-foreground: var(--foreground)
    --rd-colors-primary: var(--primary)
    --rd-colors-accent: var(--accent)
    --rd-colors-border: var(--border)
    --rd-colors-highlight: var(--highlight)
    --rd-colors-contrast: var(--contrast)
    --rd-colors-selectedForeground: var(--select-foreground)
    --rd-colors-link: var(--link-color)
    --rd-colors-success: #2e8b57
    --rd-colors-danger: var(--console-error-foreground)
    --rd-colors-post: #8a63d2
    --rd-colors-statusRedirect: #c18401
    --rd-colors-warningBg: var(--console-warn-background)
    --rd-colors-warningFg: var(--console-warn-foreground)
    --rd-colors-warningBorder: var(--console-warn-border)
    --rd-colors-errorBg: var(--console-error-background)
    --rd-colors-errorFg: var(--console-error-foreground)
    --rd-colors-errorBorder: var(--console-error-border)
    --rd-colors-operator: var(--operator-color)
    --rd-colors-keyword: var(--keyword-color)
    --rd-colors-string: var(--string-color)
    --rd-colors-number: var(--number-color)
    --rd-colors-function: var(--function-color)
    --rd-colors-tag: var(--tag-name-color)
    --rd-colors-attr: var(--attribute-name-color)
    --rd-colors-var: var(--var-color)
    --rd-colors-comment: var(--comment-color)

    --rd-radius-xs: 3px
    --rd-radius-sm: 4px
    --rd-radius-md: 5px
    --rd-radius-control: 6px
    --rd-radius-section: 7px
    --rd-radius-notification: 8px
    --rd-radius-panel: 10px
    --rd-radius-modal: 10px
    --rd-radius-pill: 999px

    --rd-shadow-entry: 0 4px 18px rgb(0 0 0 / .22)
    --rd-shadow-panel: 0 -18px 60px rgb(0 0 0 / .2)
    --rd-shadow-notification: 0 8px 30px rgb(0 0 0 / .24)
    --rd-shadow-modal: 0 24px 90px rgb(0 0 0 / .4)

    --rd-font-ui: -apple-system, system-ui, BlinkMacSystemFont, ".SFNSDisplay-Regular", "Helvetica Neue", "Lucida Grande", "Segoe UI", Tahoma, sans-serif
    --rd-font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", monospace
  }
  
  .roderuda-container {
    minw: 200px
    pointer-events: none
    pos(fixed, inset: 0)
    z: $zIndex.container
    isolation: isolate
    contain: layout style paint
    color: $foreground
    font-family: $font.ui
    font-size: 14px
    line-height: 1.35
    direction: ltr
    text-align: left
    

    & *:not(input,pre,code,textarea) {
      !user-select: none
    }

    &.roderuda-inline {
      pos(relative)
      w: 100%
      h: 100%
      minh: 320px
    }

  }


  .roderuda-container * {
    box-sizing: border-box
    pointer-events: auto
    -webkit-tap-highlight-color: transparent
    -webkit-text-size-adjust: none
  }

  .roderuda-container *::before {
    box-sizing: border-box
    pointer-events: auto
    -webkit-tap-highlight-color: transparent
    -webkit-text-size-adjust: none
  }

  .roderuda-container *::after {
    box-sizing: border-box
    pointer-events: auto
    -webkit-tap-highlight-color: transparent
    -webkit-text-size-adjust: none
  }

  .roderuda-container button,
  .roderuda-container input,
  .roderuda-container textarea,
  .roderuda-container select {
    font: inherit
    color: inherit
  }

  .roderuda-container button {
    appearance: none
    border: 0
    m: 0
  }

  .roderuda-hidden {
    display: none !important
  }

  .roderuda-visually-hidden {
    pos(absolute)
    w: 1px
    h: 1px
    p: 0
    m: -1px
    overflow: hidden
    clip: rect(0, 0, 0, 0)
    text(nowrap)
    border: 0
  }

  .roderuda-entry-btn {
    touch-action: none
    pos(fixed)
    w: $$entrySize
    h: $$entrySize
    display: grid
    place-items: center
    rounded: $panel
    bg: black
    color: white
    opacity: .3
    z: $$entryZ
    cursor: grab
    font: 700 23px / 1 $font.ui
    transition: opacity .3s, transform .15s
    shadow: $shadow.entry

    &:hover,
    &:active,
    &.roderuda-active {
      opacity: .82
    }

    &:active {
      cursor: grabbing
      transform: scale(.96)
    }
  }

  .roderuda-dev-tools {
    pointer-events: auto
    pos(absolute, left: 0, bottom: var(--rd-safe-bottom))
    w: 100%
    h: calc(80% - var(--rd-safe-bottom))
    z: 2147483645
    display: none
    pt: $$tabHeight
    opacity: 0
    bg: $background
    border-top: 1px solid $border
    shadow: $shadow.panel
    transition: opacity .3s
    overflow: hidden
  }

  .roderuda-inline .roderuda-dev-tools {
    pos(absolute, bottom: 0)
    h: 100%
    display: block
    opacity: 1
  }

  .roderuda-resizer {
    pos(absolute, left: 0, top: -18px)
    w: 100%
    h: 30px
    touch-action: none
    cursor: row-resize
    z: 2147483647

    &::after {
      content: ""
      display: block
      w: 64px
      h: 6px
      m: 12px auto 0
      rounded: $pill
      bg: mix($primary, transparent, 55%)
      shadow: $shadow.entry
    }
  }

  .roderuda-tabbar {
    pos(absolute, left: 0, right: 0, top: 0)
    h: $$tabHeight
    display: flex
    items-stretch
    overflow-x: auto
    overflow-y: hidden
    scrollbar-width: none

    &::-webkit-scrollbar { display: none }
    bg: $backgroundDark
    border-bottom: 1px solid $border
    color: $primary
    overscroll-behavior-x: contain
  }

  .roderuda-tab {
    relative
    flex: 0 0 auto
    minw: 78px
    h: 40px
    px: 10px
    inline-flex
    gap: 6px
    items-center
    justify-center
    bg: transparent
    color: inherit
    cursor: pointer
    text-transform: capitalize
    font-size: 12px
    text(nowrap)
    transition: color .2s, background .2s

    &:hover { bg: mix($highlight, transparent, 70%) }

    &.roderuda-selected {
      color: $accent

      &::after {
        content: ""
        pos(absolute, left: 8px, right: 8px, bottom: 0)
        h: 2px
        rounded: 2px 2px 0 0
        bg: $accent
      }
    }
  }

  .roderuda-tab-icon {
    display: inline-grid
    place-items: center
    font-size: 15px
    line-height: 1
  }

  .roderuda-lucide-icon {
    display: block
    flex: 0 0 auto
    width: 1em
    height: 1em
    stroke: currentColor
  }

  .roderuda-tools,
  .roderuda-tool,
  .roderuda-network-layout,
  .roderuda-sources {
    relative
    w: 100%
    h: 100%
    overflow: hidden
  }

  .roderuda-tool {
    pos(absolute, inset: 0)
    display: none
    bg: $background

    &.roderuda-active { display: block }
  }

  .roderuda-control {
    pos(absolute, left: 0, right: 0, top: 0)
    z: 12
    h: $$controlHeight
    p: 7px 8px
    display: flex
    align-items: center
    gap: 5px
    background: $backgroundDark
    color: $primary
    border-bottom: 1px solid $border
  }

  .roderuda-control-spacer {
    flex: 1 1 auto
    minw: 4px
  }

  .roderuda-icon-btn,
  .roderuda-text-btn {
    flex: 0 0 auto
    min-width: 28px
    height: 28px
    display: inline-grid
    place-items: center
    padding: 0 7px
    border-radius: $control
    background: transparent
    color: $primary
    cursor: pointer
    transition: color .18s, background .18s, transform .1s

    &:hover {
      bg: $highlight
      color: $selectedForeground
    }

    &:active {
      transform: scale(.94)
      color: $accent
    }

    &.roderuda-active {
      color: $accent
      bg: $highlight
    }

    &:disabled {
      opacity: .45
      pointer-events: none
    }
  }

  .roderuda-icon-btn { font-size: 17px }
  .roderuda-text-btn { font-size: 12px }

  .roderuda-search {
    min-width: 0
    border: 1px solid $border
    outline: none
    background: $background
    color: $primary
    user-select: text
    h: 27px
    flex: 1 1 120px
    maxw: 260px
    p: 4px 9px
    rounded: $section

    &:focus {
      border-color: $accent
      shadow: 0 0 0 2px mix($accent, transparent, 18%)
    }
  }

  .roderuda-scroll,
  .roderuda-table-wrap,
  .roderuda-detail-body,
  .roderuda-source-breadcrumb,
  .roderuda-source-object {
    overscroll-behavior: contain
    -webkit-overflow-scrolling: touch
  }

  .roderuda-scroll {
    w: 100%
    h: 100%
    overflow: auto
    scrollbar-color: $border transparent
  }

  .roderuda-with-control { pt: $$controlHeight }

  .roderuda-empty {
    minh: 180px
    h: 100%
    display: grid
    place-content: center
    gap: 8px
    p: 24px
    text-align: center
    color: $foreground

    strong {
      color: $primary
      font-size: 15px
    }
  }

  .roderuda-section,
  .roderuda-info-card,
  .roderuda-snippet-card {
    m: 10px
    background: $background
    border: 1px solid $border
    rounded: $section
    overflow: hidden
  }

  .roderuda-section-title,
  .roderuda-snippet-name {
    minh: 38px
    p: 9px 10px
    display: flex
    items-center
    gap: 8px
    color: $primary
    bg: $backgroundDark
    border-bottom: 1px solid $border
    font-weight: 600
  }

  .roderuda-section-actions {
    ml: auto
    display: flex
    gap: 3px
  }

  .roderuda-section-content {
    p: 10px
    color: $foreground
  }

  .roderuda-table-wrap { w: 100%; overflow: auto }

  .roderuda-table,
  .roderuda-kv {
    w: 100%
    border-collapse: collapse
  }

  .roderuda-table {
    color: inherit
    font: 12px / 1.4 $font.ui

    tbody tr:hover { bg: mix($highlight, transparent, 70%) }

    input {
      w: 100%
      minw: 80px
      bor: 1px solid transparent
      rounded: $sm
      p: 3px 5px
      outline: none
      bg: transparent
      select(text)

      &:focus {
        border-color: $accent
        bg: $background
      }
    }
  }

  .roderuda-table th {
    minh: 30px
    p: 7px 9px
    border-bottom: 1px solid $border
    text-align: left
    vertical-align: top
    break(word)
    sticky
    top: 0
    z: 2
    bg: $backgroundDark
    color: $primary
    font-weight: 600
    text(nowrap)
  }

  .roderuda-table td {
    minh: 30px
    p: 7px 9px
    border-bottom: 1px solid $border
    text-align: left
    vertical-align: top
    break(word)
  }

  .roderuda-notifications {
    pos(absolute, top: 48px, left: 50%)
    z: 1000
    w: min(92%, 440px)
    display: grid
    gap: 7px
    transform: translateX(-50%)
    pointer-events: none
  }

  .roderuda-notification {
    pointer-events: auto
    p: 10px 12px
    bor: 1px solid $border
    rounded: $notification
    color: $primary
    bg: mix($background, transparent, 94%)
    shadow: $shadow.notification
    backdrop-filter: blur(14px)
    animation: roderuda-notify-in .18s ease-out

    &[data-type="success"] { border-color: $success }
    &[data-type="warning"] { border-color: $warningBorder; bg: $warningBg; color: $warningFg }
    &[data-type="error"] { border-color: $errorBorder; bg: $errorBg; color: $errorFg }
  }

  @keyframes roderuda-notify-in {
    from { opacity: 0; transform: translateY(-7px) scale(.98) }
  }

  .roderuda-modal-root {
    pos(absolute, inset: 0)
    z: $$overlayZ
    display: none
    place-items: center
    p: 16px
    bg: rgb(0 0 0 / .45)
    backdrop-filter: blur(2px)

    &.roderuda-active { display: grid }
  }

  .roderuda-modal {
    w: min(100%, 480px)
    maxh: min(80vh, 620px)
    display: flex
    flex-direction: column
    overflow: hidden
    background: $background
    border: 1px solid $border
    rounded: $modal
    shadow: $shadow.modal
  }

  .roderuda-modal-title {
    p: 13px 14px
    color: $primary
    font-weight: 700
    border-bottom: 1px solid $border
  }

  .roderuda-modal-body {
    p: 14px
    overflow: auto
    color: $foreground
    select(text)
  }

  .roderuda-modal-input {
    min-width: 0
    border: 1px solid $border
    outline: none
    background: $background
    color: $primary
    user-select: text
    w: 100%
    mt: 12px
    p: 9px 10px
    rounded: $control
    bg: $backgroundDark

    &:focus { border-color: $accent }
  }

  .roderuda-modal-actions {
    p: 10px
    display: flex
    justify-content: flex-end
    gap: 8px
    border-top: 1px solid $border

    button {
      minw: 74px
      p: 8px 11px
      rounded: $control
      bg: $backgroundDark
      cursor: pointer

      &[data-primary] {
        bg: $accent
        color: white
      }
    }
  }

  .roderuda-value { select(text) }
  .roderuda-value-null,
  .roderuda-value-undefined,
  .roderuda-value-boolean { color: $keyword }
  .roderuda-value-string { color: $string }
  .roderuda-value-number,
  .roderuda-value-bigint { color: $number }
  .roderuda-value-function { color: $function }
  .roderuda-value-node { color: $tag; cursor: pointer }
  .roderuda-value-error { color: $errorFg }

  details.roderuda-object {
    display: inline

    > summary {
      display: inline
      cursor: pointer
      list-style: none
      color: $primary

      &::-webkit-details-marker { display: none }

      &::before {
        content: "▸"
        inline-block
        w: 12px
        color: $operator
      }
    }

    &[open] > summary::before { content: "▾" }
  }

  .roderuda-object-body {
    m: 3px 0 3px 15px
    border-left: 1px solid $border
    pl: 8px
  }

  .roderuda-object-row { minh: 20px }
  .roderuda-object-key { color: $attr; mr: 5px }

  .roderuda-network-list {
    h: 100%
    pt: 40px
    overflow: auto
  }

  .roderuda-network-row { cursor: pointer }
  .roderuda-network-row[data-state="failed"] { bg: $errorBg; color: $errorFg }
  .roderuda-network-name { maxw: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: $primary }
  .roderuda-network-method { font-weight: 700 }
  .roderuda-network-method[data-method="GET"],
  .roderuda-status[data-status^="2"] { color: $success }
  .roderuda-network-method[data-method="POST"] { color: $post }
  .roderuda-network-method[data-method="DELETE"],
  .roderuda-status[data-status^="4"],
  .roderuda-status[data-status^="5"] { color: $errorFg }
  .roderuda-status[data-status^="3"] { color: $statusRedirect }

  .roderuda-detail {
    pos(absolute, inset: 0)
    z: 30
    display: none
    pt: 40px
    bg: $background

    &.roderuda-active { display: block }
  }

  .roderuda-detail-title { minw: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px }
  .roderuda-detail-body { h: 100%; overflow: auto; pb: $$safeBottom }

  .roderuda-detail-tabs {
    sticky
    top: 0
    z: 4
    display: flex
    overflow-x: auto
    bg: $backgroundDark
    border-bottom: 1px solid $border

    button {
      flex: 0 0 auto
      p: 9px 12px
      bg: transparent
      cursor: pointer
      color: $foreground

      &.roderuda-active {
        color: $accent
        border-bottom: 2px solid $accent
      }
    }
  }

  .roderuda-detail-pane {
    display: none
    p: 10px

    &.roderuda-active { display: block }
  }

  .roderuda-kv {
    font-size: 12px

    td {
      p: 6px 8px
      border-bottom: 1px solid $border
      vertical-align: top
      break(word)
      select(text)

      &:first-child {
        w: 140px
        color: $var
        text(nowrap)
      }
    }
  }

  .roderuda-pre,
  .roderuda-source-object {
    m: 0
    p: 10px
    overflow: auto
    white-space: pre-wrap
    break(word)
    select(text)
    font: 12px / 1.5 $font.mono
    color: $foreground
  }

  .roderuda-source-editor,
  .roderuda-source-codemirror {
    h: 100%
    minw: 0
  }

  .roderuda-source-codemirror .cm-editor {
    h: calc(100% - 28px)
    bg: $background
    color: $foreground
    outline: none
  }

  .roderuda-setting-control {
    display: flex
    items-center
    gap: 9px
  }

  .roderuda-setting-separator {
    h: 10px
    border-bottom: 1px solid $border
    bg: $backgroundDark
  }

  .roderuda-setting-text {
    p: 10px
    color: $foreground
    font-size: 12px
  }

  .roderuda-search-highlight-block { display: inline }
  .roderuda-search-highlight-block .roderuda-keyword { bg: $warningBg; color: $warningFg }


  x:not(xs) {
    .roderuda-tab {
      minw: 58px
      padding-inline: 7px
    }

    .roderuda-tab-label { display: none }
    .roderuda-tab-icon { font-size: 17px }
    .roderuda-control { padding-inline: 5px; gap: 2px }

    .roderuda-network-table th:nth-child(4),
    .roderuda-network-table td:nth-child(4),
    .roderuda-network-table th:nth-child(5),
    .roderuda-network-table td:nth-child(5) {
      display: none
    }

    .roderuda-kv td:first-child { w: 105px }
  }

  reduce-motion {
    .roderuda-container * {
      animation-duration: .001ms !important
      transition-duration: .001ms !important
    }

    .roderuda-container *::before {
      animation-duration: .001ms !important
      transition-duration: .001ms !important
    }

    .roderuda-container *::after {
      animation-duration: .001ms !important
      transition-duration: .001ms !important
    }
  }
`;

/** Side-effect import used by panels to ensure the devtools theme sheet is evaluated. */
export const devtoolsTokens = devtoolsStyles;

export type DevtoolsStyleArtifact = CipoCssArtifact | CipoInlineCssArtifact | CipoStylesheetArtifact;

export function installDevtoolsStyles(
  target: ShadowRoot | HTMLElement | Document,
  additionalStyles: readonly DevtoolsStyleArtifact[] = [],
): HTMLStyleElement {
  bootstrapDevtoolsCipo();

  // Point Cipó's runtime sink at the mount target so atomic/styled CSS compiled
  // during module evaluation (and any later inserts) land inside the shadow
  // root instead of document.head.
  setRuntimeStyleTarget(target);

  const parent = target instanceof Document ? target.head : target;
  parent.querySelectorAll?.('style[data-roderuda-devtools-style="true"]').forEach((node) => node.remove());

  const runtimeCssText = getCssText().trim();
  const artifacts: CipoInjectableStyleArtifact[] = [];

  // Always fold the runtime stylesheet into the installed tag when present.
  // Skipping it when raw `$token`s appear left styled-component classes without
  // rules in the shadow root. Prefer shipping the CSS (browser ignores invalid
  // declarations) over dropping the whole runtime sheet.
  if (runtimeCssText) {
    artifacts.push({ kind: "cipo.stylesheet", cssText: runtimeCssText });
  }

  artifacts.push(devtoolsStyles, ...additionalStyles);

  const style = injectStyle(target, artifacts, { dedupe: false, position: "prepend" });
  style.dataset.roderudaDevtoolsStyle = "true";

  // Keep a single runtime sink inside the target; drop any leftover document
  // head copy that may have been created before the shadow target was known.
  if (!(target instanceof Document)) {
    const orphan = document.getElementById(STYLE_ELEMENT_ID);
    if (orphan && orphan.parentElement === document.head) orphan.remove();
  }

  if (!style.textContent?.trim()) throw new Error("[RodEruda] Unable to install styles");
  return style;
}
