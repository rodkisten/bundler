import type { Plugin } from "vite";
import {
  ECOSYSTEM_SHELL_CSS,
  absoluteSiteUrl,
  getEcosystemProject,
  renderEcosystemFooter,
  renderEcosystemNavigation,
  type EcosystemProjectId,
} from "../site/ecosystem";

export type EcosystemSitePluginOptions = {
  readonly projectId: EcosystemProjectId;
  readonly title?: string;
  readonly description?: string;
};

/** Adds the common SEO contract, ecosystem navigation and Rod Kisten footer to every public landing page. */
export function ecosystemSitePlugin(options: EcosystemSitePluginOptions): Plugin {
  const project = getEcosystemProject(options.projectId);
  const title = options.title ?? `${project.name} · Rod ecosystem`;
  const description = options.description ?? project.description;
  const canonical = absoluteSiteUrl(project.path);

  return {
    name: "rod-ecosystem-site",
    transformIndexHtml(html) {
      const cleaned = html
        .replace(/<meta\s+name=["']description["'][^>]*>\s*/gi, "")
        .replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, "")
        .replace(/<meta\s+property=["']og:[^"']+["'][^>]*>\s*/gi, "")
        .replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>\s*/gi, "");

      const structuredData = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: project.name,
        description,
        url: canonical,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        author: {
          "@type": "Person",
          name: "Rod Kisten",
          url: "https://rod.migos.club",
        },
      }).replace(/</g, "\\u003c");

      const head = `<meta name="description" content="${escapeAttribute(description)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Rod ecosystem" />
  <meta property="og:title" content="${escapeAttribute(title)}" />
  <meta property="og:description" content="${escapeAttribute(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttribute(title)}" />
  <meta name="twitter:description" content="${escapeAttribute(description)}" />
  <style data-rod-ecosystem-shell>${ECOSYSTEM_SHELL_CSS}</style>
  <script type="application/ld+json">${structuredData}</script>`;

      return cleaned
        .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttribute(title)}</title>`)
        .replace(/<\/head>/i, `${head}\n</head>`)
        .replace(/(<body[^>]*>)/i, `$1\n${renderEcosystemNavigation(options.projectId)}`)
        .replace(/<\/body>/i, `${renderEcosystemFooter()}\n</body>`);
    },
  };
}

function escapeAttribute(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}
