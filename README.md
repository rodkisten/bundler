# Private TS Bundler Publisher

Bundle a **private TypeScript repository** into browser-ready JavaScript and publish the generated output publicly through:

- GitHub Releases
- GitHub Pages
- Optional public GitHub Gist

This is useful when your source code must remain private, but your final browser/userscript bundle can be public.

## How it works

```txt
private GitHub repo
  -> GitHub Actions
  -> esbuild bundles TypeScript
  -> dist/bundle.esm.js for import()
  -> dist/bundle.iife.js for userscript @require
  -> publish to Release, Pages, and optionally Gist
```

## Files

```txt
.github/workflows/publish-browser-bundle.yml  GitHub Action pipeline
scripts/build.ts                             Builds ESM and IIFE bundles
scripts/publish-gist.ts                      Publishes dist files to a public gist
scripts/config.ts                            Shared script configuration helpers
src/index.ts                                 Demo private TypeScript entrypoint
examples/userscript-example.user.js          Userscript @require example
examples/esm-example.html                    Browser ESM import example
```

## Setup

Install dependencies:

```bash
pnpm install
```

Build locally:

```bash
pnpm build
```

The generated files appear in `dist/`:

```txt
dist/bundle.esm.js
dist/bundle.iife.js
dist/index.html
```

## Configure the private repo

Edit the workflow env block:

```yaml
env:
  BUILD_ENTRYPOINT: src/index.ts
  BUILD_GLOBAL_NAME: FabricaHTML
  BUILD_MINIFY: true
```

Use your real entrypoint:

```yaml
BUILD_ENTRYPOINT: src/fabrica-html.ts
BUILD_GLOBAL_NAME: FabricaHTML
```

## Publishing to GitHub Releases

The workflow automatically creates or updates the release tag:

```txt
browser-bundle-latest
```

Your files become available as release assets.

## Publishing to GitHub Pages

In your repository settings, enable GitHub Pages with **GitHub Actions** as the source.

After the workflow runs, Pages serves:

```txt
https://OWNER.github.io/REPO/bundle.esm.js
https://OWNER.github.io/REPO/bundle.iife.js
```

## Publishing to a public Gist

Create a classic or fine-grained token with gist permission, then add these repository secrets:

```txt
GIST_TOKEN=github_pat_or_ghp_token
GIST_ID=optional_existing_gist_id
```

If `GIST_ID` is empty, the script creates a new public gist.
If `GIST_ID` is set, the script updates that gist.

## Userscript usage

Use the IIFE build:

```js
// @require https://OWNER.github.io/REPO/bundle.iife.js
```

Then access the global:

```js
const { html, signal, render } = window.FabricaHTML;
```

## Browser ESM usage

Use the ESM build:

```js
import { html, signal, render } from "https://OWNER.github.io/REPO/bundle.esm.js";
```

## Private imports

Imports inside the private repo are bundled by esbuild:

```ts
import { signal } from "./signal";
import { html } from "./html";
```

NPM dependencies are bundled too, unless you mark them external in `scripts/build.ts`.

## Security note

The source repository stays private, but the generated JavaScript is public. Anyone with the final URL can read the generated bundle.

Do not bundle secrets, private tokens, or internal credentials into browser code.

## Commands

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm publish:gist
```
