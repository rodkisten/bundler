const htmlEntityCache = new Map<string, string>();

/** Mirrors browser HTML parsing for static text and attribute chunks. */
export function decodeHtmlEntities(value: string): string {
  if (!value.includes("&")) return value;
  const cached = htmlEntityCache.get(value);
  if (cached != null) return cached;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  const decoded = textarea.value;
  htmlEntityCache.set(value, decoded);
  return decoded;
}
