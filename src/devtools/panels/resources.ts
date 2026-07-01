import { ConfigStore } from "../core/config";
import { debounce, delegate, escapeHtml, icon, isDevtoolsNode, truncate } from "../core/dom";
import { Tool } from "../tool";
import type { SourcePayload, ToolContext } from "../types";
import { renderPanelShell } from "./panel-ui";

interface ResourcesConfig {
  hideDevtoolsSetting: boolean;
  observeElement: boolean;
}

type StorageType = "local" | "session";

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
  private readonly scheduleRefresh = debounce(() => this.refresh(), 120);

  override init(container: HTMLElement, context: ToolContext): void {
    super.init(container, context);
    const refs = renderPanelShell(container, {
      className: "roderuda-resources",
      bodyAttr: "data-resources-body",
      bodyClassName: "roderuda-resources-body",
    });
    this.body = refs.body;
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
    const sections = [
      storageSection("Local Storage", "local", safeStorage("local")),
      storageSection("Session Storage", "session", safeStorage("session")),
      cookieSection(parseCookies()),
      linkSection("Scripts", "script", this.scriptUrls()),
      linkSection("Stylesheets", "style", this.stylesheetUrls()),
      linkSection("Iframes", "iframe", this.iframeUrls()),
      imageSection(this.imageUrls()),
    ];
    this.body.innerHTML = sections.join("");
  }

  refreshScript(): void { this.refresh(); }
  refreshStylesheet(): void { this.refresh(); }
  refreshIframe(): void { this.refresh(); }
  refreshLocalStorage(): void { this.refresh(); }
  refreshSessionStorage(): void { this.refresh(); }
  refreshCookie(): void { this.refresh(); }
  refreshImage(): void { this.refresh(); }

  override destroy(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.config.off("change", this.onConfigChange);
    for (const cleanup of this.cleanup.splice(0)) cleanup();
    super.destroy();
  }

  private readonly onConfigChange = (key: string, value: unknown): void => {
    if (key === "observeElement") value ? this.observe() : this.observer?.disconnect();
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
      if (mutations.some((mutation) => !isDevtoolsNode(mutation.target, host))) this.scheduleRefresh();
    });
    this.observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "href"] });
  }

  private scriptUrls(): string[] {
    return unique(Array.from(document.scripts).map((script) => script.src).filter(Boolean)).filter((url) => !this.hidden(url));
  }

  private stylesheetUrls(): string[] {
    const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"][href]')).map((link) => link.href);
    const sheets = Array.from(document.styleSheets).map((sheet) => sheet.href).filter((href): href is string => Boolean(href));
    return unique([...links, ...sheets]).filter((url) => !this.hidden(url));
  }

  private iframeUrls(): string[] {
    return unique(Array.from(document.querySelectorAll<HTMLIFrameElement>("iframe[src]")).map((frame) => frame.src).filter(Boolean)).filter((url) => !this.hidden(url));
  }

  private imageUrls(): string[] {
    const images = Array.from(document.images).flatMap((image) => [image.currentSrc, image.src]).filter(Boolean);
    const backgrounds: string[] = [];
    for (const element of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      if (backgrounds.length > 1000) break;
      const value = getComputedStyle(element).backgroundImage;
      for (const match of value.matchAll(/url\(["']?(.+?)["']?\)/g)) if (match[1]) backgrounds.push(new URL(match[1], location.href).href);
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
    if (action === "add-cookie") {
      void this.addCookie();
      return;
    }
    if (action === "remove-cookie") {
      removeCookie(element.dataset.cookieName || "");
      this.refresh();
      return;
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
    if (original && original !== key) storage.removeItem(original);
    if (key) storage.setItem(key, value);
    this.refresh();
  }

  private openSource(event: Event, element: HTMLElement): void {
    event.preventDefault();
    const url = element.dataset.url || "";
    const type = element.dataset.sourceType || "text";
    const sources = this.context?.devtools.get<{ set(type: string | SourcePayload, value?: unknown): unknown } & Tool>("sources");
    if (!sources) return;
    if (type === "image") sources.set({ type: "image", value: url, url, title: url });
    else if (type === "iframe") sources.set({ type: "iframe", value: url, url, title: url });
    else sources.set({ type: type === "style" ? "css" : "javascript", value: url, url, title: url });
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
    const attributes = await this.context?.prompt("Cookie attributes", `path=/; SameSite=Lax`);
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; ${attributes || "path=/"}`;
    this.refresh();
  }
}

function storageSection(title: string, type: StorageType, storage: Storage): string {
  const rows: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key == null) continue;
    rows.push(`<tr data-storage-type="${type}" data-original-key="${escapeHtml(key)}"><td><input data-storage-key value="${escapeHtml(key)}"></td><td><input data-storage-value value="${escapeHtml(storage.getItem(key) ?? "")}"></td><td><button class="roderuda-icon-btn" type="button" data-resource-action="remove-storage" data-storage-type="${type}" data-storage-key="${escapeHtml(key)}">×</button></td></tr>`);
  }
  return `<section class="roderuda-section"><div class="roderuda-section-title"><span>${escapeHtml(title)} (${rows.length})</span><span class="roderuda-section-actions"><button class="roderuda-icon-btn" type="button" data-resource-action="refresh">${icon("refresh")}</button><button class="roderuda-icon-btn" type="button" data-resource-action="add-storage" data-storage-type="${type}">+</button><button class="roderuda-icon-btn" type="button" data-resource-action="clear-storage" data-storage-type="${type}">${icon("clear")}</button></span></div><div class="roderuda-table-wrap"><table class="roderuda-table"><thead><tr><th>Key</th><th>Value</th><th></th></tr></thead><tbody>${rows.join("") || '<tr><td colspan="3">Empty</td></tr>'}</tbody></table></div></section>`;
}

function cookieSection(cookies: Array<{ name: string; value: string }>): string {
  const rows = cookies.map((cookie) => `<tr><td>${escapeHtml(cookie.name)}</td><td>${escapeHtml(cookie.value)}</td><td><button class="roderuda-icon-btn" type="button" data-resource-action="remove-cookie" data-cookie-name="${escapeHtml(cookie.name)}">×</button></td></tr>`).join("");
  return `<section class="roderuda-section"><div class="roderuda-section-title"><span>Cookies (${cookies.length})</span><span class="roderuda-section-actions"><button class="roderuda-icon-btn" type="button" data-resource-action="add-cookie">+</button><button class="roderuda-icon-btn" type="button" data-resource-action="refresh">${icon("refresh")}</button></span></div><div class="roderuda-table-wrap"><table class="roderuda-table"><thead><tr><th>Name</th><th>Value</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="3">No script-visible cookies</td></tr>'}</tbody></table></div></section>`;
}

function linkSection(title: string, type: string, urls: string[]): string {
  const items = urls.map((url) => `<li><a href="${escapeHtml(url)}" data-source-type="${type}" data-url="${escapeHtml(url)}">${escapeHtml(url)}</a></li>`).join("");
  return `<section class="roderuda-section"><div class="roderuda-section-title"><span>${escapeHtml(title)} (${urls.length})</span><span class="roderuda-section-actions"><button class="roderuda-icon-btn" type="button" data-resource-action="refresh">${icon("refresh")}</button></span></div><ul class="roderuda-link-list">${items || '<li>None</li>'}</ul></section>`;
}

function imageSection(urls: string[]): string {
  const cards = urls.slice(0, 500).map((url) => `<button class="roderuda-image-card" type="button" data-source-type="image" data-url="${escapeHtml(url)}"><img src="${escapeHtml(url)}" loading="lazy" alt=""><span title="${escapeHtml(url)}">${escapeHtml(truncate(url, 100))}</span></button>`).join("");
  return `<section class="roderuda-section"><div class="roderuda-section-title"><span>Images (${urls.length})</span><span class="roderuda-section-actions"><button class="roderuda-icon-btn" type="button" data-resource-action="refresh">${icon("refresh")}</button></span></div><div class="roderuda-section-content"><div class="roderuda-image-list">${cards || "None"}</div></div></section>`;
}

function parseCookies(): Array<{ name: string; value: string }> {
  if (!document.cookie) return [];
  return document.cookie.split(/;\s*/).filter(Boolean).map((chunk) => {
    const index = chunk.indexOf("=");
    const name = index < 0 ? chunk : chunk.slice(0, index);
    const value = index < 0 ? "" : chunk.slice(index + 1);
    try { return { name: decodeURIComponent(name), value: decodeURIComponent(value) }; } catch { return { name, value }; }
  });
}

function removeCookie(name: string): void {
  const encoded = encodeURIComponent(name);
  const paths = ["/", location.pathname, location.pathname.replace(/\/[^/]*$/, "") || "/"];
  for (const path of unique(paths)) document.cookie = `${encoded}=; Max-Age=0; path=${path}`;
}

function safeStorage(type: StorageType): Storage {
  try { return type === "local" ? localStorage : sessionStorage; } catch {
    const memory = new Map<string, string>();
    return {
      get length() { return memory.size; },
      clear: () => memory.clear(),
      getItem: (key) => memory.get(key) ?? null,
      key: (index) => [...memory.keys()][index] ?? null,
      removeItem: (key) => memory.delete(key),
      setItem: (key, value) => memory.set(key, String(value)),
    };
  }
}

function unique<T>(values: readonly T[]): T[] { return [...new Set(values)]; }
