# Build architecture

The repository uses Vite as the single JavaScript production build surface.
Vite 8 delegates bundling to Rolldown and JavaScript minification to Oxc. TypeScript
is still used to emit declaration files for npm packages, but it no longer emits the
runtime JavaScript consumed by published packages.

## Entry points

- `scripts/build.ts` is orchestration only. It cleans `dist`, discovers selected browser
  entries, invokes the bundle builder, generates the documentation portal, builds public
  landing pages and writes the final manifest.
- `scripts/build/browser-bundles.ts` owns root IIFE publication. Every normal and
  minified browser bundle is produced by Vite.
- `scripts/build-package.ts` owns npm package JavaScript. It uses Vite/Rolldown in
  preserve-modules mode, keeping the package's module surface while TypeScript emits
  declarations separately with `--emitDeclarationOnly`.
- `scripts/build/documentation.ts` owns Markdown, source, test, workflow and benchmark
  portal pages.
- `scripts/build/landing-pages.ts` owns public landing pages and routes each of them
  through the shared Vite site configuration.

## Shared Vite configuration

`scripts/vite/shared-config.ts` contains the shared contracts for browser IIFEs, preserve-modules npm packages, landing pages and the generated multi-page documentation portal:

- browser library builds: ES2022/Safari 16.4 target, sourcemaps, Rolldown tree-shaking, Oxc minification and deterministic IIFE names;
- package module builds: preserve-modules ESM output with bare workspace/dependency imports externalized;
- landing builds: the same browser target plus Lightning CSS minification and the shared ecosystem site plugin;
- documentation builds: Vite multi-page output over the generated docs staging tree.

`devtools/vite.config.ts` and `maquina/vite.config.ts` are intentionally tiny. Their real
configuration lives in `scripts/vite/project-configs.ts`, which removes the previous
copy/paste drift.

## Shared site and SEO

`scripts/site/ecosystem.ts` is the canonical navigation graph for everything under
`https://rod.migos.club/bundler/`. It owns project URLs, cross-links and Rod Kisten social
links.

`scripts/vite/site-plugin.ts` injects into every Vite-built landing page:

- canonical URL;
- meta description and robots policy;
- Open Graph and Twitter cards;
- JSON-LD structured data;
- ecosystem navigation;
- shared footer and social links.

`scripts/build/seo.ts` emits `sitemap.xml` and `robots.txt` from the same project registry and generated documentation inventory.

The generated documentation portal uses the same registry and shell through
`scripts/docs/page-shell.ts`, so docs and product pages do not become separate islands.

## Build selection

`BUILD_ENTRIES=broto,fabrica` builds only the selected browser bundles and their matching
landing pages. An empty value or `all` produces the full ecosystem.

## Why TypeScript still appears in package build scripts

Vite owns JavaScript generation. `tsc --emitDeclarationOnly` exists solely to generate
`.d.ts` and `.d.ts.map` files required by npm consumers. It is not a competing bundler.
