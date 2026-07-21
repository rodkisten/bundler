import type {
  Cleanup,
  ReactiveExpression,
  Signal,
} from "@rodkisten/broto/types";
import type {
  Component,
  ComponentPayload,
  ComponentRenderRequest,
  ElementPayload,
} from "./components.js";
import type {
  Directive,
  RefValue,
} from "./directives.js";
import type { DomBag } from "./dom.js";

/** Symbol attached non-enumerably to materialized Fábrica template results. */
export const FABRICA_HTML_ARTIFACT = Symbol.for(
  "rod.fabrica.html.artifact",
);

/** Re-materializable metadata carried by every `html``...`` result. */
export type HtmlArtifact = {
  readonly kind: "fabrica.html";
  readonly strings: readonly string[];
  readonly values: readonly RenderValue[];
  readonly jsx: boolean;
  materialize(): HtmlResult;
};

/** A real DOM node that carries its template artifact through a symbol. */
export type HtmlResult = Node & {
  readonly [FABRICA_HTML_ARTIFACT]: HtmlArtifact;
};

/** Callable tagged-template function shared by `html` and `jsx.html`. */
export type HtmlTemplateTag = (
  strings: TemplateStringsArray,
  ...values: RenderValue[]
) => HtmlResult;

/** Public tagged-template surface used by default and instance runtimes. */
export type HtmlTag = HtmlTemplateTag & {
  readonly jsx: HtmlTemplateTag;
  artifact(value: unknown): HtmlArtifact | undefined;
  isResult(value: unknown): value is HtmlResult;
};

/** Bivariant event callback accepted by template event interpolations. */
export type TemplateEventHandler = {
  bivarianceHack(event: Event): unknown;
}["bivarianceHack"];

/** Bivariant element ref callback accepted by `ref=` interpolations. */
export type TemplateRefHandler = {
  bivarianceHack(node: Element): void | Cleanup;
}["bivarianceHack"];

/** Explicit wrapper required for intentional raw HTML insertion. */
export type RawHtml = {
  readonly __kind: "rawHtml";
  readonly value: string;
};

/** Plain object accepted by spreads and component `props=${...}` bags. */
export type PropsBag = Record<string, unknown>;

/** Values accepted by the DOM renderer. */
export type RenderValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | Node
  | DocumentFragment
  | readonly RenderValue[]
  | Signal<unknown>
  | ReactiveExpression<unknown>
  | RefValue<HTMLElement>
  | Directive
  | RawHtml
  | DomBag
  | ElementPayload
  | ComponentPayload
  | Component
  | ComponentRenderRequest
  | PropsBag
  | TemplateEventHandler
  | TemplateRefHandler;
