import { ConfigStore } from "../core/config";
import { debounce, icon, isDevtoolsNode, truncate } from "../utils";
import { plainText } from "../core/serialize";
import { Tool } from "../tool";
import type { ResourcesConfig, SourcePayload, ToolContext } from "../types";
import { event, html, render } from "../components/runtime";
import {
  ResourcesIconButton,
  ResourcesImageCard,
  ResourcesImageList,
  ResourcesInput,
  ResourcesLinkList,
  ResourcesSection,
  ResourcesSectionActions,
  ResourcesSectionContent,
  ResourcesSectionTitle,
  ResourcesTable,
  ResourcesTableWrap,
  resourcesStyleArtifacts,
  type ResourcesViewModel,
} from "./resources-components";

export { resourcesStyleArtifacts };

type StorageType = "local" | "session";

type CapabilityModel = {
  name: string;
  available: boolean;
};

export class Resources extends Tool {
  readonly name = "resources";
  readonly title = "resources";
  readonly icon = icon("resources");
  readonly config = new ConfigStore<ResourcesConfig>("resources", {
    hideDevtoolsSetting: true,
    observeElement: true,
  });

  private body: HTMLElement | null = null;
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

    this.config.on("change", this.onConfigChange);
    this.registerSettings(context);
  }

  refresh(): void {
    if (!this.active || !this.body) return;

    render(this.body, html`
      ${this.storageSection("Local Storage", "local", safeStorage("local"))}
      ${this.storageSection("Session Storage", "session", safeStorage("session"))}
      ${this.cookieSection(parseCookies())}
      ${this.capabilitySection()}
      ${this.linkSection("Scripts", "script", this.scriptUrls())}
      ${this.linkSection("Stylesheets", "style", this.stylesheetUrls())}
      ${this.linkSection("Iframes", "iframe", this.iframeUrls())}
      ${this.imageSection(this.imageUrls())}
    `);
  }


  override show(): void {
    super.show();
    this.observe();
    this.refresh();
  }

  override hide(): void {
    super.hide();
    this.observer?.disconnect();
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

    this.disposeView?.();
    this.disposeView = null;
    this.body = null;

    super.destroy();
  }

  private readonly onConfigChange = (key: string, value: unknown): void => {
    if (key === "observeElement") {
      value && this.active ? this.observe() : this.observer?.disconnect();
    }

    if (this.active) this.refresh();
  };

  private registerSettings(context: ToolContext): void {
    context.settings.registerSeparator();
    context.settings.registerText("Resources");
    context.settings.registerSwitch(this.config, "hideDevtoolsSetting", "Hide RodEruda resources from lists");
    context.settings.registerSwitch(this.config, "observeElement", "Automatically refresh resource mutations");
  }

  private observe(): void {
    this.observer?.disconnect();

    if (!this.active || !this.config.get("observeElement") || !document.documentElement) return;

    this.observer = new MutationObserver((mutations) => {
      const host = this.context?.shadowRoot?.host as HTMLElement | undefined;

      if (mutations.some((mutation) => mutationTouchesResources(mutation, host))) {
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

  private storageSection(title: string, type: StorageType, storage: Storage) {
    const rows = storageRows(type, storage);
    const body = rows.length
      ? rows.map((row) => this.storageRow(row))
      : html`<tr><td colspan="3">Empty</td></tr>`;

    return html`
      <ResourcesSection>
        <ResourcesSectionTitle>
          <span>${title} (${rows.length})</span>
          <ResourcesSectionActions>
            <ResourcesIconButton type="button" title="Refresh" @click=${event(() => this.refresh())}>${icon("refresh")}</ResourcesIconButton>
            <ResourcesIconButton type="button" title="Add" @click=${event(() => void this.addStorage(type))}>+</ResourcesIconButton>
            <ResourcesIconButton type="button" title="Clear" @click=${event(() => this.clearStorage(type))}>${icon("clear")}</ResourcesIconButton>
          </ResourcesSectionActions>
        </ResourcesSectionTitle>
        <ResourcesTableWrap>
          <ResourcesTable>
            <thead>
              <tr><th>Key</th><th>Value</th><th></th></tr>
            </thead>
            <tbody>${body}</tbody>
          </ResourcesTable>
        </ResourcesTableWrap>
      </ResourcesSection>
    `;
  }

  private storageRow(row: { type: StorageType; key: string; value: string; json: boolean }) {
    const jsonButton = row.json ? html`
      <ResourcesIconButton type="button" title="Edit JSON" @click=${event(() => void this.editJsonStorage(row.type, row.key))}>{ }</ResourcesIconButton>
    ` : "";

    return html`
      <tr>
        <td>
          <ResourcesInput .value=${row.key} @change=${event((change: Event) => this.updateStorageKey(change, row.type, row.key))} />
        </td>
        <td>
          <ResourcesInput .value=${row.json ? formatJsonValue(row.value) : row.value} @change=${event((change: Event) => this.updateStorageValue(change, row.type, row.key))} />
        </td>
        <td>
          ${jsonButton}
          <ResourcesIconButton type="button" title="Remove" @click=${event(() => this.removeStorage(row.type, row.key))}>×</ResourcesIconButton>
        </td>
      </tr>
    `;
  }

  private cookieSection(cookies: Array<{ name: string; value: string }>) {
    return html`
      <ResourcesSection>
        <ResourcesSectionTitle>
          <span>Cookies (${cookies.length})</span>
          <ResourcesSectionActions>
            <ResourcesIconButton type="button" title="Add" @click=${event(() => void this.addCookie())}>+</ResourcesIconButton>
            <ResourcesIconButton type="button" title="Refresh" @click=${event(() => this.refresh())}>${icon("refresh")}</ResourcesIconButton>
          </ResourcesSectionActions>
        </ResourcesSectionTitle>

        <ResourcesTableWrap>
          <ResourcesTable>
            <thead>
              <tr>
                <th>Name</th>
                <th>Value</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${cookies.length ? cookies.map((cookie) => html`
                <tr>
                  <td>${cookie.name}</td>
                  <td>${cookie.value}</td>
                  <td>
                    <ResourcesIconButton
                      type="button"
                      title="Remove"
                      @click=${event(() => this.removeCookie(cookie.name))}
                    >
                      ×
                    </ResourcesIconButton>
                  </td>
                </tr>
              `) : html`<tr><td colspan="3">No script-visible cookies</td></tr>`}
            </tbody>
          </ResourcesTable>
        </ResourcesTableWrap>
      </ResourcesSection>
    `;
  }

  private capabilitySection() {
    const items = capabilityItems();

    return html`
      <ResourcesSection>
        <ResourcesSectionTitle>
          <span>Storage capabilities</span>
          <ResourcesSectionActions>
            <ResourcesIconButton type="button" title="Refresh" @click=${event(() => this.refresh())}>${icon("refresh")}</ResourcesIconButton>
          </ResourcesSectionActions>
        </ResourcesSectionTitle>

        <ResourcesLinkList>
          ${items.map((item) => html`
            <li>${item.name}: ${item.available ? "available" : "unavailable"}</li>
          `)}
        </ResourcesLinkList>
      </ResourcesSection>
    `;
  }

  private linkSection(title: string, type: string, urls: string[]) {
    return html`
      <ResourcesSection>
        <ResourcesSectionTitle>
          <span>${title} (${urls.length})</span>
          <ResourcesSectionActions>
            <ResourcesIconButton type="button" title="Refresh" @click=${event(() => this.refresh())}>${icon("refresh")}</ResourcesIconButton>
          </ResourcesSectionActions>
        </ResourcesSectionTitle>

        <ResourcesLinkList>
          ${urls.length ? urls.map((url) => html`
            <li>
              <a href=${url} @click=${event((click: Event) => this.openSource(click, type, url))}>${url}</a>
            </li>
          `) : html`<li>None</li>`}
        </ResourcesLinkList>
      </ResourcesSection>
    `;
  }

  private imageSection(urls: string[]) {
    return html`
      <ResourcesSection>
        <ResourcesSectionTitle>
          <span>Images (${urls.length})</span>
          <ResourcesSectionActions>
            <ResourcesIconButton type="button" title="Refresh" @click=${event(() => this.refresh())}>${icon("refresh")}</ResourcesIconButton>
          </ResourcesSectionActions>
        </ResourcesSectionTitle>

        <ResourcesSectionContent>
          <ResourcesImageList>
            ${urls.length ? urls.slice(0, 500).map((url) => html`
              <ResourcesImageCard type="button" @click=${event((click: Event) => this.openSource(click, "image", url))}>
                <img src=${url} loading="lazy" alt="" />
                <span title=${url}>${truncate(url, 100)}</span>
              </ResourcesImageCard>
            `) : "None"}
          </ResourcesImageList>
        </ResourcesSectionContent>
      </ResourcesSection>
    `;
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
      .filter((image) => !isDevtoolsNode(image, this.context?.shadowRoot?.host as HTMLElement | undefined))
      .flatMap((image) => [image.currentSrc, image.src])
      .filter(Boolean);

    const inlineBackgrounds = Array.from(document.querySelectorAll<HTMLElement>("[style]"))
      .filter((element) => !isDevtoolsNode(element, this.context?.shadowRoot?.host as HTMLElement | undefined))
      .flatMap((element) => extractCssUrls(`${element.style.backgroundImage} ${element.style.background}`));

    const stylesheetBackgrounds: string[] = [];
    for (const stylesheet of Array.from(document.styleSheets)) {
      try {
        collectCssRuleUrls(stylesheet.cssRules, stylesheetBackgrounds);
      } catch {
        // Cross-origin stylesheets cannot expose their rules. Loaded resources
        // are still picked up from the Performance API below.
      }
    }

    const performanceImages = typeof performance.getEntriesByType === "function"
      ? performance.getEntriesByType("resource")
        .filter((entry): entry is PerformanceResourceTiming => "initiatorType" in entry)
        .filter((entry) => entry.initiatorType === "img" || looksLikeImageUrl(entry.name))
        .map((entry) => entry.name)
      : [];

    return unique([
      ...images,
      ...inlineBackgrounds,
      ...stylesheetBackgrounds,
      ...performanceImages,
    ]).filter((url) => !this.hidden(url));
  }

  private hidden(url: string): boolean {
    return this.config.get("hideDevtoolsSetting") && /roderuda|devtools|__chobitsu-hide__/i.test(url);
  }

  private clearStorage(type: StorageType): void {
    safeStorage(type).clear();
    this.refresh();
  }

  private removeStorage(type: StorageType, key: string): void {
    safeStorage(type).removeItem(key);
    this.refresh();
  }

  private updateStorageKey(event: Event, type: StorageType, originalKey: string): void {
    if (!(event.target instanceof HTMLInputElement)) return;

    const nextKey = event.target.value.trim();
    const storage = safeStorage(type);
    const currentValue = storage.getItem(originalKey) ?? "";

    if (originalKey && originalKey !== nextKey) storage.removeItem(originalKey);
    if (nextKey) storage.setItem(nextKey, currentValue);

    this.refresh();
  }

  private updateStorageValue(event: Event, type: StorageType, key: string): void {
    if (!(event.target instanceof HTMLInputElement)) return;
    if (!key) return;

    safeStorage(type).setItem(key, event.target.value);
    this.refresh();
  }

  private openSource(event: Event, type: string, url: string): void {
    event.preventDefault();

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

    const attributes = await this.context?.prompt("Cookie attributes", "path=/; SameSite=Lax");

    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; ${attributes || "path=/"}`;
    this.refresh();
  }

  private removeCookie(name: string): void {
    removeCookie(name);
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

const RESOURCE_ELEMENT_SELECTOR = [
  "script",
  "style",
  "link[href]",
  "iframe[src]",
  "img[src]",
  "source[src]",
  "video[src]",
  "audio[src]",
  "[style]",
].join(",");

function mutationTouchesResources(
  mutation: MutationRecord,
  devtoolsHost?: HTMLElement,
): boolean {
  if (isDevtoolsNode(mutation.target, devtoolsHost)) return false;

  if (mutation.type === "attributes") {
    return mutation.target instanceof Element
      && mutation.target.matches(RESOURCE_ELEMENT_SELECTOR);
  }

  for (const node of [...mutation.addedNodes, ...mutation.removedNodes]) {
    if (!(node instanceof Element) || isDevtoolsNode(node, devtoolsHost)) continue;
    if (node.matches(RESOURCE_ELEMENT_SELECTOR) || node.querySelector(RESOURCE_ELEMENT_SELECTOR)) {
      return true;
    }
  }

  return false;
}

function collectCssRuleUrls(rules: CSSRuleList, output: string[]): void {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      output.push(...extractCssUrls(`${rule.style.backgroundImage} ${rule.style.background}`));
      continue;
    }

    if ("cssRules" in rule) {
      try {
        collectCssRuleUrls((rule as CSSGroupingRule).cssRules, output);
      } catch {
        // Browser-specific grouping rules can be inaccessible.
      }
    }
  }
}

function extractCssUrls(value: string): string[] {
  const urls: string[] = [];
  for (const match of value.matchAll(/url\(["']?(.+?)["']?\)/g)) {
    if (!match[1]) continue;
    try {
      urls.push(new URL(match[1], location.href).href);
    } catch {
      // Ignore malformed CSS URLs.
    }
  }
  return urls;
}

function looksLikeImageUrl(value: string): boolean {
  return /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|webp)(?:[?#]|$)/i.test(value);
}

function storageRows(type: StorageType, storage: Storage): Array<{ type: StorageType; key: string; value: string; json: boolean }> {
  const rows: Array<{ type: StorageType; key: string; value: string; json: boolean }> = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key == null) continue;

    const value = storage.getItem(key) ?? "";
    rows.push({ type, key, value, json: isJsonValue(value) });
  }

  return rows;
}

function capabilityItems(): CapabilityModel[] {
  return [
    ["IndexedDB", typeof indexedDB !== "undefined"],
    ["Cache Storage", typeof caches !== "undefined"],
    ["WebSQL", typeof (window as unknown as { openDatabase?: unknown }).openDatabase === "function"],
    ["localStorage", canUseStorage("local")],
    ["sessionStorage", canUseStorage("session")],
    ["Cookies", typeof document.cookie === "string"],
  ].map(([name, available]) => ({ name: String(name), available: Boolean(available) }));
}

function parseCookies(): Array<{ name: string; value: string }> {
  if (!document.cookie) return [];

  return document.cookie.split(/;\s*/).filter(Boolean).map((chunk) => {
    const index = chunk.indexOf("=");
    const name = index < 0 ? chunk : chunk.slice(0, index);
    const value = index < 0 ? "" : chunk.slice(index + 1);

    try {
      return { name: decodeURIComponent(name), value: decodeURIComponent(value) };
    } catch {
      return { name, value };
    }
  });
}

function removeCookie(name: string): void {
  const encoded = encodeURIComponent(name);
  const paths = ["/", location.pathname, location.pathname.replace(/\/[^/]*$/, "") || "/"];

  for (const path of unique(paths)) document.cookie = `${encoded}=; Max-Age=0; path=${path}`;
}

function safeStorage(type: StorageType): Storage {
  try {
    return type === "local" ? localStorage : sessionStorage;
  } catch {
    const memory = new Map<string, string>();

    return {
      get length() { return memory.size; },
      clear: () => memory.clear(),
      getItem: (key) => memory.get(key) ?? null,
      key: (index) => [...memory.keys()][index] ?? null,
      removeItem: (key) => { memory.delete(key); },
      setItem: (key, value) => { memory.set(key, String(value)); },
    };
  }
}

function canUseStorage(type: StorageType): boolean {
  try {
    const storage = type === "local" ? localStorage : sessionStorage;
    const key = "__roderuda_storage_probe__";
    storage.setItem(key, "1");
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function isJsonValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || !/^[{[]/.test(trimmed)) return false;

  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function formatJsonValue(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
