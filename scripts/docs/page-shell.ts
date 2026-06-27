import { escapeHtml } from "./html-utils";

export function createHead(title: string, assetPrefix = "."): string {
  return `  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=Playfair+Display:wght@700;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/tokyo-night-dark.min.css" />
  <link rel="stylesheet" href="${assetPrefix}/assets/docs.css" />`;
}

export function createBackdrop(): string {
  return `<div class="forest-noise" aria-hidden="true"></div>
  <div class="canopy canopy-one" aria-hidden="true"></div>
  <div class="canopy canopy-two" aria-hidden="true"></div>
  <div class="canopy canopy-three" aria-hidden="true"></div>`;
}

export function createScripts(assetPrefix = "."): string {
  return `<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js"></script>
  <script src="${assetPrefix}/assets/docs-client.js"></script>`;
}
