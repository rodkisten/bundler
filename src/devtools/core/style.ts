import { css, sheet } from "../../cipo/src/index";
import { insertCss, setRuntimeStyleTarget } from "../../cipo/src/injection";
import type { CipoCssArtifact, CipoInlineCssArtifact, CipoStylesheetArtifact } from "../../cipo/src/types";

/* *************** */
/* Design system   */
/* *************** */

setRuntimeStyleTarget(null);

export const devtoolsTokens = css`
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

  @alias rdTextEllipsis {
    overflow: hidden
    text-overflow: ellipsis
    text(nowrap)
  }

  @alias rdPanelSurface {
    bg: $background
    bor: 1px solid $border
  }
`;

export const devtoolsStyles = sheet.css`
  :host {
    all: initial
    contain: layout style
    color-scheme: dark light
  }

  .roderuda-container {
    $$safeBottom: env(safe-area-inset-bottom, 0px)
    $$tabHeight: 40px
    $$controlHeight: 40px
    $$entrySize: 40px
    $$entryZ: 1000
    $$toolsZ: 500
    $$overlayZ: 1200

    minw: 320px
    pointer-events: none
    pos(fixed, inset: 0)
    z: 2147483646
    color: $foreground
    font-family: $font.ui
    font-size: 14px
    line-height: 1.35
    direction: ltr
    text-align: left

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
    pos(absolute, left: 0, bottom: 0)
    w: 100%
    h: 80%
    z: $$toolsZ
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
    pos(absolute)
    h: 100%
    display: block
    opacity: 1
  }

  .roderuda-resizer {
    pos(absolute, left: 0, top: -8px)
    w: 100%
    h: 14px
    touch-action: none
    cursor: row-resize
    z: 120

    &::after {
      content: ""
      display: block
      w: 44px
      h: 4px
      m: 3px auto 0
      rounded: $pill
      bg: mix($primary, transparent, 35%)
    }
  }

  .roderuda-tabbar {
    pos(absolute, left: 0, right: 0, top: 0)
    h: $$tabHeight
    display: flex
    items-stretch
    overflow-x: auto
    overflow-y: hidden
    noScrollbar
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
    font-size: 15px
    line-height: 1
  }

  .roderuda-tools,
  .roderuda-tool,
  .roderuda-network-layout,
  .roderuda-elements-layout,
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
    controlStrip
  }

  .roderuda-control-spacer {
    flex: 1 1 auto
    minw: 4px
  }

  .roderuda-icon-btn,
  .roderuda-text-btn {
    rdControlButton

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
    rdInput
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
  .roderuda-elements-tree-wrap,
  .roderuda-source-breadcrumb,
  .roderuda-source-object {
    touchScroll
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
    rdPanelSurface
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
    rdPanelSurface
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
    rdInput
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

  /* Console visuals live in panels/console.ts as named Cipó styled components. */

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

  .roderuda-network-list,
  .roderuda-elements-tree-wrap {
    h: 100%
    pt: 40px
    overflow: auto
  }

  .roderuda-elements-tree-wrap {
    pb: calc(25px + $$safeBottom)
  }

  .roderuda-network-row { cursor: pointer }
  .roderuda-network-row[data-state="failed"] { bg: $errorBg; color: $errorFg }
  .roderuda-network-name { maxw: 300px; rdTextEllipsis; color: $primary }
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

  .roderuda-detail-title { minw: 0; flex: 1; rdTextEllipsis; font-size: 12px }
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

  .roderuda-dom-tree {
    minw: max-content
    p: 5px 0 12px 12px
    font: 12px / 1.45 $font.mono

    ul {
      m: 0
      pl: 15px
      list-style: none
    }
  }

  .roderuda-dom-row {
    relative
    minh: 20px
    p: 1px 8px 1px 2px
    cursor: default
    text(nowrap)

    &:hover { bg: $highlight }

    &.roderuda-selected {
      bg: $contrast
      color: $selectedForeground
    }
  }

  .roderuda-dom-toggle { inline-block; w: 13px; color: $operator; cursor: pointer }
  .roderuda-dom-tag { color: $tag }
  .roderuda-dom-attr-name { color: $attr }
  .roderuda-dom-attr-value { color: $string }
  .roderuda-dom-text { color: $foreground; white-space: pre }

  .roderuda-crumbs {
    pos(absolute, left: 0, right: 0, bottom: 0)
    h: calc(25px + $$safeBottom)
    pb: $$safeBottom
    display: flex
    items-center
    overflow-x: auto
    bg: $backgroundDark
    border-top: 1px solid $border
    font-size: 11px
    text(nowrap)

    button {
      p: 5px 8px
      bg: transparent
      color: $primary
      cursor: pointer

      &:last-child { bg: $highlight }
    }
  }

  .roderuda-element-detail .roderuda-section {
    m: 10px 0
    border-left: 0
    border-right: 0
    rounded: 0
  }

  .roderuda-element-attributes { display: grid; gap: 6px }

  .roderuda-attribute-row {
    display: grid
    grid-template(cols: minmax(80px, .45fr) minmax(120px, 1fr) 30px)
    gap: 6px

    input {
      minw: 0
      p: 5px 7px
      bor: 1px solid $border
      rounded: $sm
      bg: $background
      select(text)
    }
  }

  .roderuda-box-model {
    minw: 300px
    p: 10px
    text-align: center
    font: 11px / 1.35 $font.mono
  }

  .roderuda-box-layer {
    m: 5px
    p: 7px
    border: 1px dashed $border
    bg: mix($highlight, transparent, 55%)

    &[data-layer="margin"] { bg: rgb(246 178 107 / .22) }
    &[data-layer="border"] { bg: rgb(255 229 153 / .25) }
    &[data-layer="padding"] { bg: rgb(147 196 125 / .24) }
    &[data-layer="content"] { bg: rgb(111 168 220 / .24) }
  }

  .roderuda-style-rule,
  .roderuda-listener {
    mb: 9px
    p: 8px
    bor: 1px solid $border
    rounded: $md
    font: 12px / 1.45 $font.mono
  }

  .roderuda-style-selector { color: $tag; break(word) }

  .roderuda-style-declaration {
    display: grid
    grid-template(cols: minmax(90px, .45fr) minmax(120px, 1fr))
    gap: 6px
    pl: 13px

    input {
      minw: 0
      border: 0
      outline: none
      bg: transparent
      select(text)
      font: inherit

      &:first-child { color: $var }
      &:last-child { color: $string }
    }
  }

  .roderuda-listener {
    p: 0
    overflow: hidden

    strong {
      display: block
      p: 7px 9px
      bg: $backgroundDark
      color: $primary
    }

    pre {
      m: 0
      p: 8px
      overflow: auto
      select(text)
      font: 11px / 1.4 $font.mono
    }
  }

  .roderuda-resources,
  .roderuda-cards,
  .roderuda-settings {
    p: 1px 0 calc(10px + $$safeBottom)
  }

  .roderuda-link-list {
    m: 0
    p: 0
    list-style: none
    font-size: 12px

    li {
      p: 8px 10px
      border-bottom: 1px solid mix($border, transparent, 65%)
      word-break: break-all
    }

    a {
      color: $link
      select(text)
    }
  }

  .roderuda-image-list {
    display: grid
    grid-template(cols: repeat(auto-fill, minmax(110px, 1fr)))
    gap: 9px
  }

  .roderuda-image-card {
    minw: 0
    bor: 1px solid $border
    rounded: $control
    overflow: hidden
    cursor: pointer
    bg: $backgroundDark

    img {
      display: block
      w: 100%
      h: 90px
      object-fit: cover
      bg: repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 50% / 12px 12px
    }

    span {
      display: block
      p: 6px
      rdTextEllipsis
      font-size: 10px
    }
  }

  .roderuda-resource-warning {
    border-color: $warningBorder

    .roderuda-section-title {
      bg: $warningBg
      color: $warningFg
    }
  }

  .roderuda-sources {
    overflow: auto
    color: $foreground
  }

  .roderuda-source-breadcrumb {
    sticky
    top: 0
    z: 5
    p: 10px
    minh: 40px
    bg: $backgroundDark
    color: $primary
    border-bottom: 1px solid $border
    word-break: break-all
    select(text)
  }

  .roderuda-code {
    m: 0
    minw: max-content
    p: 10px
    select(text)
    font: 12px / 1.55 $font.mono
    tab-size: 2

    .token-comment { color: $comment }
    .token-string { color: $string }
    .token-number { color: $number }
    .token-keyword { color: $keyword }
    .token-tag { color: $tag }
    .token-attr { color: $attr }
  }

  .roderuda-line {
    display: block
    minh: 1.55em

    &::before {
      content: attr(data-line)
      inline-block
      w: 3.6em
      mr: 1em
      text-align: right
      color: $operator
      opacity: .7
      select(none)
    }
  }

  .roderuda-source-image {
    p: 20px 10px
    text-align: center

    img {
      maxw: 100%
      maxh: 70vh
    }

    p {
      color: $foreground
      font-size: 12px
    }
  }

  .roderuda-source-iframe {
    w: 100%
    h: 100%
    border: 0
    bg: white
  }

  .roderuda-card-title {
    relative
    p: 9px 40px 4px 10px
    color: $accent
    font-weight: 600
  }

  .roderuda-card-content {
    p: 7px 10px 10px
    color: $foreground
    font-size: 12px
    break(word)
    select(text)

    * { select(text) }
    a { color: $link }
  }

  .roderuda-card-copy { pos(absolute, right: 7px, top: 5px) }
  .roderuda-snippet-card { cursor: pointer; transition: transform .1s }
  .roderuda-snippet-card:active { transform: scale(.99) }
  .roderuda-snippet-description { p: 9px 10px; color: $foreground; font-size: 12px }

  .roderuda-setting {
    p: 10px
    border-bottom: 1px solid $border

    &:hover { bg: mix($highlight, transparent, 65%) }

    input[type="checkbox"] {
      appearance: none
      w: 16px
      h: 16px
      m: 0
      bor: 1px solid $border
      rounded: $xs
      bg: $background

      &:checked {
        border-color: $accent
        bg: $accent
        shadow: inset 0 0 0 3px $background
      }
    }

    input[type="range"] {
      flex: 1
      accent-color: $accent
    }

    input[type="number"],
    select {
      minw: 90px
      maxw: 100%
      p: 5px 7px
      bor: 1px solid $border
      rounded: $md
      bg: $background
      color: $primary
    }

    button {
      p: 7px 10px
      bor: 1px solid $border
      rounded: $md
      bg: $background
      color: $accent
      cursor: pointer
    }
  }

  .roderuda-setting-title {
    color: $primary
    font-weight: 600
    line-height: 1.4
  }

  .roderuda-setting-description {
    mb: 8px
    color: $foreground
    font-size: 12px
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

  x:md {
    .roderuda-elements-layout > .roderuda-elements-tree-side {
      w: 50%
      border-right: 1px solid $border
    }

    .roderuda-elements-layout > .roderuda-element-detail {
      display: block
      w: 50%
      left: auto
      right: 0
      border-left: 1px solid $border
    }

    .roderuda-element-detail .roderuda-control [data-action="back"] {
      display: none
    }
  }

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

export type DevtoolsStyleArtifact = CipoCssArtifact | CipoInlineCssArtifact | CipoStylesheetArtifact;

export function installDevtoolsStyles(
  target: ShadowRoot | HTMLElement | Document,
  additionalStyles: readonly DevtoolsStyleArtifact[] = [],
): HTMLStyleElement {
  const style = setRuntimeStyleTarget(target);
  insertStyleArtifact(devtoolsStyles);
  for (let index = 0; index < additionalStyles.length; index += 1) insertStyleArtifact(additionalStyles[index]!);
  if (!style) throw new Error("[RodEruda] Unable to install styles");
  return style;
}

function insertStyleArtifact(style: DevtoolsStyleArtifact): void {
  insertCss(style.kind === "cipo.inline-css" || style.kind === "cipo.stylesheet" ? style.cssText : style.compiledCss);
}
