from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"Expected block not found in {path}:\n{old[:240]}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "src/fabrica/dom.ts",
    'const rawHtmlTemplateCache = new Map<string, HTMLTemplateElement>();\n\ntype DynamicComponentPropPart = ComponentPropPart;',
    '''const rawHtmlTemplateCache = new Map<string, HTMLTemplateElement>();

/**
 * Defers nested child bindings until a component appends its children.
 * The public component contract remains a real DocumentFragment.
 */
type DeferredComponentChildren = {
  readonly parts: readonly TemplatePart[];
  readonly values: readonly RenderValue[];
  readonly hasComponents: boolean;
  readonly runtime: FabricaRuntimeContext;
};

const deferredComponentChildren = new WeakMap<DocumentFragment, DeferredComponentChildren>();

type DynamicComponentPropPart = ComponentPropPart;''',
)

replace_once(
    "src/fabrica/dom.ts",
    '''    const parent = text.parentElement;
    const value = text.data;

    if (
      parent
      && !/^(PRE|TEXTAREA|SCRIPT|STYLE)$/.test(parent.tagName)
      && /^[\\t\\r\\n ]+$/.test(value)
      && /[\\t\\r\\n]/.test(value)
    ) {''',
    '''    const parent = text.parentNode;
    const parentElement = parent instanceof Element ? parent : null;
    const value = text.data;

    if (
      parent
      && (!parentElement || !/^(PRE|TEXTAREA|SCRIPT|STYLE)$/.test(parentElement.tagName))
      && /^[\\t\\r\\n ]+$/.test(value)
      && /[\\t\\r\\n]/.test(value)
    ) {''',
)

replace_once(
    "src/fabrica/dom.ts",
    '''  if (isDomNode(resolvedValue)) {
    parentNode.insertBefore(resolvedValue, beforeNode);
    return;
  }''',
    '''  if (resolvedValue instanceof DocumentFragment) {
    const deferred = deferredComponentChildren.get(resolvedValue);

    if (deferred) {
      deferredComponentChildren.delete(resolvedValue);
      runWithFabricaRuntime(deferred.runtime, () => {
        applyParts(resolvedValue, deferred.parts, deferred.values, deferred.hasComponents);
        pruneInsignificantWhitespace(resolvedValue);
      });
    }

    parentNode.insertBefore(resolvedValue, beforeNode);
    return;
  }

  if (isDomNode(resolvedValue)) {
    parentNode.insertBefore(resolvedValue, beforeNode);
    return;
  }''',
)

replace_once(
    "src/fabrica/dom.ts",
    '''      /**
       * Component children are materialized lazily under the component owner.
       *
       * Eagerly applying nested component parts here makes every child a sibling
       * of the provider component. Context providers then run too late: nested
       * consumers have already been constructed and cannot see the value. A lazy
       * render expression keeps the public `props.children` shape while deferring
       * nested component creation until the parent component appends its output.
       */
      const children = hasMeaningfulChildren
        ? (() => {
            const fragment = node.content.cloneNode(true) as DocumentFragment;
            const childParts = part?.orderedChildParts ?? compileParts(fragment);

            applyParts(
              fragment,
              childParts,
              values,
              part?.hasChildComponents ?? childParts.some((childPart) => childPart.type === "component"),
            );
            pruneInsignificantWhitespace(fragment);
            return fragment;
          })
        : null;''',
    '''      /**
       * Keep the historical DocumentFragment children contract while delaying
       * nested part binding until the fragment is appended under this owner.
       */
      let children: DocumentFragment | null = null;

      if (hasMeaningfulChildren) {
        children = node.content.cloneNode(true) as DocumentFragment;
        const childParts = part?.orderedChildParts ?? compileParts(children);

        deferredComponentChildren.set(children, {
          parts: childParts,
          values,
          hasComponents: part?.hasChildComponents
            ?? childParts.some((childPart) => childPart.type === "component"),
          runtime,
        });
      }''',
)

replace_once(
    "src/devtools/core/runtime.ts",
    '''export const html = devtoolsFabrica.html;
export const jsx = devtoolsFabrica.jsx;''',
    '''const baseHtml = devtoolsFabrica.html;

/** Materializes templates under the shared DevTools owner, even before render(). */
export const html: typeof baseHtml = new Proxy(baseHtml, {
  apply(target, thisArg, argumentsList: Parameters<typeof baseHtml>) {
    return runInDevtoolsOwner(() =>
      devtoolsFabrica.run(() => Reflect.apply(target, thisArg, argumentsList)),
    );
  },
});

export const jsx = Object.freeze({
  ...devtoolsFabrica.jsx,
  html: new Proxy(devtoolsFabrica.jsx.html, {
    apply(target, thisArg, argumentsList: Parameters<typeof devtoolsFabrica.jsx.html>) {
      return runInDevtoolsOwner(() =>
        devtoolsFabrica.run(() => Reflect.apply(target, thisArg, argumentsList)),
      );
    },
  }),
});''',
)

replace_once(
    "src/maquina/editor.ts",
    '''  const whiteSpace = options.lineWrapping === false ? "pre" : "pre-wrap";
  textarea.style.whiteSpace = whiteSpace;
  highlight.style.whiteSpace = whiteSpace;''',
    '''  const whiteSpace = options.lineWrapping === false ? "pre" : "pre-wrap";
  textarea.style.fontSize = "16px";
  highlight.style.fontSize = "16px";
  textarea.style.whiteSpace = whiteSpace;
  highlight.style.whiteSpace = whiteSpace;''',
)

replace_once(
    "src/devtools/devtools.bundle-mount.test.ts",
    '''  Object.defineProperty(globalThis, "TextEncoder", { configurable: true, value: TextEncoder });
  Object.defineProperty(globalThis, "TextDecoder", { configurable: true, value: TextDecoder });''',
    '''  Object.defineProperty(globalThis, "TextEncoder", { configurable: true, value: TextEncoder });
  Object.defineProperty(globalThis, "TextDecoder", { configurable: true, value: TextDecoder });
  const NativeUint8Array = new TextEncoder().encode("").constructor;
  Object.defineProperty(globalThis, "Uint8Array", { configurable: true, value: NativeUint8Array });''',
)

for transient in (
    ".github/workflows/fix-context-v2-tests.yml",
    ".github/workflows/fix-context-v2-pr.yml",
    "scripts/fix-context-v2-tests.py",
):
    path = Path(transient)
    if path.exists():
        path.unlink()
