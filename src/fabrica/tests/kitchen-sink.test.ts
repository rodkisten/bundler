/**
 * @vitest-environment jsdom
 *
 * Fábrica Kitchen Sink Test Suite
 *
 * This file intentionally exercises the public Fábrica surface plus the Broto
 * reactive primitives that power it. It is large on purpose: keep it as a living
 * contract test when refactoring the renderer, directives, component ownership,
 * DOM bags, raw HTML paths, element factories, globals, and scheduler behavior.
 *
 * Notes:
 * - The benchmark blocks are smoke/diagnostic benchmarks, not hard performance
 *   gates. They compare Fábrica helpers with equivalent vanilla operations and
 *   assert only that both paths produce the same observable result.
 * - Run with: `pnpm vitest run tests/fabrica.kitchen-sink.test.ts`
 * - Requires Vitest's jsdom environment. Add `jsdom` as a dev dependency if your
 *   workspace does not already provide it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  $,
  boundary,
  classMap,
  clearComponents,
  component,
  createFabricaApi,
  css,
  debug,
  defineElement,
  elements,
  html,
  jsx,
  listComponents,
  mount,
  rawHtml,
  ref,
  render,
  repeat,
  resolveComponent,
  sanitizedHtml,
  setDebug,
  styleMap,
  trustedHtml,
  unsafeHtml,
  unregisterComponent,
  virtualRepeat,
  when,
} from "../fabrica";
import {
  batch,
  cleanupOwner,
  computed,
  configureScheduler,
  createContext,
  createOwner,
  createRoot,
  debug as brotoDebug,
  disposeOwner,
  effect,
  flushSync,
  getOwner,
  graph,
  hasReactiveValue,
  inspectOwnerGraph,
  memo,
  onCleanup,
  onOwnerCleanup,
  onOwnerError,
  provide,
  readReactiveValue,
  resource,
  runWithOwner,
  scheduleTask,
  setDebug as setBrotoDebug,
  signal,
  store,
  untrack,
  useContext,
} from "../../broto";
import type { Cleanup, RenderValue } from "../src/fabrica";

type BenchResult = {
  label: string;
  iterations: number;
  fabricaMs: number;
  vanillaMs: number;
  ratio: number;
};

const BENCH_ITERATIONS = 600;
const BIG_LIST_SIZE = 120;

let host: HTMLDivElement;
let benchResults: BenchResult[];

beforeEach(() => {
  document.body.innerHTML = "";
  host = document.createElement("div");
  host.id = "test-host";
  document.body.appendChild(host);
  benchResults = [];
  clearComponents();
  configureScheduler({ mode: "sync", maxFlushIterations: 2_000 });
});

afterEach(() => {
  clearComponents();
  host.replaceChildren();
  document.body.innerHTML = "";
  configureScheduler({ mode: "microtask", maxFlushIterations: 1_000 });
  vi.restoreAllMocks();
});

function textOf(node: ParentNode = host): string {
  return (node.textContent || "").replace(/\s+/g, " ").trim();
}

function normalizeHtml(value: ParentNode = host): string {
  return (value instanceof DocumentFragment ? Array.from(value.childNodes).map((node) => node.textContent).join("") : value.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
}

function tick(): Promise<void> {
  return Promise.resolve().then(() => Promise.resolve());
}

function time(label: string, iterations: number, callback: () => void): number {
  const start = performance.now();
  for (let index = 0; index < iterations; index += 1) callback();
  const ms = performance.now() - start;
  expect(Number.isFinite(ms)).toBe(true);
  expect(ms).toBeGreaterThanOrEqual(0);
  return ms;
}

function bench(label: string, iterations: number, fabricaWork: () => void, vanillaWork: () => void): BenchResult {
  fabricaWork();
  vanillaWork();
  const fabricaMs = time(`${label}:fabrica`, iterations, fabricaWork);
  const vanillaMs = time(`${label}:vanilla`, iterations, vanillaWork);
  const result = {
    label,
    iterations,
    fabricaMs,
    vanillaMs,
    ratio: vanillaMs === 0 ? Number.POSITIVE_INFINITY : fabricaMs / vanillaMs,
  };
  benchResults.push(result);
  return result;
}

function expectBenchResult(result: BenchResult): void {
  expect(result.iterations).toBeGreaterThan(0);
  expect(result.fabricaMs).toBeGreaterThanOrEqual(0);
  expect(result.vanillaMs).toBeGreaterThanOrEqual(0);
  expect(Number.isFinite(result.ratio) || result.ratio === Number.POSITIVE_INFINITY).toBe(true);
}

describe("Fábrica kitchen sink: html/render/mount", () => {
  it("renders primitive values, arrays, nodes, fragments and falsy ignored values", () => {
    const strong = document.createElement("strong");
    strong.textContent = "node";

    const fragment = document.createDocumentFragment();
    fragment.append(document.createTextNode("fragment"));

    render(
      host,
      html`
        <section data-testid="mixed">
          ${"text"}
          ${123}
          ${0n}
          ${false}
          ${true}
          ${null}
          ${undefined}
          ${["array", strong, fragment]}
        </section>
      `,
    );

    expect(host.querySelector("section")?.getAttribute("data-testid")).toBe("mixed");
    expect(textOf()).toBe("text 123 0 array node fragment");
  });

  it("reconciles a container across repeated render() calls and disposes the previous range", () => {
    const disposeA = render(host, html`<p id="first">First</p>`);
    expect(host.querySelector("#first")?.textContent).toBe("First");

    const disposeB = render(host, html`<p id="second">Second</p>`);
    expect(disposeB).toBe(disposeA);
    expect(host.querySelector("#first")).toBeNull();
    expect(host.querySelector("#second")?.textContent).toBe("Second");

    disposeB();
    expect(host.textContent).toBe("");
  });

  it("mounts append-only content and removes exactly its own range", () => {
    host.append("before");
    const dispose = mount(host, html`<span>mounted</span>`);
    host.append("after");

    expect(textOf()).toBe("beforemountedafter");
    dispose();
    expect(textOf()).toBe("beforeafter");
  });

  it("supports reactive child expressions and signal values inside templates", async () => {
    const count = signal(1);
    const label = computed(() => `Count: ${count()}`);

    render(host, html`<button>${label}</button><output>${() => count() * 2}</output>`);
    expect(textOf()).toBe("Count: 1 2");

    count.set(5);
    flushSync();
    await tick();

    expect(textOf()).toBe("Count: 5 10");
  });

  it("supports reactive attribute, property and boolean updates", () => {
    const title = signal("Initial");
    const disabled = signal(false);
    const value = signal("a");

    render(host, html`<input title=${title} disabled=${disabled} value=${value} />`);
    const input = host.querySelector("input") as HTMLInputElement;

    expect(input.title).toBe("Initial");
    expect(input.disabled).toBe(false);
    expect(input.value).toBe("a");

    title.set("Next");
    disabled.set(true);
    value.set("b");
    flushSync();

    expect(input.title).toBe("Next");
    expect(input.disabled).toBe(true);
    expect(input.value).toBe("b");
  });

  it("binds event attributes including prevent and stop modifiers", () => {
    const outer = vi.fn();
    const inner = vi.fn((event: MouseEvent) => {
      expect(event.defaultPrevented).toBe(true);
    });

    render(host, html`<div @click=${outer}><button @click.prevent.stop=${inner}>Hit</button></div>`);
    const button = host.querySelector("button") as HTMLButtonElement;
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });

    button.dispatchEvent(event);

    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it("supports delegated event syntax", () => {
    const handler = vi.fn();
    render(host, html`<ul @click.delegate=${handler}><li><button>Delegated</button></li></ul>`);

    host.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("Fábrica kitchen sink: raw HTML and sanitizer", () => {
  it("renders trusted raw HTML helpers", () => {
    render(host, html`<article>${rawHtml("<strong>raw</strong>")}${trustedHtml("<em>trusted</em>")}${unsafeHtml("<span>unsafe</span>")}</article>`);

    expect(host.querySelector("strong")?.textContent).toBe("raw");
    expect(host.querySelector("em")?.textContent).toBe("trusted");
    expect(host.querySelector("span")?.textContent).toBe("unsafe");
  });

  it("sanitizes script nodes, inline handlers, srcdoc and javascript URLs", () => {
    render(
      host,
      html`${sanitizedHtml(`
        <div onclick="evil()">
          <script>evil()</script>
          <a href="javascript:evil()">link</a>
          <iframe srcdoc="<script>evil()</script>"></iframe>
          <img src="x" onerror="evil()" />
        </div>
      `)}`,
    );

    expect(host.querySelector("script")).toBeNull();
    expect(host.querySelector("iframe")).toBeNull();
    expect(host.querySelector("div")?.getAttribute("onclick")).toBeNull();
    expect(host.querySelector("a")?.getAttribute("href")).toBeNull();
    expect(host.querySelector("img")?.getAttribute("onerror")).toBeNull();
  });

  it("exposes raw helpers through html.* aliases", () => {
    expect(html.raw("<b>x</b>")).toEqual(rawHtml("<b>x</b>"));
    expect(html.trusted("<b>x</b>")).toEqual(trustedHtml("<b>x</b>"));
    expect(html.unsafe("<b>x</b>")).toEqual(unsafeHtml("<b>x</b>"));
    expect(html.sanitized("<script>x</script>").value).not.toContain("script");
  });
});

describe("Fábrica kitchen sink: directives", () => {
  it("renders when() truthy and falsy branches reactively", () => {
    const open = signal(true);
    render(host, html`${when(open, () => html`<p>Open</p>`, () => html`<p>Closed</p>`)}`);

    expect(textOf()).toBe("Open");
    open.set(false);
    flushSync();
    expect(textOf()).toBe("Closed");
    open.set(true);
    flushSync();
    expect(textOf()).toBe("Open");
  });

  it("renders keyed repeat(), updates item/index/key signals, reorders and supports empty state", () => {
    const items = signal([
      { id: "a", name: "Alpha" },
      { id: "b", name: "Beta" },
      { id: "c", name: "Gamma" },
    ]);

    render(
      host,
      html`<ol>
        ${repeat(
          items,
          (item) => item.id,
          ({ item, index, key }) => html`<li data-key=${key}>${() => `${index()}:${item().name}`}</li>`,
          { empty: () => html`<li class="empty">Empty</li>` },
        )}
      </ol>`,
    );

    expect(Array.from(host.querySelectorAll("li")).map((li) => li.textContent)).toEqual(["0:Alpha", "1:Beta", "2:Gamma"]);

    items.set([
      { id: "c", name: "Gamma!" },
      { id: "a", name: "Alpha!" },
    ]);
    flushSync();

    expect(Array.from(host.querySelectorAll("li")).map((li) => `${li.getAttribute("data-key")}:${li.textContent}`)).toEqual([
      "c:0:Gamma!",
      "a:1:Alpha!",
    ]);

    items.set([]);
    flushSync();
    expect(host.querySelector(".empty")?.textContent).toBe("Empty");
  });

  it("renders virtualRepeat() with a bounded DOM window", () => {
    const rows = signal(Array.from({ length: 1_000 }, (_item, index) => ({ id: index, label: `Row ${index}` })));

    render(
      host,
      html`${virtualRepeat(rows, (row) => row.id, ({ item }) => html`<div class="row">${() => item().label}</div>`, {
        itemHeight: 20,
        overscan: 2,
        height: 100,
      })}`,
    );

    const mountedRows = host.querySelectorAll(".row");
    expect(mountedRows.length).toBeGreaterThan(0);
    expect(mountedRows.length).toBeLessThan(30);
    expect(textOf()).toContain("Row 0");
  });

  it("applies ref() callbacks and cleanup on dispose", () => {
    const cleanup = vi.fn();
    const callback = vi.fn(() => cleanup);
    const dispose = render(host, html`<button ref=${ref(callback)}>Ref</button>`);

    const button = host.querySelector("button") as HTMLButtonElement;
    expect(callback).toHaveBeenCalledWith(button);

    dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("diffs classMap() and styleMap() values", () => {
    const classes = signal({ active: true, hidden: false, stale: true });
    const styles = signal({ color: "red", backgroundColor: "black", "--tone": "warm" });

    render(host, html`<div class=${() => classMap(classes())} style=${() => styleMap(styles())}>Styled</div>`);
    const div = host.querySelector("div") as HTMLDivElement;

    expect(div.classList.contains("active")).toBe(true);
    expect(div.classList.contains("hidden")).toBe(false);
    expect(div.style.color).toBe("red");
    expect(div.style.backgroundColor).toBe("black");
    expect(div.style.getPropertyValue("--tone")).toBe("warm");

    classes.set({ active: false, hidden: true, fresh: true });
    styles.set({ color: "blue", opacity: "0.5" });
    flushSync();

    expect(div.className.split(/\s+/).sort()).toEqual(["fresh", "hidden"]);
    expect(div.style.color).toBe("blue");
    expect(div.style.opacity).toBe("0.5");
    expect(div.style.backgroundColor).toBe("");
    expect(div.style.getPropertyValue("--tone")).toBe("");
  });
});

describe("Fábrica kitchen sink: components, context and boundaries", () => {
  it("creates direct components with children, component context and lifecycle", async () => {
    const mounted = vi.fn();
    const unmounted = vi.fn();

    const Card = component<{ title: string }>("Card", (props, ctx) => {
      const local = ctx.signal(1);
      const doubled = ctx.computed(() => local() * 2);
      ctx.onMount(() => {
        mounted();
        local.set(2);
        return unmounted;
      });

      return html`<article data-id=${ctx.id}><h2>${props.title}</h2><p>${doubled}</p><slot>${props.children}</slot></article>`;
    });

    const dispose = render(host, html`${Card({ title: "Hello", children: html`<strong>Child</strong>` })}`);

    expect(host.querySelector("article")?.getAttribute("data-id")).toMatch(/^fabrica-/);
    expect(host.querySelector("h2")?.textContent).toBe("Hello");
    expect(host.querySelector("strong")?.textContent).toBe("Child");

    await tick();
    flushSync();
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(host.querySelector("p")?.textContent).toBe("4");

    dispose();
    expect(unmounted).toHaveBeenCalledTimes(1);
  });

  it("registers, resolves, lists, unregisters and clears named components", () => {
    const Badge = component("Badge", () => html`<span>Badge</span>`);

    expect(resolveComponent("Badge")).toBe(Badge);
    expect(listComponents().has("Badge")).toBe(true);
    expect(unregisterComponent("Badge")).toBe(true);
    expect(resolveComponent("Badge")).toBeUndefined();

    component("Again", () => "Again");
    expect(listComponents().size).toBe(1);
    clearComponents();
    expect(listComponents().size).toBe(0);
  });

  it("renders registered components through micro JSX", () => {
    component<{ label: string }>("MicroPanel", (props) => html`<section class="micro">${props.label}${props.children}</section>`);

    render(host, jsx.html`<MicroPanel label="Works"><strong>!</strong></MicroPanel>`);

    expect(host.querySelector(".micro")?.textContent).toBe("Works!");
  });

  it("ignores uppercase component-looking tags inside HTML comments", () => {
    const spy = vi.fn();
    component("CommentedThing", () => {
      spy();
      return html`<div>Mounted</div>`;
    });

    render(host, jsx.html`<!-- <CommentedThing /> --><p>Real</p>`);

    expect(spy).not.toHaveBeenCalled();
    expect(textOf()).toBe("Real");
  });

  it("provides and consumes context inside component ownership", () => {
    const ThemeContext = createContext("light", "ThemeContext");

    const Child = component("Child", (_props, ctx) => html`<span>${ctx.useContext(ThemeContext)}</span>`);
    const Parent = component("Parent", (_props, ctx) => {
      ctx.provide(ThemeContext, "dark");
      return html`${Child()}`;
    });

    render(host, html`${Parent()}`);
    expect(textOf()).toBe("dark");
  });

  it("catches render errors with boundary() and supports retry", () => {
    const shouldThrow = signal(true);
    const errors: unknown[] = [];

    render(
      host,
      html`${boundary({
        children: () => {
          if (shouldThrow()) throw new Error("boom");
          return html`<p>Recovered</p>`;
        },
        fallback: (error, retry) => html`<button @click=${retry}>${(error as Error).message}</button>`,
        onError: (error) => errors.push(error),
      })}`,
    );

    expect(host.querySelector("button")?.textContent).toBe("boom");
    expect(errors).toHaveLength(1);

    shouldThrow.set(false);
    host.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    flushSync();

    expect(textOf()).toBe("Recovered");
  });

  it("creates defineElement() components with merged default props", () => {
    const Pill = defineElement("span", { class: "pill", dataset: { role: "status" } });

    render(host, html`${Pill({ class: ["pill", "hot"], children: "Ready" })}`);
    const span = host.querySelector("span") as HTMLSpanElement;

    expect(span.textContent).toBe("Ready");
    expect(span.className).toContain("hot");
    expect(span.dataset.role).toBe("status");
  });
});

describe("Fábrica kitchen sink: element factories and DOM bag", () => {
  it("creates DOM payloads through elements.* factories", () => {
    render(
      host,
      html`${elements.button({
        class: ["btn", "primary"],
        dataset: { action: "save" },
        attrs: { type: "button", "aria-label": "Save" },
        style: { backgroundColor: "black", color: "white" },
        children: ["Save", document.createElement("span")],
      })}`,
    );

    const button = host.querySelector("button") as HTMLButtonElement;
    expect(button.className).toBe("btn primary");
    expect(button.dataset.action).toBe("save");
    expect(button.type).toBe("button");
    expect(button.getAttribute("aria-label")).toBe("Save");
    expect(button.style.backgroundColor).toBe("black");
  });

  it("supports elements(tag).attrs(defaults) fluent factories", () => {
    const DangerButton = elements("button").attrs({ class: "danger", type: "button" });

    render(host, html`${DangerButton({ children: "Delete", dataset: { id: "42" } })}`);
    const button = host.querySelector("button") as HTMLButtonElement;

    expect(button.className).toBe("danger");
    expect(button.type).toBe("button");
    expect(button.dataset.id).toBe("42");
    expect(button.textContent).toBe("Delete");
  });

  it("creates, queries, applies props and appends with $()", () => {
    const bag = $.create("section#panel.card.primary")({
      dataset: { kind: "shell" },
      attrs: { "aria-live": "polite" },
      text: "Panel",
    }).appendTo(host);

    expect(bag.el).toBeInstanceOf(Element);
    expect(bag.count).toBe(1);
    expect(host.querySelector("#panel")?.textContent).toBe("Panel");
    expect(host.querySelector("#panel")?.className).toBe("card primary");

    const found = $("#panel", host)({ text: "Updated" });
    expect(found.length).toBe(1);
    expect(host.querySelector("#panel")?.textContent).toBe("Updated");
  });

  it("supports $.find() without creating misses", () => {
    expect($.find(".missing", host).count).toBe(0);
    expect(host.children).toHaveLength(0);
  });

  it("turns safe selector misses into elements when createWhenSelectorMisses is enabled", () => {
    const bag = $("article#created.from-selector", host);
    expect(bag.count).toBe(1);
    expect(bag.el?.tagName).toBe("ARTICLE");
    expect(bag.el?.id).toBe("created");
    expect(bag.el?.classList.contains("from-selector")).toBe(true);
  });

  it("supports <tag.class> creation syntax", () => {
    const bag = $("<button#ok.primary>");
    bag({ text: "OK" }).appendTo(host);

    expect(host.querySelector("button#ok.primary")?.textContent).toBe("OK");
  });

  it("renders through bag.html and disposes previous bag renders", () => {
    const bag = $.create("main.app").appendTo(host);

    bag.html`<h1>One</h1>`;
    expect(host.querySelector("h1")?.textContent).toBe("One");

    bag.html`<h2>Two</h2>`;
    expect(host.querySelector("h1")).toBeNull();
    expect(host.querySelector("h2")?.textContent).toBe("Two");

    bag.dispose();
    expect(host.querySelector("h2")).toBeNull();
  });

  it("mounts through bag.mount without clearing existing children", () => {
    const bag = $.create("div.box").appendTo(host);
    bag.el?.append("before");

    const dispose = bag.mount(html`<span>after</span>`);
    expect(textOf(bag.el as Element)).toBe("beforeafter");

    dispose();
    expect(textOf(bag.el as Element)).toBe("before");
  });

  it("supports shadow DOM rendering through bag.shadow", () => {
    const bag = $.create("div.shadow-host").appendTo(host);
    bag.shadow.html`<style>:host{display:block}</style><p>Shadow content</p>`;

    expect(bag.el?.shadowRoot).toBeTruthy();
    expect(bag.el?.shadowRoot?.querySelector("p")?.textContent).toBe("Shadow content");
    expect(host.querySelector("p")).toBeNull();
  });

  it("supports important CSS mode through bag.important.css", () => {
    const bag = $.create("div.important").appendTo(host);
    bag.important.css`color: red; background: black !important;`;

    const element = bag.el as HTMLElement;
    expect(element.style.getPropertyPriority("color")).toBe("important");
    expect(element.style.getPropertyPriority("background")).toBe("important");
  });

  it("removes bag elements and runs cleanup", () => {
    const cleanup = vi.fn();
    const bag = $.create("button.to-remove").appendTo(host);
    render(bag.el as HTMLElement, html`<span ref=${ref(() => cleanup)}>Child</span>`);

    expect(host.querySelector(".to-remove")).toBeTruthy();
    bag.remove();

    expect(host.querySelector(".to-remove")).toBeNull();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

describe("Fábrica kitchen sink: css helper", () => {
  it("returns string CSS unchanged", () => {
    expect(css("color: red;")).toBe("color: red;");
  });

  it("builds template CSS with reactive values", () => {
    const color = signal("rebeccapurple");
    expect(css`color: ${color}; opacity: ${0.8};`).toContain("rebeccapurple");
    expect(css`color: ${() => color()};`).toContain("rebeccapurple");
  });

  it("builds object CSS using kebab-case conversion and skips nullish values", () => {
    expect(css({ backgroundColor: "black", color: "white", marginTop: 0, empty: null })).toBe(
      "background-color: black;color: white;margin-top: 0;",
    );
  });

  it("parses complex inline declaration values and applies them to elements", () => {
    const bag = $.create("div.gradient").appendTo(host);
    bag.css`background: linear-gradient(90deg, red, blue); content: "a;b:c"; color: white;`;

    const element = bag.el as HTMLElement;
    expect(element.style.background).toContain("linear-gradient");
    expect(element.style.color).toBe("white");
  });

  it("writes raw CSS text to style tags", () => {
    const style = document.createElement("style");
    host.append(style);
    $(style).css`.x { color: red; }`;

    expect(style.textContent).toContain(".x");
    expect(style.textContent).toContain("color: red");
  });
});

describe("Broto kitchen sink: signals, effects, scheduler and stores", () => {
  it("creates writable signals with set/update/peek/subscribe", () => {
    const count = signal(1);
    const subscriber = vi.fn();
    const unsubscribe = count.subscribe(subscriber as never);

    expect(count()).toBe(1);
    expect(count.peek()).toBe(1);

    count.set(2);
    flushSync();
    expect(count()).toBe(2);
    expect(subscriber).toHaveBeenCalled();

    count.update((value) => value + 1);
    expect(count.peek()).toBe(3);

    unsubscribe();
    count.set(4);
    flushSync();
    expect(count()).toBe(4);
  });

  it("supports custom equality and equals:false", () => {
    const structural = signal({ id: 1 }, { equals: (a, b) => a.id === b.id });
    const always = signal({ id: 1 }, { equals: false });
    const structuralSpy = vi.fn(() => structural().id);
    const alwaysSpy = vi.fn(() => always().id);

    effect(structuralSpy);
    effect(alwaysSpy);
    structural.set({ id: 1 });
    always.set({ id: 1 });
    flushSync();

    expect(structuralSpy).toHaveBeenCalledTimes(1);
    expect(alwaysSpy).toHaveBeenCalledTimes(2);
  });

  it("runs computed and memo derivations", () => {
    const count = signal(2);
    const doubled = computed(() => count() * 2);
    const label = memo(() => `x${doubled()}`);

    expect(doubled()).toBe(4);
    expect(label()).toBe("x4");

    count.set(5);
    flushSync();

    expect(doubled()).toBe(10);
    expect(label()).toBe("x10");
  });

  it("runs cleanup before effect reruns and on disposal", () => {
    const source = signal(1);
    const cleanup = vi.fn();
    const runs: number[] = [];

    const stop = effect((onCleanup) => {
      runs.push(source());
      onCleanup(cleanup);
    });

    source.set(2);
    flushSync();
    expect(runs).toEqual([1, 2]);
    expect(cleanup).toHaveBeenCalledTimes(1);

    stop();
    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it("supports standalone onCleanup() inside effects", () => {
    const source = signal("a");
    const cleanup = vi.fn();

    const stop = effect(() => {
      source();
      onCleanup(cleanup);
    });

    source.set("b");
    flushSync();
    stop();

    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it("batches writes into a single rerun", () => {
    const first = signal("Rod");
    const last = signal("Kisten");
    const full = computed(() => `${first()} ${last()}`);
    const spy = vi.fn(() => full());

    effect(spy);
    batch(() => {
      first.set("Rodolfo");
      last.set("Clemente");
    });
    flushSync();

    expect(spy).toHaveBeenCalledTimes(2);
    expect(full()).toBe("Rodolfo Clemente");
  });

  it("untrack() reads signals without subscribing", () => {
    const tracked = signal(1);
    const untracked = signal(10);
    const spy = vi.fn(() => tracked() + untrack(() => untracked()));

    effect(spy);
    untracked.set(20);
    flushSync();
    expect(spy).toHaveBeenCalledTimes(1);

    tracked.set(2);
    flushSync();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("schedules tasks by priority and allows cancellation", () => {
    const calls: string[] = [];
    scheduleTask(() => calls.push("background"), "background");
    const cancel = scheduleTask(() => calls.push("cancelled"), "normal");
    scheduleTask(() => calls.push("blocking"), "user-blocking");
    cancel();
    flushSync();

    expect(calls).toEqual(["blocking", "background"]);
  });

  it("reads reactive values and detects reactive inputs", () => {
    const value = signal("x");
    expect(hasReactiveValue(value)).toBe(true);
    expect(hasReactiveValue(() => "y")).toBe(true);
    expect(hasReactiveValue("z")).toBe(false);
    expect(readReactiveValue(value)).toBe("x");
    expect(readReactiveValue(() => "y")).toBe("y");
    expect(readReactiveValue("z")).toBe("z");
  });

  it("creates stores with signal fields, patch and snapshot", () => {
    const state = store({ name: "Rod", count: 1, active: true });

    expect(state.snapshot()).toEqual({ name: "Rod", count: 1, active: true });
    state.name.set("Rodolfo");
    state.patch({ count: 2, active: false });

    expect(state.name()).toBe("Rodolfo");
    expect(state.snapshot()).toEqual({ name: "Rodolfo", count: 2, active: false });
  });
});

describe("Broto kitchen sink: owners, context, errors, graph and resources", () => {
  it("creates owner roots and disposes owner cleanups", () => {
    const cleanup = vi.fn();
    const [value, dispose] = createRoot((disposeRoot, owner) => {
      expect(getOwner()).toBe(owner);
      onOwnerCleanup(cleanup);
      return { disposeRoot, ownerName: owner.name };
    }, { name: "root-test" });

    expect(value.ownerName).toBe("root-test");
    dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("supports manual owners and runWithOwner()", () => {
    const owner = createOwner({ name: "manual" });
    const cleanup = vi.fn();

    runWithOwner(owner, () => {
      expect(getOwner()).toBe(owner);
      onOwnerCleanup(cleanup);
    });

    cleanupOwner(owner);
    expect(cleanup).toHaveBeenCalledTimes(1);
    disposeOwner(owner);
    expect(owner.disposed).toBe(true);
  });

  it("propagates context through owner hierarchy", () => {
    const Token = createContext("fallback", "KitchenContext");

    const [value, dispose] = createRoot(() => {
      provide(Token, "provided");
      return runWithOwner(createOwner({ parent: getOwner(), name: "child" }), () => useContext(Token));
    });

    expect(value).toBe("provided");
    dispose();
  });

  it("handles owner errors with local handlers", () => {
    const error = new Error("owned error");
    const handler = vi.fn(() => true);

    const [, dispose] = createRoot(() => {
      onOwnerError(handler);
      effect(() => {
        throw error;
      }, { sync: true });
      return null;
    });

    expect(handler).toHaveBeenCalledWith(error, expect.objectContaining({ name: "effect" }));
    dispose();
  });

  it("can inspect owner graph without throwing", () => {
    const [, dispose] = createRoot(() => {
      createOwner({ parent: getOwner(), name: "child-a" });
      createOwner({ parent: getOwner(), name: "child-b" });
      const snapshot = inspectOwnerGraph(getOwner());
      expect(snapshot).toBeTruthy();
      return snapshot;
    }, { name: "graph-root" });

    dispose();
  });

  it("creates an imperative graph helper", () => {
    const edges = graph();
    edges.add("a", "b", "depends-on").add("b", "c");

    expect(edges.toJSON()).toEqual([
      { from: "a", to: "b", label: "depends-on" },
      { from: "b", to: "c" },
    ]);

    edges.clear();
    expect(edges.toJSON()).toEqual([]);
  });

  it("loads resources immediately and exposes state transitions", async () => {
    const loader = vi.fn(async () => "loaded");
    const profile = resource(loader);

    expect(profile().loading).toBe(true);
    await profile.reload();
    flushSync();

    expect(loader).toHaveBeenCalled();
    expect(profile().value).toBe("loaded");
    expect(profile().loading).toBe(false);
  });

  it("supports resource source signals, cache keys, stale state and abort", async () => {
    const id = signal("a");
    const loader = vi.fn(async (_abort: AbortSignal, source: string) => `user:${source}`);

    const [profile, dispose] = createRoot(() => resource(loader, { source: id, cacheKey: (source) => `profile:${source}` }));

    await profile.reload();
    expect(profile().value).toBe("user:a");

    id.set("b");
    flushSync();
    expect(profile().loading || profile().value === "user:b").toBe(true);
    await tick();
    await profile.reload();
    expect(profile().value).toBe("user:b");

    profile.abort("manual");
    dispose();
  });

  it("captures resource errors after retries", async () => {
    const error = new Error("network goblin");
    const loader = vi.fn(async () => {
      throw error;
    });

    const [profile, dispose] = createRoot(() => resource<string, Error>(loader, { immediate: false, retries: 1 }));
    await profile.reload();

    expect(loader).toHaveBeenCalledTimes(2);
    expect(profile().error).toBe(error);
    expect(profile().loading).toBe(false);
    dispose();
  });
});

describe("Fábrica kitchen sink: public API, globals and debug", () => {
  it("creates a frozen API object with the expected public keys", () => {
    const api = createFabricaApi();

    expect(Object.isFrozen(api)).toBe(true);
    expect(api.html).toBeTypeOf("function");
    expect(api.render).toBe(render);
    expect(api.mount).toBe(mount);
    expect(api.$).toBe($);
    expect(api.css).toBe(css);
    expect(api.elements).toBe(elements);
    expect(api.html.raw("<b>x</b>")).toEqual(rawHtml("<b>x</b>"));
  });

  it("installs globals and supports noConflict()", () => {
    const previousFabrica = globalThis.Fabrica;
    const previousDollar = globalThis.$;
    const previousDollarEl = globalThis.$el;
    const api = createFabricaApi();

    api.install({ exposeDollar: true, exposeDollarEl: true });

    expect(globalThis.Fabrica).toBe(api);
    expect(globalThis.$).toBe($);
    expect(globalThis.$el).toBe($);

    api.noConflict();

    expect(globalThis.Fabrica).toBe(previousFabrica);
    expect(globalThis.$).toBe(previousDollar);
    expect(globalThis.$el).toBe(previousDollarEl);
  });

  it("toggles Fábrica and Broto debug snapshots", () => {
    setDebug(true);
    setBrotoDebug(true);

    expect(debug().enabled).toBe(true);
    expect(brotoDebug().enabled).toBe(true);

    setDebug(false);
    setBrotoDebug(false);

    expect(debug().enabled).toBe(false);
    expect(brotoDebug().enabled).toBe(false);
  });
});

describe("Fábrica kitchen sink: DOM benchmarks against vanilla", () => {
  it("benchmarks html/render() against innerHTML for equivalent static markup", () => {
    const fabricaContainer = document.createElement("div");
    const vanillaContainer = document.createElement("div");

    const result = bench(
      "static render vs innerHTML",
      BENCH_ITERATIONS,
      () => {
        render(fabricaContainer, html`<section class="card"><h2>Hello</h2><p>World</p></section>`);
        expect(fabricaContainer.querySelector("h2")?.textContent).toBe("Hello");
      },
      () => {
        vanillaContainer.innerHTML = `<section class="card"><h2>Hello</h2><p>World</p></section>`;
        expect(vanillaContainer.querySelector("h2")?.textContent).toBe("Hello");
      },
    );

    expectBenchResult(result);
  });

  it("benchmarks reactive text updates against vanilla textContent updates", () => {
    const fabricaContainer = document.createElement("div");
    const vanillaContainer = document.createElement("div");
    const count = signal(0);

    render(fabricaContainer, html`<span>${count}</span>`);
    vanillaContainer.innerHTML = `<span>0</span>`;
    const vanillaSpan = vanillaContainer.querySelector("span") as HTMLSpanElement;

    const result = bench(
      "signal text update vs textContent",
      BENCH_ITERATIONS,
      () => {
        count.update((value) => value + 1);
        flushSync();
        expect(fabricaContainer.querySelector("span")?.textContent).toBe(String(count.peek()));
      },
      () => {
        vanillaSpan.textContent = String(Number(vanillaSpan.textContent || "0") + 1);
        expect(vanillaSpan.textContent).not.toBe("");
      },
    );

    expectBenchResult(result);
  });

  it("benchmarks classMap/styleMap diffing against className/style setters", () => {
    const fabricaContainer = document.createElement("div");
    const vanillaElement = document.createElement("div");
    const active = signal(true);

    render(
      fabricaContainer,
      html`<div class=${() => classMap({ active: active(), inactive: !active(), shared: true })} style=${() => styleMap({ opacity: active() ? "1" : "0.5", transform: `translateX(${active() ? 1 : 0}px)` })}></div>`,
    );

    const result = bench(
      "class/style maps vs vanilla setters",
      BENCH_ITERATIONS,
      () => {
        active.update((value) => !value);
        flushSync();
        const element = fabricaContainer.querySelector("div") as HTMLDivElement;
        expect(element.classList.contains("shared")).toBe(true);
      },
      () => {
        const next = !vanillaElement.classList.contains("active");
        vanillaElement.className = next ? "active shared" : "inactive shared";
        vanillaElement.style.opacity = next ? "1" : "0.5";
        vanillaElement.style.transform = `translateX(${next ? 1 : 0}px)`;
        expect(vanillaElement.classList.contains("shared")).toBe(true);
      },
    );

    expectBenchResult(result);
  });

  it("benchmarks repeat() keyed list rendering against vanilla replaceChildren", () => {
    const fabricaContainer = document.createElement("div");
    const vanillaContainer = document.createElement("div");
    const initialRows = Array.from({ length: BIG_LIST_SIZE }, (_item, index) => ({ id: index, label: `Row ${index}` }));
    const rows = signal(initialRows);

    render(
      fabricaContainer,
      html`<ul>${repeat(rows, (row) => row.id, ({ item }) => html`<li>${() => item().label}</li>`)}</ul>`,
    );

    const result = bench(
      "repeat keyed update vs vanilla replaceChildren",
      80,
      () => {
        rows.set(rows.peek().map((row) => (row.id % 17 === 0 ? { ...row, label: `${row.label}!` } : row)).reverse());
        flushSync();
        expect(fabricaContainer.querySelectorAll("li")).toHaveLength(BIG_LIST_SIZE);
      },
      () => {
        const fragment = document.createDocumentFragment();
        for (let index = BIG_LIST_SIZE - 1; index >= 0; index -= 1) {
          const li = document.createElement("li");
          li.textContent = index % 17 === 0 ? `Row ${index}!` : `Row ${index}`;
          fragment.appendChild(li);
        }
        vanillaContainer.replaceChildren(fragment);
        expect(vanillaContainer.querySelectorAll("li")).toHaveLength(BIG_LIST_SIZE);
      },
    );

    expectBenchResult(result);
  });

  it("benchmarks $.create().css().appendTo() against createElement/setAttribute/append", () => {
    const fabricaContainer = document.createElement("div");
    const vanillaContainer = document.createElement("div");

    const result = bench(
      "dom bag create/css/append vs vanilla",
      BENCH_ITERATIONS,
      () => {
        fabricaContainer.replaceChildren();
        $.create("button.btn.primary")
          ({ text: "Save", dataset: { action: "save" }, attrs: { type: "button" } })
          .css({ backgroundColor: "black", color: "white", borderRadius: "8px" })
          .appendTo(fabricaContainer);
        expect(fabricaContainer.querySelector("button")?.textContent).toBe("Save");
      },
      () => {
        vanillaContainer.replaceChildren();
        const button = document.createElement("button");
        button.className = "btn primary";
        button.textContent = "Save";
        button.dataset.action = "save";
        button.type = "button";
        button.style.backgroundColor = "black";
        button.style.color = "white";
        button.style.borderRadius = "8px";
        vanillaContainer.append(button);
        expect(vanillaContainer.querySelector("button")?.textContent).toBe("Save");
      },
    );

    expectBenchResult(result);
  });
});

describe("Broto kitchen sink: reactive benchmarks against vanilla closures", () => {
  it("benchmarks signal read/write against a tiny vanilla getter/setter", () => {
    const count = signal(0);
    let plainValue = 0;
    const plain = {
      get: () => plainValue,
      set: (next: number) => {
        plainValue = next;
      },
    };

    const result = bench(
      "signal set/read vs closure set/read",
      BENCH_ITERATIONS * 10,
      () => {
        count.set(count.peek() + 1);
        expect(count()).toBe(count.peek());
      },
      () => {
        plain.set(plain.get() + 1);
        expect(plain.get()).toBe(plainValue);
      },
    );

    expectBenchResult(result);
  });

  it("benchmarks computed invalidation against manual derived assignment", () => {
    const left = signal(1);
    const right = signal(2);
    const total = computed(() => left() + right());
    let plainLeft = 1;
    let plainRight = 2;
    let plainTotal = plainLeft + plainRight;

    const result = bench(
      "computed invalidation vs manual derived value",
      BENCH_ITERATIONS,
      () => {
        left.update((value) => value + 1);
        right.update((value) => value + 1);
        flushSync();
        expect(total()).toBe(left.peek() + right.peek());
      },
      () => {
        plainLeft += 1;
        plainRight += 1;
        plainTotal = plainLeft + plainRight;
        expect(plainTotal).toBe(plainLeft + plainRight);
      },
    );

    expectBenchResult(result);
  });

  it("keeps benchmark diagnostics available for local console inspection", () => {
    const result = bench(
      "css object helper vs manual css text",
      BENCH_ITERATIONS * 3,
      () => {
        const output = css({ backgroundColor: "black", color: "white", borderRadius: "12px", paddingInline: "16px" });
        expect(output).toContain("background-color");
      },
      () => {
        const output = "background-color: black;color: white;border-radius: 12px;padding-inline: 16px;";
        expect(output).toContain("background-color");
      },
    );

    expectBenchResult(result);
    expect(benchResults.at(-1)).toEqual(result);
  });
});

describe("Fábrica kitchen sink: render-value edge cases", () => {
  it("accepts component functions as render values", () => {
    const Hello = component("HelloEdge", () => html`<p>Hello</p>`);
    render(host, html`${Hello}`);

    expect(textOf()).toBe("Hello");
  });

  it("accepts renderable payloads for plain element and component adapters", () => {
    const PayloadComponent = component<{ text: string }>("PayloadComponent", (props) => html`<b>${props.text}</b>`);
    const elementPayload = { tag: "i", props: { children: "Element payload" } } as const;
    const componentPayload = { component: PayloadComponent, props: { text: "Component payload" } } as const;

    render(host, html`${elementPayload}${componentPayload}`);

    expect(host.querySelector("i")?.textContent).toBe("Element payload");
    expect(host.querySelector("b")?.textContent).toBe("Component payload");
  });

  it("handles nested arrays and document fragments deeply", () => {
    const fragment = document.createDocumentFragment();
    fragment.append(document.createTextNode("D"));

    const values: RenderValue[] = ["A", ["B", ["C", fragment] as never] as never];
    render(host, html`<p>${values}</p>`);

    expect(textOf()).toBe("ABCD");
  });

  it("normalizes text from functions that return render fragments", () => {
    const open = signal(false);
    render(host, html`<div>${() => (open() ? html`<span>Open</span>` : html`<span>Closed</span>`)}</div>`);

    expect(textOf()).toBe("Closed");
    open.set(true);
    flushSync();
    expect(textOf()).toBe("Open");
  });
});
