import { injectStyle, sheet } from "../../cipo/src/index";

export const devtoolsStyles = sheet.css`
  :host {
    all: initial;
    contain: layout style;
  }

  .roderuda-container {
    --rd-safe-bottom: env(safe-area-inset-bottom, 0px);
    --rd-tab-height: 40px;
    --rd-control-height: 40px;
    --rd-radius: 10px;
    --rd-font: -apple-system, system-ui, BlinkMacSystemFont, ".SFNSDisplay-Regular", "Helvetica Neue", "Lucida Grande", "Segoe UI", Tahoma, sans-serif;
    --rd-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    min-width: 320px;
    pointer-events: none;
    position: fixed;
    inset: 0;
    z-index: 2147483646;
    color: var(--foreground);
    font-family: var(--rd-font);
    font-size: 14px;
    line-height: 1.35;
    direction: ltr;
    text-align: left;
  }

  .roderuda-container.roderuda-inline {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 320px;
  }

  .roderuda-container *,
  .roderuda-container *::before,
  .roderuda-container *::after {
    box-sizing: border-box;
    pointer-events: auto;
    -webkit-tap-highlight-color: transparent;
    -webkit-text-size-adjust: none;
  }

  .roderuda-container button,
  .roderuda-container input,
  .roderuda-container textarea,
  .roderuda-container select {
    font: inherit;
    color: inherit;
  }

  .roderuda-container button {
    appearance: none;
    border: 0;
    margin: 0;
  }

  .roderuda-hidden { display: none !important; }
  .roderuda-visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .roderuda-entry-btn {
    touch-action: none;
    position: fixed;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: #000;
    color: #fff;
    opacity: .3;
    z-index: 1000;
    cursor: grab;
    font: 700 23px/1 var(--rd-font);
    transition: opacity .3s, transform .15s;
    box-shadow: 0 4px 18px rgb(0 0 0 / .22);
  }

  .roderuda-entry-btn:hover,
  .roderuda-entry-btn:active,
  .roderuda-entry-btn.roderuda-active {
    opacity: .82;
  }

  .roderuda-entry-btn:active { cursor: grabbing; transform: scale(.96); }

  .roderuda-dev-tools {
    pointer-events: auto;
    position: absolute;
    width: 100%;
    height: 80%;
    left: 0;
    bottom: 0;
    z-index: 500;
    display: none;
    padding-top: var(--rd-tab-height);
    opacity: 0;
    background: var(--background);
    border-top: 1px solid var(--border);
    box-shadow: 0 -18px 60px rgb(0 0 0 / .2);
    transition: opacity .3s;
    overflow: hidden;
  }

  .roderuda-inline .roderuda-dev-tools {
    position: absolute;
    height: 100%;
    display: block;
    opacity: 1;
  }

  .roderuda-resizer {
    position: absolute;
    width: 100%;
    height: 14px;
    left: 0;
    top: -8px;
    touch-action: none;
    cursor: row-resize;
    z-index: 120;
  }

  .roderuda-resizer::after {
    content: "";
    display: block;
    width: 44px;
    height: 4px;
    margin: 3px auto 0;
    border-radius: 999px;
    background: color-mix(in srgb, var(--primary) 35%, transparent);
  }

  .roderuda-tabbar {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: var(--rd-tab-height);
    display: flex;
    align-items: stretch;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    background: var(--darker-background);
    border-bottom: 1px solid var(--border);
    color: var(--primary);
    overscroll-behavior-x: contain;
  }

  .roderuda-tabbar::-webkit-scrollbar { display: none; }

  .roderuda-tab {
    position: relative;
    flex: 0 0 auto;
    min-width: 78px;
    height: 40px;
    padding: 0 10px;
    display: inline-flex;
    gap: 6px;
    align-items: center;
    justify-content: center;
    background: transparent;
    color: inherit;
    cursor: pointer;
    text-transform: capitalize;
    font-size: 12px;
    white-space: nowrap;
    transition: color .2s, background .2s;
  }

  .roderuda-tab:hover { background: color-mix(in srgb, var(--highlight) 70%, transparent); }
  .roderuda-tab.roderuda-selected { color: var(--accent); }
  .roderuda-tab.roderuda-selected::after {
    content: "";
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 0;
    height: 2px;
    border-radius: 2px 2px 0 0;
    background: var(--accent);
  }

  .roderuda-tab-icon { font-size: 15px; line-height: 1; }

  .roderuda-tools {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .roderuda-tool {
    position: absolute;
    inset: 0;
    display: none;
    overflow: hidden;
    background: var(--background);
  }

  .roderuda-tool.roderuda-active { display: block; }

  .roderuda-control {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    z-index: 12;
    height: var(--rd-control-height);
    padding: 7px 8px;
    display: flex;
    align-items: center;
    gap: 5px;
    background: var(--darker-background);
    color: var(--primary);
    border-bottom: 1px solid var(--border);
  }

  .roderuda-control-spacer { flex: 1 1 auto; min-width: 4px; }

  .roderuda-icon-btn,
  .roderuda-text-btn {
    flex: 0 0 auto;
    min-width: 28px;
    height: 28px;
    display: inline-grid;
    place-items: center;
    padding: 0 7px;
    border-radius: 6px;
    background: transparent;
    color: var(--primary);
    cursor: pointer;
    transition: color .18s, background .18s, transform .1s;
  }

  .roderuda-icon-btn { font-size: 17px; }
  .roderuda-text-btn { font-size: 12px; }
  .roderuda-icon-btn:hover,
  .roderuda-text-btn:hover { background: var(--highlight); color: var(--select-foreground); }
  .roderuda-icon-btn:active,
  .roderuda-text-btn:active { transform: scale(.94); color: var(--accent); }
  .roderuda-icon-btn.roderuda-active,
  .roderuda-text-btn.roderuda-active { color: var(--accent); background: var(--highlight); }
  .roderuda-icon-btn:disabled,
  .roderuda-text-btn:disabled { opacity: .45; pointer-events: none; }

  .roderuda-search {
    min-width: 0;
    height: 27px;
    flex: 1 1 120px;
    max-width: 260px;
    padding: 4px 9px;
    border: 1px solid var(--border);
    border-radius: 7px;
    outline: none;
    background: var(--background);
    color: var(--primary);
    user-select: text;
  }

  .roderuda-search:focus { border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 18%, transparent); }

  .roderuda-scroll {
    width: 100%;
    height: 100%;
    overflow: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    scrollbar-color: var(--border) transparent;
  }

  .roderuda-with-control { padding-top: var(--rd-control-height); }

  .roderuda-empty {
    min-height: 180px;
    height: 100%;
    display: grid;
    place-content: center;
    gap: 8px;
    padding: 24px;
    text-align: center;
    color: var(--foreground);
  }

  .roderuda-empty strong { color: var(--primary); font-size: 15px; }

  .roderuda-section {
    margin: 10px;
    border: 1px solid var(--border);
    border-radius: 7px;
    overflow: hidden;
    background: var(--background);
  }

  .roderuda-section-title {
    min-height: 38px;
    padding: 9px 10px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--primary);
    background: var(--darker-background);
    border-bottom: 1px solid var(--border);
    font-weight: 600;
  }

  .roderuda-section-actions { margin-left: auto; display: flex; gap: 3px; }
  .roderuda-section-content { padding: 10px; color: var(--foreground); }

  .roderuda-table-wrap { width: 100%; overflow: auto; -webkit-overflow-scrolling: touch; }
  .roderuda-table {
    width: 100%;
    border-collapse: collapse;
    color: inherit;
    font: 12px/1.4 var(--rd-font);
  }
  .roderuda-table th,
  .roderuda-table td {
    min-height: 30px;
    padding: 7px 9px;
    border-bottom: 1px solid var(--border);
    text-align: left;
    vertical-align: top;
    word-break: break-word;
  }
  .roderuda-table th {
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--darker-background);
    color: var(--primary);
    font-weight: 600;
    white-space: nowrap;
  }
  .roderuda-table tbody tr:hover { background: color-mix(in srgb, var(--highlight) 70%, transparent); }
  .roderuda-table input {
    width: 100%;
    min-width: 80px;
    border: 1px solid transparent;
    border-radius: 4px;
    padding: 3px 5px;
    outline: none;
    background: transparent;
    user-select: text;
  }
  .roderuda-table input:focus { border-color: var(--accent); background: var(--background); }

  .roderuda-notifications {
    position: absolute;
    z-index: 1000;
    top: 48px;
    left: 50%;
    width: min(92%, 440px);
    display: grid;
    gap: 7px;
    transform: translateX(-50%);
    pointer-events: none;
  }

  .roderuda-notification {
    pointer-events: auto;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--primary);
    background: color-mix(in srgb, var(--background) 94%, transparent);
    box-shadow: 0 8px 30px rgb(0 0 0 / .24);
    backdrop-filter: blur(14px);
    animation: roderuda-notify-in .18s ease-out;
  }
  .roderuda-notification[data-type="success"] { border-color: #2e8b57; }
  .roderuda-notification[data-type="warning"] { border-color: var(--console-warn-border); background: var(--console-warn-background); color: var(--console-warn-foreground); }
  .roderuda-notification[data-type="error"] { border-color: var(--console-error-border); background: var(--console-error-background); color: var(--console-error-foreground); }
  @keyframes roderuda-notify-in { from { opacity: 0; transform: translateY(-7px) scale(.98); } }

  .roderuda-modal-root {
    position: absolute;
    inset: 0;
    z-index: 1200;
    display: none;
    place-items: center;
    padding: 16px;
    background: rgb(0 0 0 / .45);
    backdrop-filter: blur(2px);
  }
  .roderuda-modal-root.roderuda-active { display: grid; }
  .roderuda-modal {
    width: min(100%, 480px);
    max-height: min(80vh, 620px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--background);
    box-shadow: 0 24px 90px rgb(0 0 0 / .4);
  }
  .roderuda-modal-title { padding: 13px 14px; color: var(--primary); font-weight: 700; border-bottom: 1px solid var(--border); }
  .roderuda-modal-body { padding: 14px; overflow: auto; color: var(--foreground); user-select: text; }
  .roderuda-modal-input {
    width: 100%;
    margin-top: 12px;
    padding: 9px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    outline: none;
    background: var(--darker-background);
    color: var(--primary);
    user-select: text;
  }
  .roderuda-modal-input:focus { border-color: var(--accent); }
  .roderuda-modal-actions { padding: 10px; display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--border); }
  .roderuda-modal-actions button { min-width: 74px; padding: 8px 11px; border-radius: 6px; background: var(--darker-background); cursor: pointer; }
  .roderuda-modal-actions button[data-primary] { background: var(--accent); color: #fff; }

  /* Console */
  .roderuda-console { padding-bottom: calc(25px + var(--rd-safe-bottom)); }
  .roderuda-console-levels { display: flex; gap: 2px; }
  .roderuda-console-level {
    height: 24px;
    padding: 0 6px;
    border-radius: 5px;
    background: transparent;
    color: var(--foreground);
    cursor: pointer;
    font-size: 11px;
  }
  .roderuda-console-level.roderuda-active { background: var(--highlight); color: var(--select-foreground); }
  .roderuda-console-list { font: 12px/1.45 var(--rd-mono); user-select: text; }
  .roderuda-console-row {
    position: relative;
    min-height: 25px;
    padding: 4px 35px 4px 9px;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 65%, transparent);
    color: var(--foreground);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    user-select: text;
  }
  .roderuda-console-row[data-level="warn"] { background: var(--console-warn-background); color: var(--console-warn-foreground); border-color: var(--console-warn-border); }
  .roderuda-console-row[data-level="error"] { background: var(--console-error-background); color: var(--console-error-foreground); border-color: var(--console-error-border); }
  .roderuda-console-row[data-level="command"] { color: var(--accent); }
  .roderuda-console-row[data-level="result"] { color: var(--primary); }
  .roderuda-console-time { position: absolute; right: 7px; top: 5px; opacity: .55; font: 10px/1.3 var(--rd-font); }
  .roderuda-console-repeat { display: inline-grid; min-width: 18px; height: 18px; place-items: center; margin-right: 5px; padding: 0 4px; border-radius: 9px; background: var(--accent); color: #fff; font: 10px/1 var(--rd-font); }
  .roderuda-console-group { display: inline-block; width: 14px; color: var(--operator-color); }
  .roderuda-console-input-wrap {
    position: absolute;
    z-index: 20;
    left: 0;
    right: 0;
    bottom: 0;
    height: calc(25px + var(--rd-safe-bottom));
    padding-bottom: var(--rd-safe-bottom);
    display: flex;
    align-items: stretch;
    border-top: 1px solid var(--border);
    background: var(--background);
  }
  .roderuda-console-prompt { width: 25px; display: grid; place-items: center; color: var(--accent); font: 700 15px/1 var(--rd-mono); }
  .roderuda-console-input {
    flex: 1;
    min-width: 0;
    padding: 3px 8px 3px 0;
    resize: none;
    outline: none;
    border: 0;
    background: transparent;
    color: var(--primary);
    user-select: text;
    font: 13px/1.4 var(--rd-mono);
  }
  .roderuda-console-input-wrap.roderuda-expanded {
    top: 0;
    height: 100%;
    padding: 40px 0 calc(44px + var(--rd-safe-bottom));
  }
  .roderuda-console-input-wrap.roderuda-expanded .roderuda-console-prompt { display: none; }
  .roderuda-console-input-wrap.roderuda-expanded .roderuda-console-input { padding: 10px; }
  .roderuda-console-editor-actions {
    display: none;
    position: absolute;
    left: 0;
    right: 0;
    bottom: var(--rd-safe-bottom);
    height: 44px;
    border-top: 1px solid var(--border);
    background: var(--darker-background);
  }
  .roderuda-console-input-wrap.roderuda-expanded .roderuda-console-editor-actions { display: flex; }
  .roderuda-console-editor-actions button { flex: 1; background: transparent; border-right: 1px solid var(--border); cursor: pointer; }

  /* Value and object viewer */
  .roderuda-value { user-select: text; }
  .roderuda-value-null,
  .roderuda-value-undefined { color: var(--keyword-color); }
  .roderuda-value-string { color: var(--string-color); }
  .roderuda-value-number,
  .roderuda-value-bigint { color: var(--number-color); }
  .roderuda-value-boolean { color: var(--keyword-color); }
  .roderuda-value-function { color: var(--function-color); }
  .roderuda-value-node { color: var(--tag-name-color); cursor: pointer; }
  .roderuda-value-error { color: var(--console-error-foreground); }
  details.roderuda-object { display: inline; }
  details.roderuda-object > summary { display: inline; cursor: pointer; list-style: none; color: var(--primary); }
  details.roderuda-object > summary::-webkit-details-marker { display: none; }
  details.roderuda-object > summary::before { content: "▸"; display: inline-block; width: 12px; color: var(--operator-color); }
  details.roderuda-object[open] > summary::before { content: "▾"; }
  .roderuda-object-body { margin: 3px 0 3px 15px; border-left: 1px solid var(--border); padding-left: 8px; }
  .roderuda-object-row { min-height: 20px; }
  .roderuda-object-key { color: var(--attribute-name-color); margin-right: 5px; }

  /* Network */
  .roderuda-network-layout { position: relative; height: 100%; }
  .roderuda-network-list { height: 100%; padding-top: 40px; overflow: auto; }
  .roderuda-network-row { cursor: pointer; }
  .roderuda-network-row[data-state="failed"] { background: var(--console-error-background); color: var(--console-error-foreground); }
  .roderuda-network-name { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--primary); }
  .roderuda-network-method { font-weight: 700; }
  .roderuda-network-method[data-method="GET"] { color: #2e8b57; }
  .roderuda-network-method[data-method="POST"] { color: #8a63d2; }
  .roderuda-network-method[data-method="DELETE"] { color: var(--console-error-foreground); }
  .roderuda-status[data-status^="2"] { color: #2e8b57; }
  .roderuda-status[data-status^="3"] { color: #c18401; }
  .roderuda-status[data-status^="4"], .roderuda-status[data-status^="5"] { color: var(--console-error-foreground); }
  .roderuda-detail {
    position: absolute;
    inset: 0;
    z-index: 30;
    display: none;
    padding-top: 40px;
    background: var(--background);
  }
  .roderuda-detail.roderuda-active { display: block; }
  .roderuda-detail-title { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
  .roderuda-detail-body { height: 100%; overflow: auto; padding-bottom: var(--rd-safe-bottom); }
  .roderuda-detail-tabs { position: sticky; top: 0; z-index: 4; display: flex; overflow-x: auto; background: var(--darker-background); border-bottom: 1px solid var(--border); }
  .roderuda-detail-tabs button { flex: 0 0 auto; padding: 9px 12px; background: transparent; cursor: pointer; color: var(--foreground); }
  .roderuda-detail-tabs button.roderuda-active { color: var(--accent); border-bottom: 2px solid var(--accent); }
  .roderuda-detail-pane { display: none; padding: 10px; }
  .roderuda-detail-pane.roderuda-active { display: block; }
  .roderuda-kv { width: 100%; border-collapse: collapse; font-size: 12px; }
  .roderuda-kv td { padding: 6px 8px; border-bottom: 1px solid var(--border); vertical-align: top; word-break: break-word; user-select: text; }
  .roderuda-kv td:first-child { width: 140px; color: var(--var-color); white-space: nowrap; }
  .roderuda-pre { margin: 0; padding: 10px; overflow: auto; white-space: pre-wrap; word-break: break-word; user-select: text; font: 12px/1.5 var(--rd-mono); color: var(--foreground); }

  /* Elements */
  .roderuda-elements-layout { position: relative; height: 100%; }
  .roderuda-elements-tree-wrap { height: 100%; padding: 40px 0 calc(25px + var(--rd-safe-bottom)); overflow: auto; }
  .roderuda-dom-tree { min-width: max-content; padding: 5px 0 12px 12px; font: 12px/1.45 var(--rd-mono); }
  .roderuda-dom-tree ul { margin: 0; padding-left: 15px; list-style: none; }
  .roderuda-dom-row { position: relative; min-height: 20px; padding: 1px 8px 1px 2px; cursor: default; white-space: nowrap; }
  .roderuda-dom-row:hover { background: var(--highlight); }
  .roderuda-dom-row.roderuda-selected { background: var(--contrast); color: var(--select-foreground); }
  .roderuda-dom-toggle { display: inline-block; width: 13px; color: var(--operator-color); cursor: pointer; }
  .roderuda-dom-tag { color: var(--tag-name-color); }
  .roderuda-dom-attr-name { color: var(--attribute-name-color); }
  .roderuda-dom-attr-value { color: var(--string-color); }
  .roderuda-dom-text { color: var(--foreground); white-space: pre; }
  .roderuda-crumbs {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: calc(25px + var(--rd-safe-bottom));
    padding-bottom: var(--rd-safe-bottom);
    display: flex;
    align-items: center;
    overflow-x: auto;
    background: var(--darker-background);
    border-top: 1px solid var(--border);
    font-size: 11px;
    white-space: nowrap;
  }
  .roderuda-crumbs button { padding: 5px 8px; background: transparent; color: var(--primary); cursor: pointer; }
  .roderuda-crumbs button:last-child { background: var(--highlight); }
  .roderuda-element-detail .roderuda-section { margin: 10px 0; border-left: 0; border-right: 0; border-radius: 0; }
  .roderuda-element-attributes { display: grid; gap: 6px; }
  .roderuda-attribute-row { display: grid; grid-template-columns: minmax(80px, .45fr) minmax(120px, 1fr) 30px; gap: 6px; }
  .roderuda-attribute-row input { min-width: 0; padding: 5px 7px; border: 1px solid var(--border); border-radius: 4px; background: var(--background); user-select: text; }
  .roderuda-box-model { min-width: 300px; padding: 10px; text-align: center; font: 11px/1.35 var(--rd-mono); }
  .roderuda-box-layer { margin: 5px; padding: 7px; border: 1px dashed var(--border); background: color-mix(in srgb, var(--highlight) 55%, transparent); }
  .roderuda-box-layer[data-layer="margin"] { background: rgb(246 178 107 / .22); }
  .roderuda-box-layer[data-layer="border"] { background: rgb(255 229 153 / .25); }
  .roderuda-box-layer[data-layer="padding"] { background: rgb(147 196 125 / .24); }
  .roderuda-box-layer[data-layer="content"] { background: rgb(111 168 220 / .24); }
  .roderuda-style-rule { margin-bottom: 9px; padding: 8px; border: 1px solid var(--border); border-radius: 5px; font: 12px/1.45 var(--rd-mono); }
  .roderuda-style-selector { color: var(--tag-name-color); word-break: break-word; }
  .roderuda-style-declaration { display: grid; grid-template-columns: minmax(90px, .45fr) minmax(120px, 1fr); gap: 6px; padding-left: 13px; }
  .roderuda-style-declaration input { min-width: 0; border: 0; outline: none; background: transparent; user-select: text; font: inherit; }
  .roderuda-style-declaration input:first-child { color: var(--var-color); }
  .roderuda-style-declaration input:last-child { color: var(--string-color); }
  .roderuda-listener { margin-bottom: 8px; border: 1px solid var(--border); border-radius: 5px; overflow: hidden; }
  .roderuda-listener strong { display: block; padding: 7px 9px; background: var(--darker-background); color: var(--primary); }
  .roderuda-listener pre { margin: 0; padding: 8px; overflow: auto; user-select: text; font: 11px/1.4 var(--rd-mono); }

  /* Resources */
  .roderuda-resources { padding: 1px 0 calc(10px + var(--rd-safe-bottom)); }
  .roderuda-link-list { margin: 0; padding: 0; list-style: none; font-size: 12px; }
  .roderuda-link-list li { padding: 8px 10px; border-bottom: 1px solid color-mix(in srgb, var(--border) 65%, transparent); word-break: break-all; }
  .roderuda-link-list a { color: var(--link-color); user-select: text; }
  .roderuda-image-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 9px; }
  .roderuda-image-card { min-width: 0; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; cursor: pointer; background: var(--darker-background); }
  .roderuda-image-card img { display: block; width: 100%; height: 90px; object-fit: cover; background: repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 50% / 12px 12px; }
  .roderuda-image-card span { display: block; padding: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; }
  .roderuda-resource-warning { border-color: var(--console-warn-border); }
  .roderuda-resource-warning .roderuda-section-title { background: var(--console-warn-background); color: var(--console-warn-foreground); }

  /* Sources */
  .roderuda-sources { position: relative; height: 100%; overflow: auto; color: var(--foreground); }
  .roderuda-source-breadcrumb { position: sticky; top: 0; z-index: 5; padding: 10px; min-height: 40px; background: var(--darker-background); color: var(--primary); border-bottom: 1px solid var(--border); word-break: break-all; user-select: text; }
  .roderuda-code { margin: 0; min-width: max-content; padding: 10px; user-select: text; font: 12px/1.55 var(--rd-mono); tab-size: 2; }
  .roderuda-code .token-comment { color: var(--comment-color); }
  .roderuda-code .token-string { color: var(--string-color); }
  .roderuda-code .token-number { color: var(--number-color); }
  .roderuda-code .token-keyword { color: var(--keyword-color); }
  .roderuda-code .token-tag { color: var(--tag-name-color); }
  .roderuda-code .token-attr { color: var(--attribute-name-color); }
  .roderuda-line { display: block; min-height: 1.55em; }
  .roderuda-line::before { content: attr(data-line); display: inline-block; width: 3.6em; margin-right: 1em; text-align: right; color: var(--operator-color); opacity: .7; user-select: none; }
  .roderuda-source-image { padding: 20px 10px; text-align: center; }
  .roderuda-source-image img { max-width: 100%; max-height: 70vh; }
  .roderuda-source-image p { color: var(--foreground); font-size: 12px; }
  .roderuda-source-iframe { width: 100%; height: 100%; border: 0; background: #fff; }
  .roderuda-source-object { padding: 10px; font: 12px/1.5 var(--rd-mono); }

  /* Info and snippets */
  .roderuda-cards { padding: 1px 0 calc(10px + var(--rd-safe-bottom)); }
  .roderuda-info-card,
  .roderuda-snippet-card { margin: 10px; border: 1px solid var(--border); border-radius: 7px; overflow: hidden; }
  .roderuda-card-title { position: relative; padding: 9px 40px 4px 10px; color: var(--accent); font-weight: 600; }
  .roderuda-card-content { padding: 7px 10px 10px; color: var(--foreground); font-size: 12px; word-break: break-word; user-select: text; }
  .roderuda-card-content * { user-select: text; }
  .roderuda-card-content a { color: var(--link-color); }
  .roderuda-card-copy { position: absolute; right: 7px; top: 5px; }
  .roderuda-snippet-card { cursor: pointer; transition: transform .1s; }
  .roderuda-snippet-card:active { transform: scale(.99); }
  .roderuda-snippet-name { padding: 9px 10px; display: flex; align-items: center; gap: 8px; color: var(--primary); background: var(--darker-background); font-weight: 600; }
  .roderuda-snippet-description { padding: 9px 10px; color: var(--foreground); font-size: 12px; }

  /* Settings */
  .roderuda-settings { padding: 1px 0 calc(10px + var(--rd-safe-bottom)); }
  .roderuda-setting { padding: 10px; border-bottom: 1px solid var(--border); }
  .roderuda-setting:hover { background: color-mix(in srgb, var(--highlight) 65%, transparent); }
  .roderuda-setting-title { color: var(--primary); font-weight: 600; line-height: 1.4; }
  .roderuda-setting-description { margin-bottom: 8px; color: var(--foreground); font-size: 12px; }
  .roderuda-setting-control { display: flex; align-items: center; gap: 9px; }
  .roderuda-setting input[type="checkbox"] { appearance: none; width: 16px; height: 16px; margin: 0; border: 1px solid var(--border); border-radius: 3px; background: var(--background); }
  .roderuda-setting input[type="checkbox"]:checked { border-color: var(--accent); background: var(--accent); box-shadow: inset 0 0 0 3px var(--background); }
  .roderuda-setting input[type="range"] { flex: 1; accent-color: var(--accent); }
  .roderuda-setting input[type="number"],
  .roderuda-setting select { min-width: 90px; max-width: 100%; padding: 5px 7px; border: 1px solid var(--border); border-radius: 5px; background: var(--background); color: var(--primary); }
  .roderuda-setting button { padding: 7px 10px; border: 1px solid var(--border); border-radius: 5px; background: var(--background); color: var(--accent); cursor: pointer; }
  .roderuda-setting-separator { height: 10px; border-bottom: 1px solid var(--border); background: var(--darker-background); }
  .roderuda-setting-text { padding: 10px; color: var(--foreground); font-size: 12px; }

  /* Search snippet */
  .roderuda-search-highlight-block { display: inline; }
  .roderuda-search-highlight-block .roderuda-keyword { background: var(--console-warn-background); color: var(--console-warn-foreground); }

  @media (min-width: 680px) {
    .roderuda-elements-layout > .roderuda-elements-tree-side { width: 50%; border-right: 1px solid var(--border); }
    .roderuda-elements-layout > .roderuda-element-detail { display: block; width: 50%; left: auto; right: 0; border-left: 1px solid var(--border); }
    .roderuda-element-detail .roderuda-control [data-action="back"] { display: none; }
  }

  @media (max-width: 520px) {
    .roderuda-tab { min-width: 58px; padding-inline: 7px; }
    .roderuda-tab-label { display: none; }
    .roderuda-tab-icon { font-size: 17px; }
    .roderuda-control { padding-inline: 5px; gap: 2px; }
    .roderuda-network-table th:nth-child(4),
    .roderuda-network-table td:nth-child(4),
    .roderuda-network-table th:nth-child(5),
    .roderuda-network-table td:nth-child(5) { display: none; }
    .roderuda-kv td:first-child { width: 105px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .roderuda-container *, .roderuda-container *::before, .roderuda-container *::after {
      animation-duration: .001ms !important;
      transition-duration: .001ms !important;
    }
  }
`;

export function installDevtoolsStyles(target: ShadowRoot | HTMLElement | Document): HTMLStyleElement {
  return injectStyle(target, devtoolsStyles, { dedupe: true, position: "prepend" });
}
