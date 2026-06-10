import type { RootEntry } from "./config";
import type { SourceExample } from "./example-extractor";

export type LandingInput = {
  entries: RootEntry[];
  outputs: string[];
  namespace: string;
  examples?: Record<string, SourceExample[]>;
};

/**
 * Creates the generated documentation landing page.
 *
 * @remarks
 * The template uses a responsive forest/mata design with layered gradients,
 * glass panels, noise, blur, soft masks and mobile-safe code blocks. It is kept
 * as a string builder because the build script has no client runtime.
 *
 * @param input - Landing page data.
 * @returns HTML document.
 *
 * @example
 * ```ts
 * createIndexHtml({ entries, outputs, namespace: "Rod", examples });
 * ```
 */
export function createIndexHtml(input: LandingInput): string {
  const cards = input.entries.map((entry) => createToolCard(entry, input.outputs, input.examples?.[entry.name] || [])).join("\n");
  const toolCount = input.entries.length;

  return `<!doctype html>
<html lang="en">
<head>
${createHead()}
</head>
<body>
  <div class="forest-noise" aria-hidden="true"></div>
  <div class="canopy canopy-one" aria-hidden="true"></div>
  <div class="canopy canopy-two" aria-hidden="true"></div>
  <div class="canopy canopy-three" aria-hidden="true"></div>
  <main class="shell">
    <section class="hero">
      <p class="eyebrow">Rod ecosystem · mata runtime</p>
      <h1>Browser tools growing from one forest floor.</h1>
      <p class="lede">A mobile-first bundle system for Broto, Fábrica, Fabrica Elements and Cipó: reactive roots, UI vines, element branches and CSS canopy, published as standalone IIFE and ESM builds.</p>
      <div class="architecture" aria-label="Architecture overview">
        ${createArchitectureMap()}
      </div>
      <div class="stats">
        <span><strong>${toolCount}</strong> tools</span>
        <span><strong>IIFE</strong> normal + min</span>
        <span><strong>ESM</strong> normal + min</span>
        <span><strong>Examples</strong> grouped TSDoc</span>
      </div>
    </section>
    <section class="grid">
${cards}
    </section>
  </main>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js"></script>
  <script>window.hljs && window.hljs.highlightAll();</script>
</body>
</html>`;
}

function createHead(): string {
  return `  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Rod Browser Tools</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=Playfair+Display:wght@700;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/tokyo-night-dark.min.css" />
  <style>${createStyles()}</style>`;
}

function createArchitectureMap(): string {
  const groups = [
    ["Broto", "signal · computed · effect · batch · store · graph · scheduler · resources"],
    ["Fábrica", "html · parser · renderer · directives · DOM parts · components · hydration"],
    ["Fabrica Elements", "createElement · adapters · props · refs · children · wrappers"],
    ["Cipó", "css runtime · aliases · tokens · atomic engine · stylesheet compiler"],
  ] as const;

  return groups.map(([name, body]) => `<article><strong>${escapeHtml(name)}</strong><span>${escapeHtml(body)}</span></article>`).join("");
}

function createToolCard(entry: RootEntry, outputs: string[], examples: SourceExample[]): string {
  const files = outputs.filter((output) => output.startsWith(`${entry.name}.`));
  const links = files
    .filter((file) => file.endsWith(".js"))
    .map((file) => `<a href="./${escapeHtml(file)}">${escapeHtml(file)}</a>`)
    .join("");
  const requireLine = `// @require https://OWNER.github.io/REPO/${entry.name}.iife.js\nconst ${entry.globalName} = window.${entry.globalName};`;
  const importLine = `import * as ${entry.globalName} from "https://OWNER.github.io/REPO/${entry.name}.esm.js";`;
  const tags = entry.tool.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  const exampleBlocks = examples.slice(0, 16).map(createExampleBlock).join("");

  return `      <article class="card">
        <div class="card-top">
          <p class="tool-name">${escapeHtml(entry.tool.name)}</p>
          <code>window.${escapeHtml(entry.globalName)}</code>
        </div>
        <p class="description">${escapeHtml(entry.tool.description)}</p>
        <div class="tags">${tags || "<span>browser</span><span>iife</span>"}</div>
        <div class="links">${links}</div>
        <div class="code-stack">
          <pre><code class="language-js">${escapeHtml(requireLine)}</code></pre>
          <pre><code class="language-js">${escapeHtml(importLine)}</code></pre>
        </div>
        ${exampleBlocks ? `<details class="examples" open><summary>Examples from source comments</summary>${exampleBlocks}</details>` : ""}
      </article>`;
}

function createExampleBlock(example: SourceExample): string {
  return `<section class="example-block" data-group="${escapeHtml(example.groupId)}">
    ${example.isFirstInGroup && example.groupComment ? `<div class="example-group"><strong>${escapeHtml(example.groupTitle)}</strong><p>${escapeHtml(example.groupComment)}</p></div>` : ""}
    <header><strong>${escapeHtml(example.title)}</strong><span>${escapeHtml(example.file)}</span></header>
    ${example.comment ? `<p class="example-comment">${escapeHtml(example.comment)}</p>` : ""}
    <pre><code class="language-ts">${escapeHtml(example.code)}</code></pre>
  </section>`;
}

function createStyles(): string {
  return `:root {
  color-scheme: dark;
  --bg: #03110c;
  --bg-2: #061a11;
  --soil: #130f0a;
  --moss: #a8ff60;
  --leaf: #34d399;
  --fern: #22c55e;
  --deep: #052e1b;
  --water: #5eead4;
  --gold: #f7c948;
  --orchid: #d8b4fe;
  --text: #f4fff6;
  --muted: #a8cbb5;
  --panel: rgb(8 36 24 / .62);
  --panel-strong: rgb(13 54 35 / .76);
  --line: rgb(209 250 229 / .16);
  --line-strong: rgb(168 255 96 / .32);
  --shadow: 0 32px 120px rgb(0 0 0 / .42);
  --radius: 30px;
}
* { box-sizing: border-box; }
html { min-width: 0; background: var(--bg); }
body {
  margin: 0;
  min-width: 0;
  min-height: 100dvh;
  overflow-x: hidden;
  color: var(--text);
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background:
    radial-gradient(circle at 12% 8%, rgb(168 255 96 / .20), transparent 24rem),
    radial-gradient(circle at 92% 12%, rgb(94 234 212 / .18), transparent 28rem),
    radial-gradient(circle at 58% 105%, rgb(247 201 72 / .14), transparent 32rem),
    linear-gradient(145deg, var(--bg), var(--deep) 48%, var(--soil));
}
body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: .45;
  background:
    linear-gradient(120deg, transparent 0 35%, rgb(255 255 255 / .035) 40%, transparent 46% 100%),
    repeating-linear-gradient(90deg, rgb(255 255 255 / .025) 0 1px, transparent 1px 58px),
    repeating-linear-gradient(0deg, rgb(255 255 255 / .018) 0 1px, transparent 1px 58px);
  mask-image: linear-gradient(to bottom, black, transparent 86%);
}
.forest-noise {
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: .18;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.7'/%3E%3C/svg%3E");
}
.canopy {
  position: fixed;
  width: min(44vw, 34rem);
  aspect-ratio: 1;
  border-radius: 999px;
  filter: blur(62px) saturate(135%);
  opacity: .30;
  pointer-events: none;
  animation: drift 15s ease-in-out infinite alternate;
}
.canopy-one { left: -12rem; top: 12rem; background: var(--fern); }
.canopy-two { right: -10rem; top: 2rem; background: var(--water); animation-delay: -5s; }
.canopy-three { left: 44%; bottom: -16rem; background: var(--gold); animation-delay: -8s; }
.shell { width: min(1220px, calc(100% - 32px)); margin: 0 auto; padding: clamp(24px, 6vw, 78px) 0; position: relative; min-width: 0; }
.hero {
  position: relative;
  overflow: hidden;
  padding: clamp(28px, 6vw, 62px);
  border: 1px solid var(--line);
  border-radius: clamp(28px, 5vw, 46px);
  background:
    linear-gradient(135deg, rgb(255 255 255 / .13), rgb(255 255 255 / .035)),
    radial-gradient(circle at 15% 0%, rgb(168 255 96 / .14), transparent 34rem),
    var(--panel);
  box-shadow: var(--shadow);
  backdrop-filter: blur(24px) saturate(150%);
}
.hero::after {
  content: "";
  position: absolute;
  inset: auto -10% -36% -10%;
  height: 16rem;
  background: radial-gradient(ellipse at center, rgb(168 255 96 / .18), transparent 65%);
  pointer-events: none;
}
.eyebrow { margin: 0 0 18px; color: var(--moss); text-transform: uppercase; letter-spacing: .22em; font-size: 12px; font-weight: 900; }
h1 { margin: 0; max-width: 920px; font-family: "Playfair Display", Georgia, serif; font-size: clamp(48px, 9vw, 118px); line-height: .86; letter-spacing: -.075em; background: linear-gradient(115deg, #fff 8%, var(--moss), var(--water), var(--gold)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.lede { max-width: 800px; color: var(--muted); font-size: clamp(16px, 2vw, 22px); line-height: 1.62; margin: 22px 0 0; }
.architecture { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 28px; }
.architecture article { min-width: 0; border: 1px solid var(--line); border-radius: 20px; padding: 14px; background: rgb(0 0 0 / .18); }
.architecture strong { display: block; color: var(--text); font-size: 14px; margin-bottom: 6px; }
.architecture span { display: block; color: var(--muted); font-size: 12px; line-height: 1.45; }
.stats { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 28px; }
.stats span, .tags span { border: 1px solid var(--line); background: rgb(255 255 255 / .065); border-radius: 999px; padding: 10px 14px; color: var(--muted); backdrop-filter: blur(16px); }
.stats strong { color: white; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 18px; margin-top: 18px; min-width: 0; }
.card { min-width: 0; border: 1px solid var(--line); border-radius: var(--radius); background: linear-gradient(180deg, var(--panel), rgb(0 0 0 / .14)); padding: clamp(18px, 3vw, 24px); box-shadow: 0 24px 90px rgb(0 0 0 / .28); backdrop-filter: blur(20px) saturate(145%); }
.card:hover { border-color: var(--line-strong); }
.card-top { display: flex; justify-content: space-between; gap: 12px; align-items: center; min-width: 0; }
.tool-name { margin: 0; font-weight: 900; font-size: 22px; }
code, pre { font-family: "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace; }
.card-top code { max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--water); border: 1px solid var(--line); padding: 8px 10px; border-radius: 14px; background: rgb(0 0 0 / .28); }
.description { color: var(--muted); line-height: 1.62; }
.tags, .links { display: flex; gap: 8px; flex-wrap: wrap; margin: 16px 0; }
.tags span { font-size: 12px; padding: 7px 10px; }
.links a { color: white; text-decoration: none; border: 1px solid var(--line); border-radius: 13px; padding: 8px 10px; background: linear-gradient(135deg, rgb(168 255 96 / .14), rgb(94 234 212 / .10)); }
pre { margin: 12px 0 0; border-radius: 18px; overflow: auto; max-width: 100%; border: 1px solid rgb(255 255 255 / .09); background: #04110d !important; -webkit-overflow-scrolling: touch; }
pre code { display: block; min-width: max-content; max-width: none; font-size: 12px; line-height: 1.55; white-space: pre; overflow-wrap: normal; word-break: normal; }
.code-stack, .examples, .example-block { min-width: 0; }
.examples { margin-top: 16px; border-top: 1px solid var(--line); padding-top: 14px; }
.examples summary { cursor: pointer; color: var(--moss); font-weight: 900; }
.example-block { margin-top: 14px; }
.example-group { border: 1px solid var(--line); border-radius: 18px; padding: 12px; background: rgb(0 0 0 / .18); margin-bottom: 10px; }
.example-group strong { color: var(--moss); }
.example-group p, .example-comment { color: var(--muted); font-size: 13px; line-height: 1.58; white-space: pre-line; margin: 8px 0 0; }
.example-block header { display: flex; gap: 8px; justify-content: space-between; align-items: baseline; color: var(--muted); font-size: 12px; min-width: 0; }
.example-block header strong { color: var(--text); }
.example-block header span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@keyframes drift { from { transform: translate3d(0, 0, 0) scale(1); } to { transform: translate3d(4rem, -2rem, 0) scale(1.14); } }
@media (max-width: 860px) { .architecture { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 620px) { .shell { width: min(100% - 20px, 1220px); } .architecture { grid-template-columns: 1fr; } .card-top { align-items: flex-start; flex-direction: column; } .card-top code { max-width: 100%; } }
@media (prefers-reduced-motion: reduce) { .canopy { animation: none; } }`;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
