from pathlib import Path

path = Path("src/fabrica/dom.ts")
source = path.read_text()

old = '''      let children: DocumentFragment | null = null;

      if (hasCompiledChildren) {
        children = node.content.cloneNode(true) as DocumentFragment;
        const childParts = part?.orderedChildParts ?? compileParts(children);

        applyParts(
          children,
          childParts,
          values,
          part?.hasChildComponents ?? childParts.some((childPart) => childPart.type === "component"),
        );
      }

      const output = callComponentLike(
        componentValue,
        children && (part?.hasStaticChildren || hasMeaningfulComponentChildren(children)) ? { ...props, children } : props,
      );
'''

new = '''      const hasMeaningfulChildren = hasCompiledChildren
        && (part?.hasStaticChildren || hasMeaningfulComponentChildren(node.content));

      /**
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
        : null;

      const output = callComponentLike(
        componentValue,
        children ? { ...props, children } : props,
      );
'''

if new in source:
    print("Fábrica lazy component children patch already applied.")
elif old not in source:
    raise SystemExit("Expected Fábrica component children block was not found.")
else:
    path.write_text(source.replace(old, new))
    print("Applied Fábrica lazy component children patch.")
