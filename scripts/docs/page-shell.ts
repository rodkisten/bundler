import { escapeHtml } from "./html-utils";
import {
  ECOSYSTEM_SHELL_CSS,
  SITE_ORIGIN,
  absoluteSiteUrl,
  renderEcosystemFooter,
  renderEcosystemNavigation,
} from "../site/ecosystem";

export type PageHeadOptions = {
  readonly description?: string;
  readonly canonicalPath?: string;
};

export function createHead(title: string, assetPrefix = ".", options: PageHeadOptions = {}): string {
  const description = options.description ?? "Rod ecosystem documentation and browser runtime tooling.";
  const canonical = absoluteSiteUrl(options.canonicalPath ?? "/bundler/");
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: title,
    description,
    url: canonical,
    author: { "@type": "Person", name: "Rod Kisten", url: SITE_ORIGIN },
  }).replace(/</g, "\\u003c");

  return `  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Rod ecosystem" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(canonical)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=Playfair+Display:wght@700;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/tokyo-night-dark.min.css" />
  <link rel="stylesheet" href="${assetPrefix}/assets/docs.css" />
  <style data-rod-ecosystem-shell>${ECOSYSTEM_SHELL_CSS}</style>
  <script type="application/ld+json">${structuredData}</script>`;
}

export function createBackdrop(): string {
  return `${renderEcosystemNavigation("docs")}
  <div class="forest-noise" aria-hidden="true"></div>
  <div class="canopy canopy-one" aria-hidden="true"></div>
  <div class="canopy canopy-two" aria-hidden="true"></div>
  <div class="canopy canopy-three" aria-hidden="true"></div>`;
}

export function createScripts(assetPrefix = "."): string {
  return `${renderEcosystemFooter()}
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js"></script>
  <script type="module" src="${assetPrefix}/assets/docs-client.js"></script>`;
}
