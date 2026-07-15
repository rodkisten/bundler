import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { renderMarkdown } from "./docs/markdown-renderer";
import { escapeHtml } from "./docs/html-utils";
import { DIST_DIR, ROOT_DIR } from "./config";

const PACKAGE_DIR = path.join(ROOT_DIR, "src/nascente");
const OUTPUT_DIR = path.join(DIST_DIR, "nascente");

export type NascenteApiItem = {
  name: string;
  kind: "function" | "class" | "type" | "const";
  signature: string;
  summary: string;
  remarks: string;
  example: string;
  category: string;
};

type CategoryDefinition = {
  id: string;
  title: string;
  description: string;
  names: ReadonlySet<string>;
};

const CATEGORY_DEFINITIONS: readonly CategoryDefinition[] = [
  category("array", "Array utilities", "Single-pass transforms, bounded async work, set algebra, sampling and indexed traversal.", [
    "at", "cartesianProduct", "chunk", "combinations", "compact", "countBy", "difference", "differenceBy", "differenceWith", "drop", "dropRight", "dropRightWhile", "dropWhile", "fill", "filterAsync", "flatMap", "flatMapAsync", "flatMapDeep", "flatten", "flattenDeep", "forEachAsync", "forEachRight", "groupBy", "head", "initial", "intersection", "intersectionBy", "intersectionWith", "isSubset", "isSubsetWith", "keyBy", "last", "limitAsync", "mapAsync", "maxBy", "minBy", "orderBy", "partition", "pull", "pullAt", "reduceAsync", "remove", "sample", "sampleSize", "shuffle", "sortBy", "tail", "take", "takeRight", "takeRightWhile", "takeWhile", "toFilled", "union", "unionBy", "unionWith", "uniq", "uniqBy", "uniqWith", "unzip", "unzipWith", "windowed", "without", "xor", "xorBy", "xorWith", "zip", "zipObject", "zipWith",
  ]),
  category("function", "Function utilities", "Composition, memoization and scheduling helpers with deliberately small runtime machinery.", [
    "after", "ary", "asyncNoop", "before", "curry", "curryRight", "debounce", "flow", "flowRight", "identity", "memoize", "negate", "noop", "once", "partial", "partialRight", "rest", "retry", "spread", "throttle", "unary",
  ]),
  category("map-set", "Map & Set utilities", "Native collection transforms that avoid converting through temporary arrays or Object entries.", [
    "mapMap", "filterMap", "mapKeysMap", "mapValuesMap", "reduceMap", "everyMap", "someMap", "findKeyMap", "findValueMap", "hasValue", "forEachMap", "keyByMap", "mapSet", "filterSet", "reduceSet", "everySet", "someSet", "findSet", "forEachSet", "keyBySet",
  ]),
  category("object", "Object utilities", "Record transforms, cloning and merging without obligatory Object.entries pipelines.", [
    "clone", "cloneDeep", "cloneDeepWith", "flattenObject", "invert", "mapKeys", "mapValues", "merge", "mergeWith", "omit", "omitBy", "pick", "pickBy", "sortKeys", "toCamelCaseKeys", "toMerged", "toSnakeCaseKeys",
  ]),
  category("predicate", "Predicates", "Narrowing-friendly runtime checks for browser, Node and JavaScript built-ins.", [
    "isArrayBuffer", "isBlob", "isBoolean", "isBrowser", "isBuffer", "isDate", "isEmptyObject", "isEqual", "isEqualWith", "isError", "isFile", "isFunction", "isIterable", "isJSON", "isJSONArray", "isJSONObject", "isJSONValue", "isLength", "isMap", "isNil", "isNode", "isNotNil", "isNull", "isNumber", "isPlainObject", "isPrimitive", "isPromise", "isRegExp", "isSet", "isString", "isSymbol", "isTypedArray", "isUndefined", "isWeakMap", "isWeakSet",
  ]),
  category("math", "Math utilities", "Loop-first aggregations and numeric helpers with no callback pipeline overhead unless selection is required.", [
    "clamp", "inRange", "mean", "meanBy", "median", "medianBy", "percentile", "random", "randomInt", "range", "rangeRight", "round", "sum", "sumBy",
  ]),
  category("promise", "Promise & concurrency", "Concurrency control, cancellation-aware delays and timeout primitives for resource-constrained clients.", [
    "allKeyed", "delay", "Mutex", "Semaphore", "timeout", "withTimeout", "AbortError", "TimeoutError",
  ]),
  category("string", "String utilities", "Case conversion, escaping and trimming helpers designed around small reusable primitives.", [
    "camelCase", "capitalize", "constantCase", "deburr", "escape", "escapeRegExp", "kebabCase", "lowerCase", "lowerFirst", "pad", "pascalCase", "reverseString", "snakeCase", "startCase", "trim", "trimEnd", "trimStart", "unescape", "upperCase", "upperFirst", "words",
  ]),
  category("utility", "Utility functions", "Assertions and result-oriented attempt helpers for explicit failure handling.", [
    "assert", "attempt", "attemptAsync", "invariant",
  ]),
  category("types", "Core types", "Semantic public types shared by the flat API.", [
    "Iteratee", "Predicate", "Comparator", "Awaitable", "AsyncIteratee", "AsyncPredicate", "KeySelector", "ValueSelector", "SortDirection", "AttemptResult", "JsonValue",
  ]),
];

export async function buildNascenteDocs(): Promise<void> {
  const [source, readme, changelog] = await Promise.all([
    fs.readFile(path.join(PACKAGE_DIR, "index.ts"), "utf8"),
    fs.readFile(path.join(PACKAGE_DIR, "README.md"), "utf8"),
    fs.readFile(path.join(PACKAGE_DIR, "CHANGELOG.md"), "utf8"),
  ]);

  const api = extractNascenteApi(source);
  const html = createNascenteDocsHtml({ api, readme, changelog });

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUTPUT_DIR, "index.html"), html);
}

export function extractNascenteApi(sourceText: string): NascenteApiItem[] {
  const sourceFile = ts.createSourceFile("index.ts", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const items: NascenteApiItem[] = [];

  for (const statement of sourceFile.statements) {
    if (!isExported(statement)) continue;

    if (ts.isFunctionDeclaration(statement) && statement.name) {
      items.push(createApiItem(statement.name.text, "function", statement, sourceFile, sourceText));
      continue;
    }

    if (ts.isClassDeclaration(statement) && statement.name) {
      items.push(createApiItem(statement.name.text, "class", statement, sourceFile, sourceText));
      continue;
    }

    if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
      items.push(createApiItem(statement.name.text, "type", statement, sourceFile, sourceText));
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        items.push(createApiItem(declaration.name.text, "const", statement, sourceFile, sourceText, declaration));
      }
    }
  }

  return items.sort((left, right) => {
    const categoryDelta = categoryIndex(left.name) - categoryIndex(right.name);
    return categoryDelta || left.name.localeCompare(right.name);
  });
}

function createApiItem(
  name: string,
  kind: NascenteApiItem["kind"],
  node: ts.Node,
  sourceFile: ts.SourceFile,
  sourceText: string,
  signatureNode: ts.Node = node,
): NascenteApiItem {
  const jsDoc = ts.getJSDocCommentsAndTags(node);
  const rawDocs = jsDoc
    .map((doc) => sourceText.slice(doc.getFullStart(), doc.getEnd()))
    .filter((doc) => doc.trimStart().startsWith("/**"))
    .join("\n");
  const { summary, remarks, example } = parseTsDoc(rawDocs);

  return {
    name,
    kind,
    signature: extractSignature(signatureNode.getText(sourceFile)),
    summary,
    remarks,
    example,
    category: categoryFor(name).id,
  };
}

function parseTsDoc(raw: string): Pick<NascenteApiItem, "summary" | "remarks" | "example"> {
  if (!raw) return { summary: "", remarks: "", example: "" };

  const cleaned = raw
    .replace(/^\s*\/\*\*\s?/, "")
    .replace(/\s*\*\/\s*$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\* ?/, ""));

  const sections: Record<string, string[]> = { summary: [], remarks: [], example: [] };
  let current: keyof typeof sections = "summary";

  for (const line of cleaned) {
    const tag = line.match(/^@(remarks|example)\b\s*(.*)$/);
    if (tag) {
      current = tag[1] as keyof typeof sections;
      if (tag[2]) sections[current].push(tag[2]);
      continue;
    }
    if (/^@(?:param|returns?|typeParam|throws|packageDocumentation)\b/.test(line)) continue;
    sections[current].push(line);
  }

  return {
    summary: normalizeDocText(sections.summary.join("\n")),
    remarks: normalizeDocText(sections.remarks.join("\n")),
    example: normalizeDocText(sections.example.join("\n")),
  };
}

function normalizeDocText(value: string): string {
  return value.replace(/\n{3,}/g, "\n\n").trim();
}

function extractSignature(text: string): string {
  const brace = text.indexOf("{");
  const arrow = text.indexOf("=>");

  if (text.startsWith("export function") && brace >= 0) return `${text.slice(0, brace).trim()};`;
  if (text.startsWith("export class") && brace >= 0) return text.slice(0, brace).trim();
  if (text.startsWith("export const") && arrow >= 0) return `${text.slice(0, arrow).trim()} => …`;

  return text.replace(/\s+/g, " ").trim();
}

function createNascenteDocsHtml(input: { api: NascenteApiItem[]; readme: string; changelog: string }): string {
  const readme = renderMarkdown(stripTitle(input.readme));
  const changelog = renderMarkdown(stripTitle(input.changelog));
  const categories = CATEGORY_DEFINITIONS
    .map((definition) => ({ ...definition, items: input.api.filter((item) => item.category === definition.id) }))
    .filter((definition) => definition.items.length > 0);

  const sidebarGroups = categories.map((group) => `
    <details class="nav-group" open>
      <summary>${escapeHtml(group.title)} <span>${group.items.length}</span></summary>
      ${group.items.map((item) => `<a href="#api-${slug(item.name)}" data-api-link data-searchable-name="${escapeHtml(item.name.toLowerCase())}">${escapeHtml(item.name)}</a>`).join("")}
    </details>`).join("");

  const apiSections = categories.map((group, groupIndex) => `
    <section class="api-group reveal" id="${escapeHtml(group.id)}" style="--delay:${groupIndex * 35}ms">
      <header class="section-heading">
        <p class="kicker">0${groupIndex + 1} · API CURRENT</p>
        <h2>${escapeHtml(group.title)}</h2>
        <p>${escapeHtml(group.description)}</p>
      </header>
      <div class="api-grid">
        ${group.items.map(createApiCard).join("")}
      </div>
    </section>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <meta name="theme-color" content="#dff7ff" />
  <meta name="description" content="Nascente is a zero-dependency TypeScript utility toolkit for allocation-conscious hot paths, Safari and mobile." />
  <title>Nascente · fast TypeScript utilities</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css" />
  <style>${NASCENTE_CSS}</style>
</head>
<body>
  <div class="water-light" aria-hidden="true"></div>
  <button class="mobile-nav" type="button" data-nav-toggle aria-label="Open documentation navigation" aria-expanded="false">☰</button>
  <div class="nav-scrim" data-nav-close></div>

  <aside class="sidebar" data-sidebar>
    <a class="brand" href="#top"><span class="brand-drop"></span><span>Nascente</span></a>
    <p class="sidebar-copy">Fast utilities, born close to the metal.</p>
    <label class="search"><span>Search API</span><input type="search" data-api-search placeholder="groupBy, cloneDeep…" /></label>
    <nav class="primary-nav">
      <a href="#philosophy">Philosophy</a>
      <a href="#getting-started">Getting started</a>
      <a href="#api">API reference</a>
      <a href="#changelog">Changelog</a>
    </nav>
    <div class="api-nav">${sidebarGroups}</div>
    <p class="generated-note">Generated from <code>README.md</code>, <code>CHANGELOG.md</code> and public TSDoc.</p>
  </aside>

  <main class="page" id="top">
    <section class="hero">
      <div class="hero-copy">
        <p class="kicker">zero dependency · allocation conscious · webkit minded</p>
        <h1>Nas<span>cen</span>te</h1>
        <p class="hero-lede">A flat TypeScript toolkit for the code that runs where performance feels personal: in your hand, on a warm phone, inside Safari.</p>
        <div class="hero-actions">
          <a class="button button-primary" href="#api">Explore the current</a>
          <a class="button" href="#philosophy">Read the philosophy</a>
        </div>
      </div>
      <div class="spring-art" aria-hidden="true">
        <div class="drop-orbit"></div><div class="drop-core"></div><div class="ripple ripple-one"></div><div class="ripple ripple-two"></div><div class="river-line"></div>
      </div>
    </section>

    <section class="manifesto reveal" id="philosophy">
      <p class="kicker">THE SOURCE</p>
      <p class="manifesto-text">Performance without superstition. <em>Fewer temporary objects.</em> Fewer accidental passes. Predictable work when the hot path deserves it.</p>
      <div class="principles">
        <article><strong>01</strong><h3>Less drift</h3><p>Fuse transforms where an intermediate array adds no value.</p></article>
        <article><strong>02</strong><h3>Small wakes</h3><p>Prefer bounded concurrency when a thousand promises would punish mobile memory.</p></article>
        <article><strong>03</strong><h3>Measure the river</h3><p>No function is declared universally faster. The TSDoc explains the trade, and benchmarks verify the workload.</p></article>
      </div>
    </section>

    <section class="markdown-section reveal" id="getting-started">
      <header class="section-heading"><p class="kicker">README · AUTO RENDERED</p><h2>Getting started</h2><p>This section is rendered with the same Markdown pipeline used by the repository documentation.</p></header>
      <div class="markdown-body">${readme.html}</div>
    </section>

    <section id="api" class="api-intro reveal">
      <p class="kicker">THE WATER TABLE</p>
      <h2>${input.api.length} public exports.<br /><em>One flat surface.</em></h2>
      <p>Documentation below is extracted from the TypeScript source at build time. Change the TSDoc, rebuild, and the reference changes with it.</p>
    </section>

    ${apiSections}

    <section class="markdown-section reveal" id="changelog">
      <header class="section-heading"><p class="kicker">CHANGELOG · AUTO RENDERED</p><h2>What changed downstream</h2></header>
      <div class="markdown-body">${changelog.html}</div>
    </section>

    <footer><span class="brand-drop small"></span><p>Nascente. Fast where it matters, honest where it depends.</p></footer>
  </main>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js"></script>
  <script>${NASCENTE_CLIENT}</script>
</body>
</html>`;
}

function createApiCard(item: NascenteApiItem): string {
  const description = item.summary || "Public Nascente API.";
  const remarks = item.remarks ? renderMarkdown(item.remarks).html : "";
  const example = item.example ? renderMarkdown(item.example).html : "";

  return `<article class="api-card searchable-api" id="api-${slug(item.name)}" data-api-name="${escapeHtml(item.name.toLowerCase())}">
    <div class="api-card-head"><div><span class="api-kind">${escapeHtml(item.kind)}</span><h3>${escapeHtml(item.name)}</h3></div><a href="#api-${slug(item.name)}" aria-label="Link to ${escapeHtml(item.name)}">#</a></div>
    <p class="api-summary">${escapeHtml(description)}</p>
    <pre><code class="language-typescript">${escapeHtml(item.signature)}</code></pre>
    ${remarks ? `<details><summary>Performance & replacement notes</summary><div class="api-doc">${remarks}</div></details>` : ""}
    ${example ? `<details><summary>Example</summary><div class="api-doc">${example}</div></details>` : ""}
  </article>`;
}

function category(id: string, title: string, description: string, names: readonly string[]): CategoryDefinition {
  return { id, title, description, names: new Set(names) };
}

function categoryFor(name: string): CategoryDefinition {
  return CATEGORY_DEFINITIONS.find((definition) => definition.names.has(name)) ?? CATEGORY_DEFINITIONS.at(-1)!;
}

function categoryIndex(name: string): number {
  return CATEGORY_DEFINITIONS.findIndex((definition) => definition.names.has(name));
}

/**
 * Checks whether a TypeScript AST node is explicitly exported.
 *
 * @remarks
 * `ts.getModifiers` only accepts nodes that implement TypeScript's internal
 * `HasModifiers` shape. Since this helper intentionally accepts any `ts.Node`,
 * `ts.canHaveModifiers` must narrow the node before accessing its modifiers.
 *
 * This avoids unsafe casts such as `node as ts.HasModifiers` and keeps the
 * helper compatible with TypeScript's strongly typed Compiler API.
 */
function isExported(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) {
    return false;
  }

  const modifiers = ts.getModifiers(node);

  if (!modifiers) {
    return false;
  }

  for (let index = 0; index < modifiers.length; index++) {
    if (modifiers[index]?.kind === ts.SyntaxKind.ExportKeyword) {
      return true;
    }
  }

  return false;
}

function stripTitle(markdown: string): string {
  return markdown.replace(/^#\s+[^\n]+\n+/, "");
}

function slug(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

const NASCENTE_CSS = String.raw`
:root{color-scheme:light;--ink:#082f45;--ink-soft:#315b6e;--muted:#668493;--line:rgba(10,78,105,.14);--water:#eafaff;--spring:#c8f1ff;--blue:#087ca7;--blue-deep:#075d80;--foam:#fbfeff;--sidebar:284px;--serif:"Instrument Serif",Georgia,serif;--sans:"Manrope",system-ui,sans-serif;--mono:"DM Mono",monospace}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:32px}body{margin:0;color:var(--ink);background:linear-gradient(180deg,#f8fdff 0,#eefaff 35%,#f9fdff 100%);font:15px/1.65 var(--sans);-webkit-font-smoothing:antialiased}.water-light{position:fixed;inset:0;pointer-events:none;background:radial-gradient(circle at 78% 3%,rgba(86,210,255,.24),transparent 28rem),radial-gradient(circle at 58% 42%,rgba(255,255,255,.9),transparent 30rem);mix-blend-mode:multiply;opacity:.75}.sidebar{position:fixed;z-index:20;inset:0 auto 0 0;width:var(--sidebar);padding:32px 22px;overflow:auto;border-right:1px solid var(--line);background:rgba(247,253,255,.82);backdrop-filter:blur(24px) saturate(1.2)}.brand{display:flex;align-items:center;gap:10px;color:var(--ink);font:34px/1 var(--serif);text-decoration:none}.brand-drop{width:17px;height:22px;border-radius:55% 45% 58% 42%;transform:rotate(45deg);background:linear-gradient(135deg,#fff 5%,#58c8ed 55%,#087ca7);box-shadow:inset 3px 3px 7px rgba(255,255,255,.7),0 8px 18px rgba(5,115,153,.2)}.brand-drop.small{width:12px;height:15px}.sidebar-copy{margin:12px 0 24px;color:var(--muted);font-size:12px}.search span{display:block;margin:0 0 7px;color:var(--muted);font:10px var(--mono);letter-spacing:.12em;text-transform:uppercase}.search input{width:100%;border:1px solid var(--line);border-radius:12px;padding:11px 12px;outline:0;color:var(--ink);background:rgba(255,255,255,.75);font:13px var(--sans)}.search input:focus{border-color:rgba(8,124,167,.45);box-shadow:0 0 0 4px rgba(8,124,167,.08)}.primary-nav{display:grid;gap:2px;margin:20px 0;padding-bottom:18px;border-bottom:1px solid var(--line)}.primary-nav a,.api-nav a{border-radius:8px;padding:7px 8px;color:var(--ink-soft);text-decoration:none;font-size:12px}.primary-nav a:hover,.api-nav a:hover{color:var(--blue);background:rgba(8,124,167,.06)}.nav-group{margin:9px 0}.nav-group summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;color:var(--ink);font:600 11px var(--sans);letter-spacing:.02em}.nav-group summary span{color:var(--muted);font:10px var(--mono)}.nav-group a{display:block;padding-left:10px}.generated-note{margin:24px 0 0;color:var(--muted);font-size:10px}.generated-note code{font-family:var(--mono)}.page{position:relative;margin-left:var(--sidebar);min-width:0}.hero{min-height:94svh;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(280px,.95fr);align-items:center;gap:6vw;padding:clamp(48px,8vw,110px) clamp(28px,7vw,110px);overflow:hidden}.kicker{margin:0 0 18px;color:var(--blue);font:500 10px var(--mono);letter-spacing:.18em;text-transform:uppercase}.hero h1{margin:0;font:clamp(84px,14vw,190px)/.72 var(--serif);letter-spacing:-.065em;color:var(--ink)}.hero h1 span{color:var(--blue)}.hero-lede{max-width:660px;margin:34px 0 0;color:var(--ink-soft);font:clamp(18px,2.2vw,27px)/1.45 var(--serif)}.hero-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:28px}.button{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:999px;padding:11px 16px;color:var(--ink);background:rgba(255,255,255,.55);text-decoration:none;font-size:12px;font-weight:600}.button-primary{color:white;border-color:transparent;background:var(--blue-deep)}.spring-art{position:relative;aspect-ratio:1;min-height:320px;display:grid;place-items:center}.drop-core{position:absolute;width:120px;height:150px;border-radius:58% 42% 60% 40%;transform:rotate(45deg);background:linear-gradient(135deg,rgba(255,255,255,.96),rgba(137,224,255,.72) 43%,rgba(8,124,167,.9));box-shadow:inset 16px 14px 22px rgba(255,255,255,.72),0 40px 90px rgba(0,107,147,.18)}.drop-orbit{position:absolute;width:210px;height:210px;border:1px solid rgba(8,124,167,.18);border-radius:50%;animation:float 8s ease-in-out infinite}.ripple{position:absolute;width:72%;height:25%;border:1px solid rgba(8,124,167,.2);border-radius:50%;top:68%}.ripple-two{width:94%;height:34%;opacity:.5}.river-line{position:absolute;width:2px;height:43%;top:57%;background:linear-gradient(var(--blue),transparent)}@keyframes float{50%{transform:translateY(-9px) rotate(4deg)}}.manifesto,.markdown-section,.api-intro,.api-group{padding:clamp(54px,8vw,110px) clamp(24px,7vw,100px);border-top:1px solid var(--line)}.manifesto-text{max-width:1050px;margin:0;font:clamp(38px,5vw,72px)/1.03 var(--serif);letter-spacing:-.035em}.manifesto-text em{color:var(--blue);font-weight:400}.principles{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:58px}.principles article{padding:22px 0;border-top:1px solid var(--line)}.principles strong{font:10px var(--mono);color:var(--blue)}.principles h3{margin:12px 0 8px;font:30px var(--serif)}.principles p{margin:0;color:var(--muted)}.section-heading{max-width:850px;margin-bottom:38px}.section-heading h2,.api-intro h2{margin:0;font:clamp(42px,6vw,78px)/.95 var(--serif);letter-spacing:-.035em}.section-heading>p:last-child,.api-intro>p:last-child{max-width:690px;color:var(--muted)}.markdown-section{background:rgba(255,255,255,.3)}.markdown-body{max-width:920px}.markdown-body h2,.markdown-body h3{font-family:var(--serif);font-weight:400}.markdown-body h2{font-size:38px;margin-top:44px}.markdown-body h3{font-size:28px}.markdown-body p,.markdown-body li{color:var(--ink-soft)}.markdown-body pre,.api-card pre{max-width:100%;overflow:auto;border:1px solid rgba(8,124,167,.12);border-radius:14px;padding:16px;background:rgba(255,255,255,.78);box-shadow:0 14px 36px rgba(15,83,107,.05)}.markdown-body code,.api-card code{font-family:var(--mono);font-size:12px}.markdown-body :not(pre)>code{padding:2px 5px;border-radius:5px;background:rgba(8,124,167,.07)}.table-wrap{max-width:100%;overflow:auto}.gfm-table{width:100%;border-collapse:collapse}.gfm-table th,.gfm-table td{padding:10px;border-bottom:1px solid var(--line);text-align:left}.api-intro{padding-bottom:38px}.api-intro h2 em{color:var(--blue);font-weight:400}.api-group{padding-top:52px}.api-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.api-card{min-width:0;padding:22px;border:1px solid var(--line);border-radius:20px;background:rgba(255,255,255,.66);box-shadow:0 18px 55px rgba(13,85,110,.055);scroll-margin-top:28px}.api-card:target{border-color:rgba(8,124,167,.5);box-shadow:0 0 0 4px rgba(8,124,167,.07),0 18px 55px rgba(13,85,110,.07)}.api-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.api-card-head h3{margin:3px 0 0;font:31px var(--serif)}.api-card-head>a{color:var(--muted);text-decoration:none}.api-kind{color:var(--blue);font:9px var(--mono);text-transform:uppercase;letter-spacing:.14em}.api-summary{min-height:48px;color:var(--ink-soft)}.api-card details{border-top:1px solid var(--line);padding-top:10px;margin-top:12px}.api-card summary{cursor:pointer;color:var(--blue-deep);font-size:12px;font-weight:600}.api-doc{color:var(--ink-soft);font-size:13px}.api-doc p:last-child{margin-bottom:0}.api-card[data-hidden="true"],.api-nav a[data-hidden="true"]{display:none}.mobile-nav,.nav-scrim{display:none}footer{display:flex;align-items:center;justify-content:center;gap:10px;padding:54px 24px;color:var(--muted);border-top:1px solid var(--line)}.reveal{animation:rise .55s both;animation-delay:var(--delay,0ms)}@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@media(max-width:980px){:root{--sidebar:min(86vw,320px)}.sidebar{transform:translateX(-102%);transition:transform .25s ease}.page{margin-left:0}.mobile-nav{display:grid;place-items:center;position:fixed;z-index:40;top:max(14px,env(safe-area-inset-top));left:14px;width:42px;height:42px;border:1px solid var(--line);border-radius:50%;background:rgba(248,253,255,.88);backdrop-filter:blur(16px);color:var(--ink)}.nav-scrim{position:fixed;z-index:15;inset:0;background:rgba(3,42,59,.25);backdrop-filter:blur(3px)}html.nav-open .sidebar{transform:none}html.nav-open .nav-scrim{display:block}.hero{grid-template-columns:1fr;padding-top:110px}.spring-art{min-height:260px;max-width:480px;width:100%;margin:auto}.principles{grid-template-columns:1fr}.api-grid{grid-template-columns:1fr}}@media(max-width:560px){.hero{min-height:100svh;padding-inline:20px}.hero h1{font-size:clamp(76px,25vw,126px)}.hero-lede{font-size:21px}.spring-art{min-height:220px}.drop-core{width:92px;height:116px}.manifesto,.markdown-section,.api-intro,.api-group{padding-inline:18px}.manifesto-text{font-size:44px}.section-heading h2,.api-intro h2{font-size:48px}.api-card{padding:17px;border-radius:16px}.api-summary{min-height:0}.button{flex:1}.markdown-body pre,.api-card pre{margin-inline:-4px;border-radius:12px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.drop-orbit,.reveal{animation:none}.sidebar{transition:none}}
`;

const NASCENTE_CLIENT = String.raw`
(() => {
  if (window.hljs) window.hljs.highlightAll();
  const root = document.documentElement;
  const toggle = document.querySelector('[data-nav-toggle]');
  const close = document.querySelector('[data-nav-close]');
  const sidebar = document.querySelector('[data-sidebar]');
  const search = document.querySelector('[data-api-search]');
  const setOpen = (open) => { root.classList.toggle('nav-open', open); toggle?.setAttribute('aria-expanded', String(open)); };
  toggle?.addEventListener('click', () => setOpen(!root.classList.contains('nav-open')));
  close?.addEventListener('click', () => setOpen(false));
  sidebar?.addEventListener('click', (event) => { if (event.target.closest('a') && matchMedia('(max-width:980px)').matches) setOpen(false); });
  addEventListener('keydown', (event) => { if (event.key === 'Escape') setOpen(false); });
  search?.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    document.querySelectorAll('[data-api-name]').forEach((node) => { node.dataset.hidden = String(Boolean(query) && !node.dataset.apiName.includes(query)); });
    document.querySelectorAll('[data-searchable-name]').forEach((node) => { node.dataset.hidden = String(Boolean(query) && !node.dataset.searchableName.includes(query)); });
  });
})();
`;
