import type { GeneratedCodePage } from "./doc-types";
import { escapeHtml } from "./html-utils";

export function createCodeFrame(input: {
  code: string;
  language: string;
  title: string;
  tone?: GeneratedCodePage["kind"];
  className?: string;
}): string {
  const language = input.language || "plaintext";
  const tone = input.tone || "source";
  const title = input.title || language;

  return `<figure class="code-frame ${escapeHtml(input.className || "")}" data-code-frame data-wrap="false" data-code-tone="${escapeHtml(tone)}">
    <figcaption class="code-frame-bar">
      <span class="code-frame-dots" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="code-frame-title">${escapeHtml(title)}</span>
      <span class="code-frame-meta">${escapeHtml(language)}</span>
      <span class="code-frame-actions">
        <button class="code-action" type="button" data-code-wrap aria-pressed="false" title="Toggle word wrap">
          <span aria-hidden="true">↩</span>
          <span>Wrap</span>
        </button>
        <button class="code-action" type="button" data-code-copy title="Copy code">
          <span aria-hidden="true">⧉</span>
          <span data-copy-label>Copy</span>
        </button>
      </span>
    </figcaption>
    <pre><code class="language-${escapeHtml(language)}">${escapeHtml(input.code)}</code></pre>
  </figure>`;
}
