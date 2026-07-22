import { describe, expect, it } from "vitest";
import { ecosystemSitePlugin } from "./site-plugin";

function runTransform(html: string): string {
  const plugin = ecosystemSitePlugin({ projectId: "broto" });
  const transform = plugin.transformIndexHtml;
  if (typeof transform !== "function") throw new Error("Expected transformIndexHtml hook.");
  const result = transform(html, {} as never);
  if (typeof result !== "string") throw new Error("Expected synchronous HTML transform.");
  return result;
}

describe("ecosystem site plugin", () => {
  it("injects canonical SEO, cross-project navigation and Rod footer", () => {
    const html = runTransform("<!doctype html><html><head><title>Old</title></head><body><main>Broto</main></body></html>");

    expect(html).toContain('rel="canonical" href="https://rod.migos.club/bundler/broto/"');
    expect(html).toContain('data-rod-ecosystem-nav');
    expect(html).toContain('/bundler/fabrica/');
    expect(html).toContain('/bundler/cipo/');
    expect(html).toContain('data-rod-ecosystem-footer');
    expect(html).toContain('https://github.com/rodkisten');
    expect(html).toContain('application/ld+json');
  });
});
