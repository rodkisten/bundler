import { $, createDomBag } from "@/bag";
import { component } from "@/component";
import { css } from "@/css";
import { debug, setDebug } from "@/debug";
import { classMap, ref, repeat, styleMap, when } from "@/directives";
import { html, mount, render } from "@/dom";
import { install as installGlobal, noConflict as restoreGlobals } from "@/install";
import { config } from "@/install-state";
import { rawHtml } from "@/raw";
import { batch, computed, effect, memo, onCleanup, signal, untrack } from "@/reactivity";
import type { DebugSnapshot, DomBag, InstallOptions, RawHtml, RenderValue, Signal } from "@/types";

/** Public FabricaDOM API shape. */
export type FabricaApi = {
  html: typeof html & { raw(value: string): RawHtml };
  render: typeof render;
  mount: typeof mount;
  component: typeof component;
  signal: typeof signal;
  effect: typeof effect;
  onCleanup: typeof onCleanup;
  computed: typeof computed;
  memo: typeof memo;
  untrack: typeof untrack;
  batch: typeof batch;
  when: typeof when;
  repeat: typeof repeat;
  ref: typeof ref;
  classMap: typeof classMap;
  styleMap: typeof styleMap;
  css: typeof css;
  $: typeof $;
  config: typeof config;
  install(options?: InstallOptions): FabricaApi;
  noConflict(): FabricaApi;
  setDebug(enabled: boolean): void;
  debug(): Readonly<DebugSnapshot>;
};

/**
 * Creates the frozen public API object.
 *
 * @returns Public API.
 */
export function createFabricaApi(): FabricaApi {
  const htmlWithRaw = html as FabricaApi["html"];
  htmlWithRaw.raw = rawHtml;

  Object.assign($, {
    html: htmlWithRaw,
    css,
    raw: rawHtml,
    signal,
    effect,
    computed,
    memo,
    batch,
    untrack,
    component,
    when,
    repeat,
    ref,
    classMap,
    styleMap,
    createDomBag,
  });

  const api = {
    html: htmlWithRaw,
    render,
    mount,
    component,
    signal,
    effect,
    onCleanup,
    computed,
    memo,
    untrack,
    batch,
    when,
    repeat,
    ref,
    classMap,
    styleMap,
    css,
    $,
    config,
    install(options?: InstallOptions): FabricaApi {
      return installGlobal(api, options);
    },
    noConflict(): FabricaApi {
      return restoreGlobals(api);
    },
    setDebug,
    debug,
  } satisfies FabricaApi;

  return Object.freeze(api);
}

/** Convenience public aliases used in examples. */
export type { DomBag, InstallOptions, RawHtml, RenderValue, Signal };
