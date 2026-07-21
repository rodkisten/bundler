import type { RenderValue } from "../../types.js";
import type { CompiledProp } from "../html-parser.js";

export interface FabricaCompiledElementProps {
  readonly [key: string]: unknown;
}

export type RuntimeComponent = (
  props: FabricaCompiledElementProps,
) => RenderValue;

export type CompactRuntimeCompiledTemplate = readonly CompactRuntimeNode[];
export type RuntimeCompiledTemplateInput =
  | RuntimeCompiledTemplate
  | CompactRuntimeCompiledTemplate;

export type CompactRuntimeNode =
  | readonly [
      0,
      string | RuntimeComponent,
      readonly CompactRuntimeProp[],
      readonly CompactRuntimeNode[],
    ]
  | readonly [1, string]
  | readonly [2, number];

export type CompactRuntimeProp =
  | readonly [0, string, string | true]
  | readonly [1, string, number]
  | readonly [2, string, readonly string[], readonly number[]]
  | readonly [3, number];

export interface RuntimeCompiledTemplate {
  readonly nodes: readonly RuntimeNode[];
}

export interface RuntimeElementNode {
  readonly type: "element";
  readonly tag: string | RuntimeComponent;
  readonly props: readonly RuntimeProp[];
  readonly children: RuntimeNode[];
}

export interface RuntimeTextNode {
  readonly type: "text";
  readonly value: string;
}

export interface RuntimeValueNode {
  readonly type: "value";
  readonly index: number;
}

export type RuntimeNode =
  | RuntimeElementNode
  | RuntimeTextNode
  | RuntimeValueNode;

/** Same shape as CompiledProp; aliased for readable runtime APIs. */
export type RuntimeProp = CompiledProp;
