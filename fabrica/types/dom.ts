import type { Cleanup } from "@rodkisten/broto/types";
import type { RenderValue } from "./render.js";

/** DOM bag options. */
export type DomBagOptions = {
  shadow: boolean;
  important: boolean;
};

/** Callable fluent DOM bag. */
export type DomBag = ((
  props?: Record<string, unknown>,
) => DomBag) & {
  readonly $$fabricaBag: true;
  readonly elements: Element[];
  readonly el: Element | null;
  readonly count: number;
  readonly size: number;
  readonly length: number;
  readonly shadow: DomBag;
  readonly important: DomBag;
  html(
    strings: TemplateStringsArray,
    ...values: RenderValue[]
  ): DomBag;
  mount(value: RenderValue): Cleanup;
  css(input: CssInput, ...values: unknown[]): DomBag;
  appendTo(parent: ParentNode): DomBag;
  prependTo(parent: ParentNode): DomBag;
  remove(): DomBag;
  dispose(): DomBag;
};

/** CSS input accepted by CSS helpers. */
export type CssInput =
  | TemplateStringsArray
  | string
  | Record<string, unknown>;

/** Mutable runtime config used by install and DOM bag helpers. */
export type RuntimeConfig = {
  exposeDollar: boolean;
  exposeDollarEl: boolean;
  dollarAlias: string;
  forceAlias: boolean;
  createWhenSelectorMisses: boolean;
};

/** Global installation options. */
export type InstallOptions = {
  exposeDollar?: boolean;
  exposeDollarEl?: boolean;
  dollarAlias?: string;
  forceAlias?: boolean;
  createWhenSelectorMisses?: boolean;
};
