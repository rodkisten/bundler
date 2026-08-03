import { isDevtoolsNode, describeNode } from "@rodkisten/devtools/utils";
import { mapArray } from "@rodkisten/nascente";

const HIGHLIGHT_DURATION = 850;
const OVERLAY_CLASS = "__roderuda-overlay__";
const INTERNAL_ATTRIBUTE = "data-roderuda-internal";
const BOX_COUNT = 4;

type Sides = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type DOMRectLike = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export class ElementHighlighter {
  private host: HTMLDivElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private label: HTMLDivElement | null = null;
  private boxes: HTMLDivElement[] = [];

  private selected: Element | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;

  private frame = 0;
  private hideTimer = 0;
  private trackingCleanup: (() => void) | null = null;

  private showLabel = true;
  private destroyed = false;

  constructor(private readonly devtoolsHost?: HTMLElement | null) {}

  highlight(
    element: Element,
    label = true,
    duration = HIGHLIGHT_DURATION,
  ): void {
    if (this.destroyed) return;
    if (!this.canHighlight(element)) return;

    this.ensure();

    this.selected = element;
    this.showLabel = label;

    this.stopTracking();
    this.draw();

    /*
     * duration <= 0 representa o modo persistente de inspeção.
     *
     * Highlights temporários não precisam manter listeners e observers vivos,
     * evitando trabalho desnecessário no Safari móvel.
     */
    if (!Number.isFinite(duration) || duration <= 0) {
      this.startTracking(element);
    }

    this.scheduleHide(duration);
  }

  hide(): void {
    this.selected = null;

    this.stopTracking();
    this.cancelScheduledDraw();
    this.cancelScheduledHide();

    this.removeHost();
  }

  destroy(): void {
    if (this.destroyed) return;

    this.destroyed = true;
    this.hide();
  }

  private canHighlight(element: Element): boolean {
    if (!element.isConnected) return false;
    if (isDevtoolsNode(element, this.devtoolsHost)) return false;

    /*
     * closest() não atravessa Shadow DOM. Portanto, também verificamos a raiz
     * e o host da raiz para impedir que o highlighter destaque a si próprio.
     */
    if (element.closest?.(`.${OVERLAY_CLASS}`)) return false;

    const root = element.getRootNode();

    if (root instanceof ShadowRoot) {
      const rootHost = root.host;

      if (
        rootHost instanceof Element &&
        (
          rootHost.classList.contains(OVERLAY_CLASS) ||
          rootHost.hasAttribute(INTERNAL_ATTRIBUTE)
        )
      ) {
        return false;
      }
    }

    return true;
  }

  private ensure(): void {
    if (
      this.host?.isConnected &&
      this.shadowRoot &&
      this.boxes.length === BOX_COUNT &&
      this.label
    ) {
      return;
    }

    this.removeHost();

    const host = document.createElement("div");

    host.className = OVERLAY_CLASS;
    host.setAttribute(INTERNAL_ATTRIBUTE, "highlighter");
    host.setAttribute("aria-hidden", "true");
    host.setAttribute("role", "presentation");
    host.tabIndex = -1;

    /*
     * Não usamos inset: 0, width: 100vw ou height: 100vh.
     *
     * O host ocupa apenas 1px e os elementos visuais internos são fixed.
     * Assim não existe uma superfície de tela inteira participando de
     * hit-testing, composição ou seleção.
     */
    host.style.setProperty("position", "fixed", "important");
    host.style.setProperty("left", "0", "important");
    host.style.setProperty("top", "0", "important");
    host.style.setProperty("width", "1px", "important");
    host.style.setProperty("height", "1px", "important");
    host.style.setProperty("margin", "0", "important");
    host.style.setProperty("padding", "0", "important");
    host.style.setProperty("border", "0", "important");
    host.style.setProperty("overflow", "visible", "important");
    host.style.setProperty("pointer-events", "none", "important");
    host.style.setProperty("user-select", "none", "important");
    host.style.setProperty("-webkit-user-select", "none", "important");
    host.style.setProperty("touch-action", "none", "important");
    host.style.setProperty("z-index", "2147483580", "important");
    host.style.setProperty("background", "transparent", "important");
    host.style.setProperty("opacity", "1", "important");
    host.style.setProperty("visibility", "visible", "important");
    host.style.setProperty("transform", "none", "important");
    host.style.setProperty("filter", "none", "important");
    host.style.setProperty("backdrop-filter", "none", "important");
    host.style.setProperty("-webkit-backdrop-filter", "none", "important");
    host.style.setProperty("contain", "none", "important");
    host.style.setProperty("isolation", "isolate", "important");

    /*
     * inert reforça que o overlay nunca deve participar de foco, eventos ou
     * navegação assistiva. Nem todos os navegadores antigos o implementam,
     * então pointer-events continua sendo a garantia principal.
     */
    try {
      host.inert = true;
    } catch {
      host.setAttribute("inert", "");
    }

    const shadowRoot = host.attachShadow({ mode: "closed" });

    const style = document.createElement("style");

    style.textContent = `
      :host,
      :host *,
      :host *::before,
      :host *::after {
        pointer-events: none !important;
        user-select: none !important;
        -webkit-user-select: none !important;
        touch-action: none !important;
        box-sizing: border-box !important;
      }

      .rd-highlight-box {
        position: fixed !important;
        display: block !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 0 !important;
        min-width: 0 !important;
        min-height: 0 !important;
        max-width: none !important;
        max-height: none !important;
        overflow: visible !important;
        visibility: visible !important;
        opacity: 1 !important;
        transform: none !important;
        transform-origin: 0 0 !important;
        transition: none !important;
        animation: none !important;
        will-change: auto !important;
        pointer-events: none !important;
        z-index: 1 !important;
      }

      .rd-highlight-label {
        position: fixed !important;
        display: block !important;
        margin: 0 !important;
        padding: 5px 7px !important;
        border: 0 !important;
        border-radius: 4px !important;
        max-width: min(90vw, 520px) !important;
        min-width: 0 !important;
        min-height: 0 !important;
        overflow: hidden !important;
        visibility: visible !important;
        opacity: 1 !important;
        background: #111 !important;
        color: #fff !important;
        box-shadow: 0 3px 14px rgb(0 0 0 / 35%) !important;
        font: 12px/1.3 ui-monospace, SFMono-Regular, Menlo, Monaco,
          Consolas, "Liberation Mono", "Courier New", monospace !important;
        font-weight: 500 !important;
        letter-spacing: 0 !important;
        text-align: left !important;
        text-transform: none !important;
        text-decoration: none !important;
        white-space: nowrap !important;
        text-overflow: ellipsis !important;
        transform: none !important;
        transition: none !important;
        animation: none !important;
        pointer-events: none !important;
        z-index: 2 !important;
      }

      .rd-highlight-label[hidden] {
        display: none !important;
      }
    `;

    shadowRoot.appendChild(style);

    const layers = [
      {
        background: "rgb(246 178 107 / 32%)",
        outline: "rgb(246 178 107 / 90%)",
      },
      {
        background: "rgb(255 229 153 / 36%)",
        outline: "rgb(255 229 153 / 90%)",
      },
      {
        background: "rgb(147 196 125 / 36%)",
        outline: "rgb(147 196 125 / 90%)",
      },
      {
        background: "rgb(111 168 220 / 38%)",
        outline: "rgb(111 168 220 / 92%)",
      },
    ];

    const boxes = mapArray(layers, ({ background, outline }) => {
      const box = document.createElement("div");

      box.className = "rd-highlight-box";
      box.setAttribute("aria-hidden", "true");

      box.style.setProperty("background", background, "important");
      box.style.setProperty(
        "outline",
        `1px solid ${outline}`,
        "important",
      );

      shadowRoot.appendChild(box);

      return box;
    });

    const label = document.createElement("div");

    label.className = "rd-highlight-label";
    label.setAttribute("aria-hidden", "true");
    label.hidden = true;

    shadowRoot.appendChild(label);

    const mountTarget = document.documentElement ?? document.body;

    if (!mountTarget) return;

    mountTarget.appendChild(host);

    this.host = host;
    this.shadowRoot = shadowRoot;
    this.boxes = boxes;
    this.label = label;
  }

  private startTracking(element: Element): void {
    const redraw = () => this.scheduleDraw();

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(redraw);

      try {
        this.resizeObserver.observe(element);
      } catch {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      }
    }

    /*
     * Alterações de classe/style no elemento podem mudar sua geometria sem
     * necessariamente disparar ResizeObserver, por exemplo transformações.
     */
    if (typeof MutationObserver !== "undefined") {
      this.mutationObserver = new MutationObserver(redraw);

      try {
        this.mutationObserver.observe(element, {
          attributes: true,
          attributeFilter: ["class", "style", "hidden", "open"],
        });
      } catch {
        this.mutationObserver.disconnect();
        this.mutationObserver = null;
      }
    }

    /*
     * scroll em capture detecta scroll de qualquer contêiner rolável, não só
     * window. Isso é essencial para inspecionar elementos dentro de painéis.
     */
    window.addEventListener("scroll", redraw, {
      capture: true,
      passive: true,
    });

    window.addEventListener("resize", redraw, {
      passive: true,
    });

    window.addEventListener("orientationchange", redraw, {
      passive: true,
    });

    const viewport = window.visualViewport;

    viewport?.addEventListener("resize", redraw, {
      passive: true,
    });

    viewport?.addEventListener("scroll", redraw, {
      passive: true,
    });

    this.trackingCleanup = () => {
      window.removeEventListener("scroll", redraw, true);
      window.removeEventListener("resize", redraw);
      window.removeEventListener("orientationchange", redraw);

      viewport?.removeEventListener("resize", redraw);
      viewport?.removeEventListener("scroll", redraw);
    };
  }

  private stopTracking(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    this.mutationObserver?.disconnect();
    this.mutationObserver = null;

    this.trackingCleanup?.();
    this.trackingCleanup = null;
  }

  private scheduleHide(duration: number): void {
    this.cancelScheduledHide();

    if (!Number.isFinite(duration) || duration <= 0) return;

    this.hideTimer = window.setTimeout(() => {
      this.hideTimer = 0;
      this.hide();
    }, duration);
  }

  private scheduleDraw(): void {
    if (this.frame) return;

    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  private cancelScheduledDraw(): void {
    if (!this.frame) return;

    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private cancelScheduledHide(): void {
    if (!this.hideTimer) return;

    window.clearTimeout(this.hideTimer);
    this.hideTimer = 0;
  }

  private draw(): void {
    const element = this.selected;

    if (
      !element ||
      !element.isConnected ||
      !this.host?.isConnected ||
      !this.label ||
      this.boxes.length !== BOX_COUNT
    ) {
      this.hide();
      return;
    }

    let rect: DOMRect;
    let computedStyle: CSSStyleDeclaration;

    try {
      rect = element.getBoundingClientRect();
      computedStyle = getComputedStyle(element);
    } catch {
      this.hide();
      return;
    }

    if (!isFiniteRect(rect)) {
      this.hide();
      return;
    }

    const margin = readSides(computedStyle, "margin");
    const border = readSides(computedStyle, "border");
    const padding = readSides(computedStyle, "padding");

    /*
     * Camadas, da mais externa para a mais interna:
     *
     * 0. margem
     * 1. borda
     * 2. padding
     * 3. conteúdo
     */
    const layers: DOMRectLike[] = [
      expand(rect, margin),
      normalizeRect(rect),
      shrink(rect, border),
      shrink(rect, addSides(border, padding)),
    ];

    for (let index = 0; index < this.boxes.length; index += 1) {
      const box = this.boxes[index];
      const layer = layers[index];

      if (!box || !layer) continue;

      applyFixedRect(box, layer);
    }

    this.drawLabel(element, rect);
  }

  private drawLabel(element: Element, rect: DOMRect): void {
    const label = this.label;

    if (!label) return;

    label.hidden = !this.showLabel;

    if (!this.showLabel) return;

    label.textContent = describeNode(element);

    /*
     * Primeiro deixamos o label mensurável em uma posição neutra. Isso evita
     * presumir que ele sempre possui 260x26px.
     */
    label.style.setProperty("left", "0px", "important");
    label.style.setProperty("top", "0px", "important");

    const labelRect = label.getBoundingClientRect();
    const viewport = getViewportRect();

    const labelWidth = Math.max(1, labelRect.width);
    const labelHeight = Math.max(1, labelRect.height);

    const preferredTop = rect.top - labelHeight - 4;
    const fallbackTop = rect.bottom + 4;

    const top = preferredTop >= viewport.top + 2
      ? preferredTop
      : fallbackTop + labelHeight <= viewport.bottom - 2
        ? fallbackTop
        : clamp(
            rect.top,
            viewport.top + 2,
            viewport.bottom - labelHeight - 2,
          );

    const left = clamp(
      rect.left,
      viewport.left + 2,
      viewport.right - labelWidth - 2,
    );

    label.style.setProperty(
      "left",
      `${roundDevicePixel(left)}px`,
      "important",
    );

    label.style.setProperty(
      "top",
      `${roundDevicePixel(top)}px`,
      "important",
    );
  }

  private removeHost(): void {
    this.host?.remove();

    this.host = null;
    this.shadowRoot = null;
    this.label = null;
    this.boxes = [];
  }
}

function readSides(
  style: CSSStyleDeclaration,
  type: "margin" | "border" | "padding",
): Sides {
  const suffix = type === "border" ? "Width" : "";

  return {
    top: parseCssNumber(
      style[
        `${type}Top${suffix}` as keyof CSSStyleDeclaration
      ] as string,
    ),
    right: parseCssNumber(
      style[
        `${type}Right${suffix}` as keyof CSSStyleDeclaration
      ] as string,
    ),
    bottom: parseCssNumber(
      style[
        `${type}Bottom${suffix}` as keyof CSSStyleDeclaration
      ] as string,
    ),
    left: parseCssNumber(
      style[
        `${type}Left${suffix}` as keyof CSSStyleDeclaration
      ] as string,
    ),
  };
}

function parseCssNumber(value: string): number {
  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function addSides(left: Sides, right: Sides): Sides {
  return {
    top: left.top + right.top,
    right: left.right + right.right,
    bottom: left.bottom + right.bottom,
    left: left.left + right.left,
  };
}

function normalizeRect(rect: DOMRect): DOMRectLike {
  return {
    left: rect.left,
    top: rect.top,
    width: Math.max(0, rect.width),
    height: Math.max(0, rect.height),
  };
}

function expand(rect: DOMRect, sidesValue: Sides): DOMRectLike {
  return {
    left: rect.left - sidesValue.left,
    top: rect.top - sidesValue.top,
    width: Math.max(
      0,
      rect.width + sidesValue.left + sidesValue.right,
    ),
    height: Math.max(
      0,
      rect.height + sidesValue.top + sidesValue.bottom,
    ),
  };
}

function shrink(rect: DOMRect, sidesValue: Sides): DOMRectLike {
  return {
    left: rect.left + sidesValue.left,
    top: rect.top + sidesValue.top,
    width: Math.max(
      0,
      rect.width - sidesValue.left - sidesValue.right,
    ),
    height: Math.max(
      0,
      rect.height - sidesValue.top - sidesValue.bottom,
    ),
  };
}

function applyFixedRect(
  element: HTMLElement,
  rect: DOMRectLike,
): void {
  element.style.setProperty(
    "left",
    `${roundDevicePixel(rect.left)}px`,
    "important",
  );

  element.style.setProperty(
    "top",
    `${roundDevicePixel(rect.top)}px`,
    "important",
  );

  element.style.setProperty(
    "width",
    `${roundDevicePixel(Math.max(0, rect.width))}px`,
    "important",
  );

  element.style.setProperty(
    "height",
    `${roundDevicePixel(Math.max(0, rect.height))}px`,
    "important",
  );
}

function getViewportRect(): {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
} {
  const viewport = window.visualViewport;

  if (viewport) {
    const left = viewport.offsetLeft;
    const top = viewport.offsetTop;

    return {
      left,
      top,
      right: left + viewport.width,
      bottom: top + viewport.height,
      width: viewport.width,
      height: viewport.height,
    };
  }

  return {
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function isFiniteRect(rect: DOMRect): boolean {
  return (
    Number.isFinite(rect.left) &&
    Number.isFinite(rect.top) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height)
  );
}

function roundDevicePixel(value: number): number {
  const ratio = window.devicePixelRatio || 1;

  return Math.round(value * ratio) / ratio;
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (maximum < minimum) return minimum;

  return Math.min(maximum, Math.max(minimum, value));
}
