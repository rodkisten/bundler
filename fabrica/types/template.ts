/** Dynamic component prop descriptor emitted by the template parser. */
export type ComponentPropPart =
  | {
      name: string;
      index: number;
      indices: number[];
      strings: string[];
      raw: boolean;
      spread?: false;
    }
  | {
      index: number;
      spread: true;
    };

/** Template part compiled from one HTML template. */
export type TemplatePart =
  | {
      type: "child";
      index: number;
      path: number[];
      pathKey: string;
      order: number;
      componentProp?: boolean;
    }
  | {
      type: "attribute";
      index: number;
      indices: number[];
      strings: string[];
      raw: boolean;
      path: number[];
      pathKey: string;
      order: number;
      name: string;
      componentProp?: boolean;
    }
  | {
      type: "spread";
      index: number;
      path: number[];
      pathKey: string;
      order: number;
      componentProp?: boolean;
    }
  | {
      type: "component";
      index: number;
      path: number[];
      pathKey: string;
      order: number;
      name?: string;
      staticProps?: Record<string, unknown>;
      childParts?: TemplatePart[];
      orderedChildParts?: TemplatePart[];
      hasChildComponents?: boolean;
      hasStaticChildren?: boolean;
      dynamicPropParts?: ComponentPropPart[];
      hasDynamicPropParts?: boolean;
    };

/** Cached compiled template. */
export type CompiledTemplate = {
  template: HTMLTemplateElement;
  parts: TemplatePart[];
  /** Parts preordered so hot render paths never sort. */
  orderedParts: TemplatePart[];
  /** Lets simple templates skip component bookkeeping. */
  hasComponents: boolean;
};
