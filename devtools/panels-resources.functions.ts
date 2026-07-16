import { ConfigStore } from "@rodkisten/devtools/core-config";
import { icon, isDevtoolsNode, truncate } from "@rodkisten/devtools/utils";
import { plainText } from "@rodkisten/devtools/core-serialize";
import { Tool } from "@rodkisten/devtools/tool";
import type { ResourcesConfig, SourcePayload, ToolContext } from "@rodkisten/devtools/types";
import { event, html,  render } from "@rodkisten/devtools/core-runtime";
import { mountCodeEditor, type CodeEditorHandle } from "@rodkisten/devtools/core-code-editor";
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
  ResourcesJsonDialog,
  ResourcesJsonHeader,
  ResourcesJsonEditorHost,
  ResourcesJsonActions,
  type ResourcesViewModel,
} from "@rodkisten/devtools/panels-resources-components";
import { RESOURCE_ELEMENT_SELECTOR, StorageType, CapabilityModel } from "@rodkisten/devtools/panels-resources";

export function mutationTouchesResources(
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

export function collectCssRuleUrls(rules: CSSRuleList, output: string[]): void {
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

export function extractCssUrls(value: string): string[] {
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

export function looksLikeImageUrl(value: string): boolean {
  return /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|webp)(?:[?#]|$)/i.test(value);
}

export function storageRows(type: StorageType, storage: Storage): Array<{ type: StorageType; key: string; value: string; json: boolean }> {
  const rows: Array<{ type: StorageType; key: string; value: string; json: boolean }> = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key == null) continue;

    const value = storage.getItem(key) ?? "";
    rows.push({ type, key, value, json: isJsonValue(value) });
  }

  return rows;
}

export function capabilityItems(): CapabilityModel[] {
  return [
    ["IndexedDB", typeof indexedDB !== "undefined"],
    ["Cache Storage", typeof caches !== "undefined"],
    ["WebSQL", typeof (window as unknown as { openDatabase?: unknown }).openDatabase === "function"],
    ["localStorage", canUseStorage("local")],
    ["sessionStorage", canUseStorage("session")],
    ["Cookies", typeof document.cookie === "string"],
  ].map(([name, available]) => ({ name: String(name), available: Boolean(available) }));
}

export function parseCookies(): Array<{ name: string; value: string }> {
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

export function removeCookie(name: string): void {
  const encoded = encodeURIComponent(name);
  const paths = ["/", location.pathname, location.pathname.replace(/\/[^/]*$/, "") || "/"];

  for (const path of unique(paths)) document.cookie = `${encoded}=; Max-Age=0; path=${path}`;
}

export function safeStorage(type: StorageType): Storage {
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

export function canUseStorage(type: StorageType): boolean {
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

export function isJsonValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || !/^[{[]/.test(trimmed)) return false;

  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

export function formatJsonValue(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
