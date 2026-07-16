import { nodePath, truncate } from "@rodkisten/devtools/utils";
import { plainText } from "@rodkisten/devtools/core-serialize";
import type {
  ListenerModel,
  PropertyModel,
  StyleRuleInfo,
  StyleRuleModel,
} from "@rodkisten/devtools/panels-elements-components";
import { appendArray, concatArrays, mapArray, mapJoinArray, mapObject, reverseArray, take, toArray } from "@rodkisten/nascente";

export function styleRuleModels(element: Element, rules: StyleRuleInfo[]): StyleRuleModel[] {
  const inline = mapArray(element instanceof HTMLElement ? element.style : [], (property) => ({
    property,
    value: (element as HTMLElement).style.getPropertyValue(property),
    priority: (element as HTMLElement).style.getPropertyPriority(property),
  }));

  return concatArrays(
    [{
      selector: "element.style",
      declarations: appendArray(inline, { property: "", value: "", priority: "" }),
      editable: true,
    }],
    mapArray(rules, (rule) => ({
      ...rule,
      editable: false,
    })),
  );
}

export function listenerModels(
  listeners: Readonly<Record<string, readonly {
    listener: EventListenerOrEventListenerObject;
    options?: boolean | AddEventListenerOptions;
  }[]>>,
): ListenerModel[] {
  return mapObject(listeners, (values, type) => ({ type, values }));
}

export function propertyModels(element: Element): PropertyModel[] {
  const rows: PropertyModel[] = [{ key: "selector", value: nodePath(element) }];
  const keys = take(Reflect.ownKeys(element), 100);

  for (const key of keys) {
    let value: unknown;

    try {
      value = Reflect.get(element, key);
    } catch (error) {
      value = error;
    }

    rows.push({
      key: String(key),
      value: truncate(plainText(value), 300),
    });
  }

  return rows;
}

export function crumbLabel(element: Element): string {
  return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${mapJoinArray(take(element.classList, 1), (name) => `.${name}`, "")}`;
}

export function listenerText(listener: EventListenerOrEventListenerObject): string {
  if (typeof listener === "function") return listener.toString();
  return listener.handleEvent?.toString() || String(listener);
}

export function number(value: string): number {
  return Number.parseFloat(value) || 0;
}

export function getMatchedRules(element: Element): StyleRuleInfo[] {
  const output: StyleRuleInfo[] = [];

  for (const stylesheet of toArray(document.styleSheets)) {
    let rules: CSSRuleList;

    try {
      rules = stylesheet.cssRules;
    } catch {
      // Cross-origin stylesheets expose no cssRules.
      continue;
    }

    collectRules(
      rules,
      element,
      output,
      stylesheet.href || "inline",
    );
  }

  return reverseArray(output);
}

export function collectRules(
  rules: CSSRuleList,
  element: Element,
  output: StyleRuleInfo[],
  source: string,
): void {
  for (const rule of toArray(rules)) {
    if (rule instanceof CSSStyleRule) {
      try {
        if (!element.matches(rule.selectorText)) {
          continue;
        }
      } catch {
        // Invalid or browser-specific selectors cannot be matched safely.
        continue;
      }

      output.push({
        selector: rule.selectorText,
        source,
        declarations: mapArray(rule.style, (property) => ({
          property,
          value: rule.style.getPropertyValue(property),
          priority: rule.style.getPropertyPriority(property),
        })),
      });

      continue;
    }

    if ("cssRules" in rule) {
      try {
        collectRules(
          (rule as CSSGroupingRule).cssRules,
          element,
          output,
          source,
        );
      } catch {
        // Some grouping rules are inaccessible depending on browser/CSP.
      }
    }
  }
}

export function clamp(value: number, minimum: number, maximum: number): number {
  if (maximum < minimum) return minimum;
  return Math.min(Math.max(value, minimum), maximum);
}

export function meaningfulText(value: string | null | undefined): string {
  return (value ?? "").replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").trim();
}
