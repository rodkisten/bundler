import {
  createOwner,
  disposeOwner,
  getOwner,
  runWithOwner,
} from "@rodkisten/broto/owner";
import { effect } from "@rodkisten/broto/reactivity";
import {
  mergeComponentDataProps,
  mergeComponentSpreadProps,
  normalizeComponentPropName,
} from "../bindings/component-props.js";
import { composeAttributeValue } from "../bindings/interpolation.js";
import {
  getCurrentFabricaRuntime,
  runWithFabricaRuntime,
} from "../core/runtime-context.js";
import { hasReactiveValue, readValue } from "../core/value.js";
import {
  isDirective,
  isSignal,
} from "../guards.js";
import { compileParts } from "../template/index.js";
import type {
  ComponentPropPart,
  RenderValue,
  TemplatePart,
} from "../types.js";
import { registerCleanup } from "./cleanup.js";
import { deferFragmentBindings } from "./deferred.js";
import { pruneInsignificantWhitespace } from "./html-result.js";
import { invokeComponentLike } from "./payload.js";
import { createChildPart } from "./value.js";

export type ComponentPartBindingHost = {
  bindFragmentParts(
    fragment: DocumentFragment,
    parts: readonly TemplatePart[],
    values: readonly RenderValue[],
    hasComponents?: boolean,
  ): void;
};

type DynamicComponentPropPart = ComponentPropPart;

/**
 * Binds one component placeholder emitted by the template parser.
 *
 * Component invocation is intentionally isolated from generic DOM attribute
 * bindings. Props are normalized once, reactive inputs re-run the component
 * factory under an owner, and child fragment bindings remain deferred until the
 * component actually inserts its `children` fragment.
 */
export function bindComponentPart(
  node: Node,
  value: RenderValue | undefined,
  values: readonly RenderValue[],
  host: ComponentPartBindingHost,
  part?: Extract<TemplatePart, { type: "component" }>,
  dynamicPropParts: DynamicComponentPropPart[] = [],
): void {
  if (!(node instanceof HTMLTemplateElement)) return;

  const runtime = getCurrentFabricaRuntime();
  const componentName = part?.name || readComponentName(node);
  const componentValue =
    typeof value === "function"
      ? value
      : componentName
        ? runtime.registry.resolve(componentName)
        : undefined;
  const marker = document.createComment(
    componentName
      ? `fabrica:component-tag:${componentName}`
      : "fabrica:component-tag",
  );

  node.parentNode?.insertBefore(marker, node);
  node.remove();

  const childPart = createChildPart(marker);

  if (typeof componentValue !== "function") {
    childPart.set(
      createMissingComponentFallback(
        componentName || "unknown",
      ) as RenderValue,
    );
    return;
  }

  const owner = createOwner({
    parent: getOwner(),
    name: `fabrica.componentTag:${componentName || "anonymous"}`,
  });
  registerCleanup(childPart.start, () => disposeOwner(owner));

  const renderComponent = (): void => {
    runWithFabricaRuntime(runtime, () => {
      const staticProps = part?.staticProps;
      const dynamicProps =
        dynamicPropParts.length > 0
          ? readDynamicComponentProps(
              dynamicPropParts,
              values,
              componentValue,
            )
          : null;
      const hasCompiledChildren = Boolean(
        part?.hasStaticChildren ||
          (part?.orderedChildParts?.length ?? 0) > 0,
      );
      const props = dynamicProps
        ? { ...(staticProps ?? null), ...dynamicProps }
        : hasCompiledChildren
          ? staticProps
            ? { ...staticProps }
            : {}
          : staticProps ?? {};
      const hasMeaningfulChildren =
        hasCompiledChildren &&
        hasPotentialComponentChildren(
          part,
          values,
          node.content,
        );

      let children: DocumentFragment | null = null;

      if (hasMeaningfulChildren) {
        children = node.content.cloneNode(true) as DocumentFragment;
        const childParts =
          part?.orderedChildParts ?? compileParts(children);
        const hasChildComponents =
          part?.hasChildComponents ??
          childParts.some(
            (childPart) => childPart.type === "component",
          );

        deferFragmentBindings(children, () => {
          runWithFabricaRuntime(runtime, () => {
            host.bindFragmentParts(
              children!,
              childParts,
              values,
              hasChildComponents,
            );
            pruneInsignificantWhitespace(children!);
          });
        });
      }

      const output = invokeComponentLike(
        componentValue,
        children ? { ...props, children } : props,
      );
      childPart.set(output as RenderValue);
    });
  };

  if (hasReactiveComponentInputs(dynamicPropParts, values)) {
    const dispose = runWithOwner(owner, () =>
      effect(renderComponent, {
        name:
          `fabrica.componentTagBinding:` +
          (componentName || "anonymous"),
        scheduler: "sync",
      }),
    );
    registerCleanup(childPart.start, dispose);
    return;
  }

  runWithOwner(owner, renderComponent);
}

function isDynamicComponentSpreadPropPart(
  part: DynamicComponentPropPart,
): part is Extract<ComponentPropPart, { spread: true }> {
  return "spread" in part && part.spread === true;
}

/** Returns whether component props require an owned reactive invocation. */
function hasReactiveComponentInputs(
  propParts: readonly DynamicComponentPropPart[],
  values: readonly RenderValue[],
): boolean {
  for (let index = 0; index < propParts.length; index += 1) {
    const part = propParts[index];
    if (!part) continue;

    const value = values[part.index];
    if (hasReactiveValue(value)) return true;

    if (isDynamicComponentSpreadPropPart(part)) {
      if (hasReactiveRecordValue(value)) return true;
      continue;
    }

    if (
      normalizeComponentPropName(part.name) === "props" &&
      hasReactiveRecordValue(value)
    ) {
      return true;
    }

    for (
      let valueIndex = 0;
      valueIndex < part.indices.length;
      valueIndex += 1
    ) {
      if (
        hasReactiveValue(
          values[part.indices[valueIndex]!] as unknown,
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

function hasReactiveRecordValue(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;

  const record = value as Record<string, unknown>;
  for (const key in record) {
    if (hasReactiveValue(record[key])) return true;
  }

  return false;
}

function hasMeaningfulComponentChildren(
  fragment: DocumentFragment,
): boolean {
  const children = fragment.childNodes;

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (!child) continue;
    if (child.nodeType === Node.ELEMENT_NODE) return true;
    if (
      child.nodeType === Node.TEXT_NODE &&
      (child.nodeValue ?? "").trim()
    ) {
      return true;
    }
  }

  return false;
}

function hasPotentialComponentChildren(
  part: Extract<TemplatePart, { type: "component" }> | undefined,
  values: readonly RenderValue[],
  template: DocumentFragment,
): boolean {
  if (
    part?.hasStaticChildren ||
    hasMeaningfulComponentChildren(template)
  ) {
    return true;
  }

  const childParts = part?.orderedChildParts ?? [];
  for (let index = 0; index < childParts.length; index += 1) {
    const childPart = childParts[index];
    if (!childPart) continue;
    if (childPart.type === "component") return true;
    if (childPart.type !== "child") continue;
    if (hasMeaningfulRenderValue(values[childPart.index])) return true;
  }

  return false;
}

function hasMeaningfulRenderValue(
  value: RenderValue | undefined,
): boolean {
  if (isDirective(value) || isSignal(value)) return true;

  const resolved = readValue(value) as RenderValue;
  if (
    resolved == null ||
    resolved === false ||
    resolved === true
  ) {
    return false;
  }
  if (Array.isArray(resolved)) {
    return resolved.some((item) => hasMeaningfulRenderValue(item));
  }
  if (typeof resolved === "string") {
    return resolved.trim().length > 0;
  }
  if (resolved instanceof DocumentFragment) {
    return hasMeaningfulComponentChildren(resolved);
  }
  return true;
}

function readComponentName(
  template: HTMLTemplateElement,
): string {
  return (
    template.getAttribute("data-fabrica-component-name") ||
    template.getAttribute("name") ||
    ""
  );
}

function createMissingComponentFallback(
  name: string,
): HTMLElement {
  const element = document.createElement(
    "fabrica-component-error",
  );
  element.setAttribute("role", "alert");
  element.setAttribute(
    "data-fabrica-error",
    "missing-component",
  );
  element.setAttribute("data-component", name);
  element.style.cssText = [
    "display:inline-block",
    "padding:6px 8px",
    "border:1px solid #f87171",
    "border-radius:8px",
    "background:#450a0a",
    "color:#fecaca",
    "font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace",
  ].join(";");
  element.textContent = `[Fabrica] Missing component: ${name}`;
  return element;
}

function readDynamicComponentProps(
  propParts: readonly DynamicComponentPropPart[],
  values: readonly RenderValue[],
  componentValue?: unknown,
): Record<string, unknown> {
  const props: Record<string, unknown> = {};

  for (let index = 0; index < propParts.length; index += 1) {
    const prop = propParts[index];
    if (!prop) continue;

    if (isDynamicComponentSpreadPropPart(prop)) {
      mergeComponentSpreadProps(
        props,
        readValue(values[prop.index]),
      );
      continue;
    }

    const name = normalizeComponentPropName(prop.name);
    const value = readComponentPropValue(
      prop,
      values,
      componentValue,
      name,
    );

    if (name === "props") {
      mergeComponentSpreadProps(props, readValue(value));
    } else if (name === ":data") {
      mergeComponentDataProps(props, readValue(value));
    } else {
      props[name] = value;
    }
  }

  return props;
}

function readComponentPropValue(
  part: Extract<ComponentPropPart, { spread?: false }>,
  values: readonly RenderValue[],
  componentValue: unknown,
  propName: string,
): unknown {
  if (part.raw) {
    const value = values[part.index];
    const preservedProps = (
      componentValue as {
        preserveSignalProps?: ReadonlySet<string>;
      } | null
    )?.preserveSignalProps;

    // Component props normally receive the current signal value. Components
    // that transport signals explicitly opt in per prop so callbacks and
    // ordinary function identity are never invoked as reactive expressions.
    if (
      isSignal(value) &&
      !preservedProps?.has(propName)
    ) {
      return value();
    }

    return value;
  }

  return composeAttributeValue(
    part.indices,
    part.strings,
    values,
  );
}
