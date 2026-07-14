import { copyText, icon, safeStringify } from "../utils";
import { html, render } from "../core/runtime";
import type { RenderValue } from "../../fabrica";
import { Tool } from "../tool";
import { DEVTOOLS_BUILD_INFO } from "../core/build-info";
import type { InfoItem, ToolContext } from "../types";
import {
  InfoKey,
  InfoKv,
  InfoValue,
  infoStyleArtifacts,
  type InfoModel,
  type InfoViewModel,
} from "./info-components";

export function getConnectionInfo(): Record<string, unknown> {
  const connection = (navigator as Navigator & {
    connection?: {
      effectiveType?: string;
      downlink?: number;
      rtt?: number;
      saveData?: boolean;
      type?: string;
    };
  }).connection;
  return connection
    ? {
        type: connection.type ?? "unknown",
        effectiveType: connection.effectiveType ?? "unknown",
        downlink: connection.downlink == null ? "unknown" : `${connection.downlink} Mb/s`,
        rtt: connection.rtt == null ? "unknown" : `${connection.rtt} ms`,
        saveData: connection.saveData ?? false,
      }
    : { supported: false };
}

export function getMemoryInfo(): Record<string, unknown> {
  const memory = performance as Performance & {
    memory?: {
      jsHeapSizeLimit: number;
      totalJSHeapSize: number;
      usedJSHeapSize: number;
    };
  };
  if (!memory.memory) return { supported: false };
  const toMiB = (value: number) => `${(value / 1024 / 1024).toFixed(2)} MiB`;
  return {
    usedJSHeapSize: toMiB(memory.memory.usedJSHeapSize),
    totalJSHeapSize: toMiB(memory.memory.totalJSHeapSize),
    jsHeapSizeLimit: toMiB(memory.memory.jsHeapSizeLimit),
  };
}

export function getNavigationInfo(): Record<string, unknown> {
  const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (!entry) return { supported: false };
  return {
    type: entry.type,
    redirectCount: entry.redirectCount,
    domInteractive: `${entry.domInteractive.toFixed(1)} ms`,
    domContentLoaded: `${entry.domContentLoadedEventEnd.toFixed(1)} ms`,
    loadEvent: `${entry.loadEventEnd.toFixed(1)} ms`,
    transferSize: `${entry.transferSize} B`,
    decodedBodySize: `${entry.decodedBodySize} B`,
  };
}

export function defaultItems(): InfoItem[] {
  return [
    { name: "Location", value: () => location.href },
    { name: "Title", value: () => document.title },
    { name: "User Agent", value: () => navigator.userAgent },
    {
      name: "Device",
      value: () => ({
        viewport: `${window.innerWidth} × ${window.innerHeight}`,
        screen: `${screen.width} × ${screen.height}`,
        devicePixelRatio: window.devicePixelRatio,
        colorDepth: screen.colorDepth,
        orientation: screen.orientation?.type ?? "unknown",
        touchPoints: navigator.maxTouchPoints,
      }),
    },
    {
      name: "System",
      value: () => ({
        platform: navigator.platform || "unknown",
        language: navigator.language,
        languages: navigator.languages,
        cookieEnabled: navigator.cookieEnabled,
        online: navigator.onLine,
        hardwareConcurrency: navigator.hardwareConcurrency ?? "unknown",
        deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? "unknown",
      }),
    },
    { name: "Connection", value: getConnectionInfo },
    { name: "Navigation", value: getNavigationInfo },
    { name: "JavaScript Memory", value: getMemoryInfo },
    {
      name: "Document",
      value: () => ({
        characterSet: document.characterSet,
        contentType: document.contentType,
        compatMode: document.compatMode,
        visibilityState: document.visibilityState,
        referrer: document.referrer || "none",
        nodes: document.getElementsByTagName("*").length,
        scripts: document.scripts.length,
        stylesheets: document.styleSheets.length,
        images: document.images.length,
      }),
    },
    {
      name: "RodEruda build",
      value: {
        version: DEVTOOLS_BUILD_INFO.version,
        commit: DEVTOOLS_BUILD_INFO.sha,
        shortCommit: DEVTOOLS_BUILD_INFO.shortSha,
        builtAt: DEVTOOLS_BUILD_INFO.builtAt,
        builtAtGmtMinus3: DEVTOOLS_BUILD_INFO.builtAtGmtMinus3,
        timezone: DEVTOOLS_BUILD_INFO.timezone,
        mode: DEVTOOLS_BUILD_INFO.mode,
      },
    },
    {
      name: "RodEruda Devtools",
      value: {
        implementation: "Native TypeScript",
        dependencies: ["Cipo", "Fábrica"],
        runtimeDependencies: 0,
      },
    },
  ];
}
