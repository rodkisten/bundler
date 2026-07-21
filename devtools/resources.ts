import { signal } from "@rodkisten/broto";
import type { Cleanup, RenderValue } from "@rodkisten/fabrica";
import { ConfigStore } from "@rodkisten/devtools/core/config";
import { icon, isDevtoolsNode, truncate } from "@rodkisten/devtools/utils";
import { plainText } from "@rodkisten/devtools/core/serialize";
import { Tool } from "@rodkisten/devtools/tool";
import type { ResourcesConfig, ResourcesContextValue, SourcePayload, ToolContext } from "@rodkisten/devtools/types";
import { event, html, render } from "@rodkisten/devtools/core/runtime";
import { mountCodeEditor, type CodeEditorHandle } from "@rodkisten/devtools/core/code-editor";
import { resourcesStyleArtifacts, ResourcesContext } from "@rodkisten/devtools/panels/resources-components";
import { mutationTouchesResources, collectCssRuleUrls, extractCssUrls, looksLikeImageUrl, storageRows, capabilityItems, parseCookies, removeCookie, safeStorage, formatJsonValue } from "@rodkisten/devtools/panels/resources.functions";
import { compactMapArray, concatArrays, filterArray, filterFlatMapArray, filterMapArray, includesArray, joinArray, mapArray, mapFilterArray, someArray, take, toArray, union, uniq } from "@rodkisten/nascente";


export { resourcesStyleArtifacts };

export type StorageType = "local" | "session";

export type CapabilityModel = {
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
    refreshDelay: 120,
    jsonEditorLineNumbers: true,
    jsonEditorWrapLines: true,
    listBottomPadding: 96,
  });

  private observer: MutationObserver | null = null;
  private jsonEditor: CodeEditorHandle | null = null;
  private jsonEditorValue = "";
  private readonly revision = signal(0, { name: "resources.revision" });
  private contentRoot: HTMLElement | null = null;
  private contentDispose: Cleanup | null = null;
  private readonly jsonEditorState = signal<{ type: StorageType; key: string } | null>(null, { name: "resources.jsonEditor" });
  private readonly view: ResourcesContextValue = {
    revision: this.revision,
    setContentViewport: (node) => {
      this.contentRoot = node;
      if (node && this.active) this.refresh();
    },
    renderContent: () => this.renderContent(),
    renderJsonDialog: () => this.renderJsonDialog(),
  };
  private refreshTimer = 0;
  /** Coalesces page/storage observer bursts into one resources revision update. */
  private scheduleRefresh = (): void => {
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = 0;
      this.refresh();
    }, this.config.get("refreshDelay"));
  };

  override init(container: HTMLElement, context: ToolContext): void {
    super.init(container, context);
    this.config.on("change", this.onConfigChange);
    this.applyTweakVariables();
    this.registerSettings(context);
  }

  override renderView(): RenderValue {
    return ResourcesContext.Provider({
      value: this.view,
      children: () => html`<RodResourcesView />`,
    });
  }

  refresh(): void {
    if (!this.active) return;
    this.revision.update((current) => current + 1);

    if (!this.contentRoot) return;
    this.contentDispose?.();
    this.contentDispose = render(this.contentRoot, this.renderContent());
  }

  private renderContent(): RenderValue {
    if (!this.active) return null;

    return html`
      ${this.storageSection("Local Storage", "local", safeStorage("local"))}
      ${this.storageSection("Session Storage", "session", safeStorage("session"))}
      ${this.cookieSection(parseCookies())}
      ${this.capabilitySection()}
      ${this.linkSection("Scripts", "script", this.scriptUrls())}
      ${this.linkSection("Stylesheets", "style", this.stylesheetUrls())}
      ${this.linkSection("Iframes", "iframe", this.iframeUrls())}
      ${this.imageSection(this.imageUrls())}
    `;
  }


  override show(): void {
    super.show();
    this.refresh();
    this.observe();
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
    window.clearTimeout(this.refreshTimer);
    this.config.off("change", this.onConfigChange);

    this.contentDispose?.();
    this.contentDispose = null;
    this.contentRoot = null;
    this.closeJsonEditor();
    super.destroy();
  }

  private readonly onConfigChange = (key: string, value: unknown): void => {
    if (key === "observeElement") {
      value && this.active ? this.observe() : this.observer?.disconnect();
    }

    if (includesArray(["listBottomPadding"], key)) this.applyTweakVariables();
    if (this.active) this.refresh();
  };

  private registerSettings(context: ToolContext): void {
    context.settings.registerConfigGroup({
      title: "Resources",
      config: this.config,
      settings: [
        { kind: "switch", key: "hideDevtoolsSetting", label: "Hide RodEruda resources from lists" },
        { kind: "switch", key: "observeElement", label: "Automatically refresh resource mutations" },
        { kind: "number", key: "refreshDelay", label: "Resource refresh debounce (ms)", options: { min: 0, max: 5000, step: 25 } },
        { kind: "switch", key: "jsonEditorLineNumbers", label: "JSON editor line numbers" },
        { kind: "switch", key: "jsonEditorWrapLines", label: "JSON editor soft wrap" },
        { kind: "number", key: "listBottomPadding", label: "Resources bottom scroll padding", options: { min: 0, max: 320, step: 4 } },
      ],
    });
  }

  private observe(): void {
    this.observer?.disconnect();

    if (!this.active || !this.config.get("observeElement") || !document.documentElement) return;

    this.observer = new MutationObserver((mutations) => {
      const host = this.context?.shadowRoot?.host as HTMLElement | undefined;

      if (someArray(mutations, (mutation) => mutationTouchesResources(mutation, host))) {
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

  private applyTweakVariables(): void {
    this.container?.style.setProperty("--rd-resources-bottom-padding", `${this.config.get("listBottomPadding")}px`);
  }

  private storageSection(title: string, type: StorageType, storage: Storage) {
    const rows = storageRows(type, storage);
    const body = rows.length
      ? mapArray(rows, (row) => this.storageRow(row))
      : html`<tr><td colspan="3">Empty</td></tr>`;

    return html`
      <ResourcesSection :section=${`storage-${type}`} draggable="true">
        <ResourcesSectionTitle>
          <span :sectionDragHandle aria-label="Drag section">⋮⋮</span><span>${title} (${rows.length})</span>
          <ResourcesSectionActions>
            <ResourcesIconButton type="button" title="Refresh" @click=${event.click(() => this.refresh())}>${icon("refresh")}</ResourcesIconButton>
            <ResourcesIconButton type="button" title="Add" @click=${event.click(() => void this.addStorage(type))}>+</ResourcesIconButton>
            <ResourcesIconButton type="button" title="Clear" @click=${event.click(() => this.clearStorage(type))}>${icon("clear")}</ResourcesIconButton>
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
      <ResourcesIconButton type="button" title="Edit JSON" @click=${event.click(() => void this.editJsonStorage(row.type, row.key))}>{ }</ResourcesIconButton>
    ` : "";

    return html`
      <tr>
        <td>
          <ResourcesInput .value=${row.key} @change=${event.change((change) => this.updateStorageKey(change, row.type, row.key))} />
        </td>
        <td>
          <ResourcesInput .value=${row.json ? formatJsonValue(row.value) : row.value} @change=${event.change((change) => this.updateStorageValue(change, row.type, row.key))} />
        </td>
        <td>
          ${jsonButton}
          <ResourcesIconButton type="button" title="Remove" @click=${event.click(() => this.removeStorage(row.type, row.key))}>×</ResourcesIconButton>
        </td>
      </tr>
    `;
  }

  private cookieSection(cookies: Array<{ name: string; value: string }>) {
    return html`
      <ResourcesSection :section="cookies" draggable="true">
        <ResourcesSectionTitle>
          <span :sectionDragHandle aria-label="Drag section">⋮⋮</span><span>Cookies (${cookies.length})</span>
          <ResourcesSectionActions>
            <ResourcesIconButton type="button" title="Add" @click=${event.click(() => void this.addCookie())}>+</ResourcesIconButton>
            <ResourcesIconButton type="button" title="Refresh" @click=${event.click(() => this.refresh())}>${icon("refresh")}</ResourcesIconButton>
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
              ${cookies.length ? mapArray(cookies, (cookie) => html`
                <tr>
                  <td>${cookie.name}</td>
                  <td>${cookie.value}</td>
                  <td>
                    <ResourcesIconButton
                      type="button"
                      title="Remove"
                      @click=${event.click(() => this.removeCookie(cookie.name))}
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
      <ResourcesSection :section="capabilities" draggable="true">
        <ResourcesSectionTitle>
          <span :sectionDragHandle aria-label="Drag section">⋮⋮</span><span>Storage capabilities</span>
          <ResourcesSectionActions>
            <ResourcesIconButton type="button" title="Refresh" @click=${event.click(() => this.refresh())}>${icon("refresh")}</ResourcesIconButton>
          </ResourcesSectionActions>
        </ResourcesSectionTitle>

        <ResourcesLinkList>
          ${mapArray(items, (item) => html`
            <li>${item.name}: ${item.available ? "available" : "unavailable"}</li>
          `)}
        </ResourcesLinkList>
      </ResourcesSection>
    `;
  }

  private linkSection(title: string, type: string, urls: string[]) {
    return html`
      <ResourcesSection :section=${`storage-${type}`} draggable="true">
        <ResourcesSectionTitle>
          <span :sectionDragHandle aria-label="Drag section">⋮⋮</span><span>${title} (${urls.length})</span>
          <ResourcesSectionActions>
            <ResourcesIconButton type="button" title="Refresh" @click=${event.click(() => this.refresh())}>${icon("refresh")}</ResourcesIconButton>
          </ResourcesSectionActions>
        </ResourcesSectionTitle>

        <ResourcesLinkList>
          ${urls.length ? mapArray(urls, (url) => html`
            <li>
              <a href=${url} @click=${event.click((click) => this.openSource(click, type, url))}>${url}</a>
            </li>
          `) : html`<li>None</li>`}
        </ResourcesLinkList>
      </ResourcesSection>
    `;
  }

  private imageSection(urls: string[]) {
    return html`
      <ResourcesSection :section="images" draggable="true">
        <ResourcesSectionTitle>
          <span :sectionDragHandle aria-label="Drag section">⋮⋮</span><span>Images (${urls.length})</span>
          <ResourcesSectionActions>
            <ResourcesIconButton type="button" title="Refresh" @click=${event.click(() => this.refresh())}>${icon("refresh")}</ResourcesIconButton>
          </ResourcesSectionActions>
        </ResourcesSectionTitle>

        <ResourcesSectionContent>
          <ResourcesImageList>
            ${urls.length ? mapArray(take(urls, 500), (url) => html`
              <ResourcesImageCard type="button" @click=${event.click((click) => this.openSource(click, "image", url))}>
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
    return filterArray(uniq(compactMapArray(document.scripts, (script) => script.src)), (url) => !this.hidden(url));
  }

  private stylesheetUrls(): string[] {
    const links = mapArray(document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"][href]'), (link) => link.href);

    const sheets = mapFilterArray(document.styleSheets, (sheet) => sheet.href, (href): href is string => Boolean(href));

    return filterArray(union(links, sheets), (url) => !this.hidden(url));
  }

  private iframeUrls(): string[] {
    return filterArray(uniq(compactMapArray(document.querySelectorAll<HTMLIFrameElement>("iframe[src]"), (frame) => frame.src)), (url) => !this.hidden(url));
  }

  private imageUrls(): string[] {
    const images = filterArray(filterFlatMapArray(document.images, (image) => !isDevtoolsNode(image, this.context?.shadowRoot?.host as HTMLElement | undefined), (image) => [image.currentSrc, image.src]), Boolean);

    const inlineBackgrounds = filterFlatMapArray(document.querySelectorAll<HTMLElement>("[style]"), (element) => !isDevtoolsNode(element, this.context?.shadowRoot?.host as HTMLElement | undefined), (element) => extractCssUrls(`${element.style.backgroundImage} ${element.style.background}`));

    const stylesheetBackgrounds: string[] = [];
    for (const stylesheet of toArray(document.styleSheets)) {
      try {
        collectCssRuleUrls(stylesheet.cssRules, stylesheetBackgrounds);
      } catch {
        // Cross-origin stylesheets cannot expose their rules. Loaded resources
        // are still picked up from the Performance API below.
      }
    }

    const performanceImages = typeof performance.getEntriesByType === "function"
      ? filterMapArray(filterArray(performance.getEntriesByType("resource"), (entry): entry is PerformanceResourceTiming => "initiatorType" in entry), (entry) => entry.initiatorType === "img" || looksLikeImageUrl(entry.name), (entry) => entry.name)
      : [];

    return filterArray(uniq(concatArrays(images, inlineBackgrounds, stylesheetBackgrounds, performanceImages)), (url) => !this.hidden(url));
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
    this.closeJsonEditor();
    this.jsonEditorValue = formatJsonValue(storage.getItem(key) ?? "");
    this.jsonEditorState.set({ type, key });
  }

  private renderJsonDialog(): RenderValue {
    const state = this.jsonEditorState();
    if (!state) return null;

    return html`
      <RodResourcesJsonDialog role="dialog" aria-modal="true" aria-label=${`Edit JSON for ${state.key}`}>
        <RodResourcesJsonHeader>
          <span>JSON · ${state.key}</span>
          <RodResourcesSectionActions>
            <ResourcesIconButton type="button" title="Format" @click=${event.click(() => this.formatJsonEditor())}>⌘</ResourcesIconButton>
          </RodResourcesSectionActions>
        </RodResourcesJsonHeader>
        <RodResourcesJsonEditorHost ref=${(node: HTMLElement) => this.mountJsonEditor(node)} />
        <RodResourcesJsonActions>
          <ResourcesIconButton type="button" @click=${event.click(() => this.closeJsonEditor())}>Cancel</ResourcesIconButton>
          <ResourcesIconButton type="button" @click=${event.click(() => this.saveJsonEditor())}>Save</ResourcesIconButton>
        </RodResourcesJsonActions>
      </RodResourcesJsonDialog>
    `;
  }

  private mountJsonEditor(host: HTMLElement): Cleanup {
    this.jsonEditor?.destroy();
    this.jsonEditor = mountCodeEditor({
      parent: host,
      value: this.jsonEditorValue,
      language: "json",
      dark: true,
      lineNumbers: this.config.get("jsonEditorLineNumbers"),
      lineWrapping: this.config.get("jsonEditorWrapLines"),
      onChange: (value) => { this.jsonEditorValue = value; },
    });
    this.jsonEditor.focus();

    return () => {
      this.jsonEditor?.destroy();
      this.jsonEditor = null;
    };
  }

  private formatJsonEditor(): void {
    try {
      const formatted = JSON.stringify(JSON.parse(this.jsonEditor?.getValue() ?? this.jsonEditorValue), null, 2);
      this.jsonEditorValue = formatted;
      this.jsonEditor?.setValue(formatted);
    } catch (error) {
      this.context?.notify(`Invalid JSON: ${plainText(error)}`, { type: "error" });
    }
  }

  private saveJsonEditor(): void {
    const state = this.jsonEditorState.peek();
    if (!state) return;

    const next = this.jsonEditor?.getValue() ?? this.jsonEditorValue;
    try {
      JSON.parse(next);
      safeStorage(state.type).setItem(state.key, next);
      this.closeJsonEditor();
      this.refresh();
      this.context?.notify("JSON saved", { type: "success" });
    } catch (error) {
      this.context?.notify(`Invalid JSON: ${plainText(error)}`, { type: "error" });
    }
  }

  private closeJsonEditor(): void {
    this.jsonEditor?.destroy();
    this.jsonEditor = null;
    this.jsonEditorState.set(null);
  }

}

export const RESOURCE_ELEMENT_SELECTOR = joinArray([
  "script",
  "style",
  "link[href]",
  "iframe[src]",
  "img[src]",
  "source[src]",
  "video[src]",
  "audio[src]",
  "[style]",
], ",");
