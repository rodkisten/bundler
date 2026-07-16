import { copyText, escapeHtml, icon, isDevtoolsNode, safeStringify, setStyles } from "@rodkisten/devtools/utils";
import { html, render } from "@rodkisten/devtools/core-runtime";
import { Tool } from "@rodkisten/devtools/tool";
import type { SnippetItem, ToolContext } from "@rodkisten/devtools/types";
import { type SnippetsModel, type SnippetsViewModel } from "@rodkisten/devtools/panels-snippets-components";
import { OverlayController } from "@rodkisten/devtools/panels-snippets";

export function openWindow(title: string, body: string): Window | null {
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) return null;
  popup.document.write(`<!doctype html><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:#101114;color:#eee;margin:0;padding:20px}pre{white-space:pre-wrap;word-break:break-word}table{border-collapse:collapse;width:100%}th,td{padding:7px;border:1px solid #3b3d42;text-align:left}</style><h1>${escapeHtml(title)}</h1>${body}`);
  popup.document.close();
  return popup;
}

export function addBorderOverlay(): OverlayController {
  const style = document.createElement("style");
  style.dataset.roderudaSnippet = "border-all";
  style.textContent = `*{outline:2px dashed #707d8b!important;outline-offset:-3px!important}`;
  document.documentElement.append(style);
  return { stop: () => style.remove() };
}

export function startMonitor(): OverlayController {
  const panel = document.createElement("div");
  panel.dataset.roderudaSnippet = "monitor";
  setStyles(panel.style, {
    position: "fixed",
    inset: "8px 8px auto auto",
    zIndex: "2147483647",
    padding: "8px 10px",
    borderRadius: "7px",
    background: "rgba(12,13,16,.9)",
    color: "#dfe4ea",
    font: "11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace",
    pointerEvents: "none",
    whiteSpace: "pre",
    boxShadow: "0 8px 28px rgba(0,0,0,.35)",
  });
  document.documentElement.append(panel);
  let frames = 0;
  let previous = performance.now();
  let fps = 0;
  let raf = 0;
  let stopped = false;
  const render = (now: number) => {
    if (stopped) return;
    frames += 1;
    if (now - previous >= 500) {
      fps = Math.round((frames * 1000) / (now - previous));
      frames = 0;
      previous = now;
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      panel.textContent = [
        `FPS   ${String(fps).padStart(3, " ")}`,
        `DOM   ${document.getElementsByTagName("*").length}`,
        `HEAP  ${memory ? `${(memory.usedJSHeapSize / 1048576).toFixed(1)} MiB` : "n/a"}`,
        `VIEW  ${innerWidth} × ${innerHeight}`,
      ].join("\n");
    }
    raf = requestAnimationFrame(render);
  };
  raf = requestAnimationFrame(render);
  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      panel.remove();
    },
  };
}

export function startTouchVisualizer(): OverlayController {
  const layer = document.createElement("div");
  layer.dataset.roderudaSnippet = "touches";
  setStyles(layer.style, { position: "fixed", inset: "0", pointerEvents: "none", zIndex: "2147483647" });
  document.documentElement.append(layer);
  const circles = new Map<number, HTMLElement>();
  const render = (event: TouchEvent) => {
    const active = new Set<number>();
    for (const touch of Array.from(event.touches)) {
      active.add(touch.identifier);
      let circle = circles.get(touch.identifier);
      if (!circle) {
        circle = document.createElement("div");
        setStyles(circle.style, {
          position: "absolute",
          width: "42px",
          height: "42px",
          margin: "-21px 0 0 -21px",
          borderRadius: "50%",
          border: "2px solid #55d6ff",
          background: "rgba(85,214,255,.18)",
          boxShadow: "0 0 0 4px rgba(0,0,0,.22)",
        });
        layer.append(circle);
        circles.set(touch.identifier, circle);
      }
      circle.style.transform = `translate(${touch.clientX}px,${touch.clientY}px)`;
    }
    for (const [id, circle] of circles) {
      if (!active.has(id)) {
        circle.remove();
        circles.delete(id);
      }
    }
  };
  document.addEventListener("touchstart", render, true);
  document.addEventListener("touchmove", render, true);
  document.addEventListener("touchend", render, true);
  document.addEventListener("touchcancel", render, true);
  return {
    stop() {
      document.removeEventListener("touchstart", render, true);
      document.removeEventListener("touchmove", render, true);
      document.removeEventListener("touchend", render, true);
      document.removeEventListener("touchcancel", render, true);
      layer.remove();
    },
  };
}

export function featureRows(): Array<[string, boolean]> {
  return [
    ["Web Components", "customElements" in window],
    ["Shadow DOM", "attachShadow" in Element.prototype],
    ["Service Worker", "serviceWorker" in navigator],
    ["WebSocket", "WebSocket" in window],
    ["WebRTC", "RTCPeerConnection" in window],
    ["WebGL 2", Boolean(document.createElement("canvas").getContext("webgl2"))],
    ["WebGPU", "gpu" in navigator],
    ["IndexedDB", "indexedDB" in window],
    ["Cache Storage", "caches" in window],
    ["Clipboard API", "clipboard" in navigator],
    ["File System Access", "showOpenFilePicker" in window],
    ["View Transitions", "startViewTransition" in document],
    ["Container Queries", CSS.supports("container-type", "inline-size")],
    [":has()", CSS.supports("selector(:has(*))")],
  ];
}
