import { ConfigStore } from "../core/config";
import { debounce, delegate, isDevtoolsNode } from "../core/dom";
import { plainText } from "../core/serialize";
import { Tool } from "../tool";
import type { SourcePayload, ToolContext } from "../types";
import { html, render } from "../components/runtime";
import {
  capabilityItems,
  capabilitySectionTemplate,
  cookieSectionTemplate,
  formatJsonValue,
  imageSectionTemplate,
  linkSectionTemplate,
  resourcesStyleArtifacts,
  resourcesTemplate,
  storageRows,
  storageSectionTemplate,
  type ResourcesViewModel,
  type StorageType,
} from "./resources-components";

export { resourcesStyleArtifacts };

interface ResourcesConfig {
  hideDevtoolsSetting: boolean;
  observeElement: boolean;
}

export class Resources extends Tool {
  readonly name = "resources";
  readonly title = "resources";
  readonly icon = "▦";
  readonly config = new ConfigStore<ResourcesConfig>("resources", {
    hideDevtoolsSetting: true,
    observeElement: true,
  });

  private body: HTMLElement | null = null;
  private cleanup: Array<() => void> = [];
  private observer: MutationObserver | null = null;
  private disposeView: (() => void) | null = null;
  private readonly scheduleRefresh = debounce(() => this.refresh(), 120);

  override init(container: HTMLElement, context: ToolContext): void {
    super.init(container, context);

    const view: ResourcesViewModel = {
      setBody: (node) => {
        this.body = node;
      },
    };

    this.disposeView?.();
    this.disposeView = render(container, html`<RodResourcesView view=${view as never} />`);

    this.cleanup.push(delegate(container, "click", "[data-resource-action]", (event, element) => this.handleAction(event, element)));
    this.cleanup.push(delegate(container, "change", "[data-storage-key]", (event, element) => this.handleStorageChange(event, element)));
    this.cleanup.push(delegate(container, "click", "[data-source-type]", (event, element) => this.openSource(event, element)));

    this.config.on("change", this.onConfigChange);

    this.observe();
    this.registerSettings(context);
    this.refresh();
  }

  refresh(): void {
    if (!this.body) return;

    render(this.body, resourcesTemplate([
      storageSectionTemplate("Local Storage", "local", storageRows("local", safeStorage("local"))),
      storageSectionTemplate("Session Storage", "session", storageRows("session", safeStorage("session"))),
      cookieSectionTemplate(parseCookies()),
      capabilitySectionTemplate(capabilityItems()),
      linkSectionTemplate("Scripts", "script", this.scriptUrls()),
      linkSectionTemplate("Stylesheets", "style", this.stylesheetUrls()),
      linkSectionTemplate("Iframes", "iframe", this.iframeUrls()),
      imageSectionTemplate(this.imageUrls()),
    ]));
  }

  refreshScript(): void {
    this.refresh();
  }

  refreshStylesheet(): void {
    this.refresh();
  }

  refreshIframe(): void {
    this.refresh();
  }

  refreshLocalStorage(): void {
    this.refresh();
  }

  refreshSessionStorage(): void {
    this.refresh();
  }

  refreshCookie(): void {
    this.refresh();
  }

  refreshImage(): void {
    this.refresh();
  }

  override destroy(): void {
    this.observer?.disconnect();
    this.observer = null;

    this.config.off("change", this.onConfigChange);

    for (const cleanup of this.cleanup.splice(0)) cleanup();

    this.disposeView?.();
    this.disposeView = null;
    this.body = null;

    super.destroy();
  }

  private readonly onConfigChange = (key: string, value: unknown): void => {
    if (key === "observeElement") {
      value ? this.observe() : this.observer?.disconnect();
    }

    this.refresh();
  };

  private registerSettings(context: ToolContext): void {
    context.settings.registerSeparator();
    context.settings.registerText("Resources");
    context.settings.registerSwitch(this.config, "hideDevtoolsSetting", "Hide RodEruda resources from lists");
    context.settings.registerSwitch(this.config, "observeElement", "Automatically refresh resource mutations");
  }

  private observe(): void {
    this.observer?.disconnect();

    if (!this.config.get("observeElement") || !document.documentElement) return;

    this.observer = new MutationObserver((mutations) => {
      const host = this.context?.shadowRoot?.host as HTMLElement | undefined;

      if (mutations.some((mutation) => !isDevtoolsNode(mutation.target, host))) {
        this.scheduleRefresh();
      }
    });

    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "href"],
    });
  }

  private scriptUrls(): string[] {
    return unique(Array.from(document.scripts)
      .map((script) => script.src)
      .filter(Boolean))
      .filter((url) => !this.hidden(url));
  }

  private stylesheetUrls(): string[] {
    const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"][href]'))
      .map((link) => link.href);

    const sheets = Array.from(document.styleSheets)
      .map((sheet) => sheet.href)
      .filter((href): href is string => Boolean(href));

    return unique([...links, ...sheets]).filter((url) => !this.hidden(url));
  }

  private iframeUrls(): string[] {
    return unique(Array.from(document.querySelectorAll<HTMLIFrameElement>("iframe[src]"))
      .map((frame) => frame.src)
      .filter(Boolean))
      .filter((url) => !this.hidden(url));
  }

  private imageUrls(): string[] {
    const images = Array.from(document.images)
      .flatMap((image) => [image.currentSrc, image.src])
      .filter(Boolean);

    const backgrounds: string[] = [];

    for (const element of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      if (backgrounds.length > 1000) break;

      const value = getComputedStyle(element).backgroundImage;

      for (const match of value.matchAll(/url\(["']?(.+?)["']?\)/g)) {
        if (match[1]) {
          backgrounds.push(new URL(match[1], location.href).href);
        }
      }
    }

    return unique([...images, ...backgrounds]).filter((url) => !this.hidden(url));
  }

  private hidden(url: string): boolean {
    return this.config.get("hideDevtoolsSetting") && /roderuda|devtools|__chobitsu-hide__/i.test(url);
  }

  private handleAction(event: Event, element: HTMLElement): void {
    event.preventDefault();

    const action = element.dataset.resourceAction;

    if (action === "refresh") {
      this.refresh();
      return;
    }

    if (action === "clear-storage") {
      const type = element.dataset.storageType as StorageType;
      safeStorage(type).clear();
      this.refresh();
      return;
    }

    if (action === "add-storage") {
      void this.addStorage(element.dataset.storageType as StorageType);
      return;
    }

    if (action === "remove-storage") {
      const type = element.dataset.storageType as StorageType;
      safeStorage(type).removeItem(element.dataset.storageKey || "");
      this.refresh();
      return;
    }

    if (action === "edit-json-storage") {
      void this.editJsonStorage(element.dataset.storageType as StorageType, element.dataset.storageKey || "");
      return;
    }

    if (action === "add-cookie") {
      void this.addCookie();
      return;
    }

    if (action === "remove-cookie") {
      removeCookie(element.dataset.cookieName || "");
      this.refresh();
    }
  }

  private handleStorageChange(event: Event, element: HTMLElement): void {
    if (!(event.target instanceof HTMLInputElement)) return;

    const row = element.closest<HTMLElement>("tr");
    const type = row?.dataset.storageType as StorageType;
    const original = row?.dataset.originalKey || "";
    const key = row?.querySelector<HTMLInputElement>("[data-storage-key]")?.value.trim() || "";
    const value = row?.querySelector<HTMLInputElement>("[data-storage-value]")?.value ?? "";
    const storage = safeStorage(type);

    if (original && original !== key) {
      storage.removeItem(original);
    }

    if (key) {
      storage.setItem(key, value);
    }

    this.refresh();
  }

  private openSource(event: Event, element: HTMLElement): void {
    event.preventDefault();

    const url = element.dataset.url || "";
    const type = element.dataset.sourceType || "text";
    const sources = this.context?.devtools.get<{ set(type: string | SourcePayload, value?: unknown): unknown } & Tool>("sources");

    if (!sources) return;

    if (type === "image") {
      sources.set({
        type: "image",
        value: url,
        url,
        title: url,
      });
    } else if (type === "iframe") {
      sources.set({
        type: "iframe",
        value: url,
        url,
        title: url,
      });
    } else {
      sources.set({
        type: type === "style" ? "css" : "javascript",
        value: url,
        url,
        title: url,
      });
    }

    this.context?.devtools.showTool("sources");
  }

  private async addStorage(type: StorageType): Promise<void> {
    const key = await this.context?.prompt(`New ${type}Storage key`);
    if (!key) return;

    const value = await this.context?.prompt("Value", "");
    if (value == null) return;

    safeStorage(type).setItem(key, value);
    this.refresh();
  }

  private async addCookie(): Promise<void> {
    const name = await this.context?.prompt("Cookie name");
    if (!name) return;

    const value = await this.context?.prompt("Cookie value", "");
    if (value == null) return;

    const attributes = await this.context?.prompt("Cookie attributes", "path=/; SameSite=Lax");

    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; ${attributes || "path=/"}`;
    this.refresh();
  }

  private async editJsonStorage(type: StorageType, key: string): Promise<void> {
    const storage = safeStorage(type);
    const current = storage.getItem(key) ?? "";
    const next = await this.context?.prompt(`Edit JSON for ${key}`, formatJsonValue(current));

    if (next == null) return;

    try {
      JSON.parse(next);
      storage.setItem(key, next);
      this.refresh();
    } catch (error) {
      this.context?.notify(`Invalid JSON: ${plainText(error)}`, { type: "error" });
    }
  }
}

function parseCookies(): Array<{ name: string; value: string }> {
  if (!document.cookie) return [];

  return document.cookie.split(/;\s*/).filter(Boolean).map((chunk) => {
    const index = chunk.indexOf("=");
    const name = index < 0 ? chunk : chunk.slice(0, index);
    const value = index < 0 ? "" : chunk.slice(index + 1);

    try {
      return {
        name: decodeURIComponent(name),
        value: decodeURIComponent(value),
      };
    } catch {
      return { name, value };
    }
  });
}

function removeCookie(name: string): void {
  const encoded = encodeURIComponent(name);
  const paths = [
    "/",
    location.pathname,
    location.pathname.replace(/\/[^/]*$/, "") || "/",
  ];

  for (const path of unique(paths)) {
    document.cookie = `${encoded}=; Max-Age=0; path=${path}`;
  }
}

function safeStorage(type: StorageType): Storage {
  try {
    return type === "local" ? localStorage : sessionStorage;
  } catch {
    const memory = new Map<string, string>();

    return {
      get length() {
        return memory.size;
      },
      clear: () => memory.clear(),
      getItem: (key) => memory.get(key) ?? null,
      key: (index) => [...memory.keys()][index] ?? null,
      removeItem: (key) => {
        memory.delete(key);
      },
      setItem: (key, value) => {
        memory.set(key, String(value));
      },
    };
  }
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
