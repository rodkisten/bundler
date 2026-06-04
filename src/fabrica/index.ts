export function html(strings: TemplateStringsArray, ...values: unknown[]): DocumentFragment {
  const template = document.createElement("template");
  template.innerHTML = strings.reduce((output, chunk, index) => `${output}${chunk}${String(values[index] ?? "")}`, "");
  return template.content.cloneNode(true) as DocumentFragment;
}
export function render(container: Element, value: Node): () => void {
  container.replaceChildren(value);
  return () => container.replaceChildren();
}
export const version = "1.0.0";
export default { html, render, version };
