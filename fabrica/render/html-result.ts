import { transferDelegatedEventRoot } from "../events.js";
import { isDomNode } from "../guards.js";
import {
  FABRICA_HTML_ARTIFACT,
  type HtmlArtifact,
  type HtmlResult,
} from "../types.js";

/** Runtime metadata consumed by the direct root-render fast path. */
export interface MaterializedHtmlResultMetadata {
  cleanupNodes: Node[];
  dynamic: boolean;
}

const materializedHtmlResultMetadata = new WeakMap<
  Node,
  MaterializedHtmlResultMetadata
>();

/** Returns the template artifact attached to a Fábrica HTML result. */
export function getHtmlArtifact(value: unknown): HtmlArtifact | undefined {
  if (!isDomNode(value)) return undefined;

  return (value as Node & {
    readonly [FABRICA_HTML_ARTIFACT]?: HtmlArtifact;
  })[FABRICA_HTML_ARTIFACT];
}

/** Returns whether a value was materialized by a Fábrica HTML template tag. */
export function isHtmlResult(value: unknown): value is HtmlResult {
  return getHtmlArtifact(value)?.kind === "fabrica.html";
}

/** Returns internal ownership metadata for a materialized HTML result. */
export function getHtmlResultMetadata(
  value: unknown,
): MaterializedHtmlResultMetadata | undefined {
  return isDomNode(value)
    ? materializedHtmlResultMetadata.get(value)
    : undefined;
}

/**
 * Converts a materialized fragment into Fábrica's polymorphic HTML result.
 *
 * A single meaningful root is returned as the real node. Empty and multi-root
 * templates remain a `DocumentFragment`, preserving native fragment semantics.
 */
export function createHtmlResult(
  fragment: DocumentFragment,
  artifact: HtmlArtifact,
  metadata: MaterializedHtmlResultMetadata,
): HtmlResult {
  const result = extractHtmlResultRoot(fragment);
  transferDelegatedEventRoot(fragment, result);

  Object.defineProperty(result, FABRICA_HTML_ARTIFACT, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: artifact,
  });

  materializedHtmlResultMetadata.set(result, metadata);
  return result as HtmlResult;
}

/**
 * Removes formatting indentation without destroying meaningful inline spaces.
 *
 * Whitespace adjacent to a dynamic part is normalized to one space because it
 * separates interpolated primitives just like native HTML parsing would.
 */
export function pruneInsignificantWhitespace(root: ParentNode): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const removals: Text[] = [];
  const normalizations: Text[] = [];
  let current = walker.nextNode();

  while (current) {
    const text = current as Text;
    const parent = text.parentNode;
    const parentElement = parent instanceof Element ? parent : null;
    const value = text.data;

    if (
      parent &&
      (!parentElement ||
        !/^(PRE|TEXTAREA|SCRIPT|STYLE)$/.test(parentElement.tagName)) &&
      /^[\t\r\n ]+$/.test(value) &&
      /[\t\r\n]/.test(value)
    ) {
      const previous = text.previousSibling;
      const next = text.nextSibling;
      const touchesDynamicPart =
        previous?.nodeType === Node.COMMENT_NODE ||
        next?.nodeType === Node.COMMENT_NODE;

      if (touchesDynamicPart && !(parent instanceof DocumentFragment)) {
        normalizations.push(text);
      } else {
        removals.push(text);
      }
    }

    current = walker.nextNode();
  }

  for (const text of normalizations) text.data = " ";
  for (const text of removals) text.remove();
}

function extractHtmlResultRoot(fragment: DocumentFragment): Node {
  const childNodes = Array.from(fragment.childNodes);
  if (childNodes.length === 1) return fragment.removeChild(childNodes[0]!);

  const meaningfulNodes = childNodes.filter(
    (node) =>
      node.nodeType !== Node.TEXT_NODE || Boolean(node.textContent?.trim()),
  );

  if (meaningfulNodes.length !== 1) return fragment;

  const root = meaningfulNodes[0]!;
  for (const node of childNodes) {
    if (
      node !== root &&
      node.nodeType === Node.TEXT_NODE &&
      !node.textContent?.trim()
    ) {
      fragment.removeChild(node);
    }
  }

  return fragment.removeChild(root);
}
