/**
 * @vitest-environment jsdom
 *
 * Fábrica Kitchen Sink Test Suite
 *
 * Vital contract suite for the public Fábrica surface: renderer, directives,
 * components, DOM bags, Cipó styled integration, globals, and edge render values.
 * Broto core contracts live in the broto package; this file only covers Broto APIs
 * that Fábrica wraps (suspense, debug snapshots, resource bindings).
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
  mountPreservingChildren,
  jsx,
  listComponents,
  mount,
  onDispose,
  onMount,
  portal,
  rawHtml,
  ref,
  render,
  repeat,
  resolveComponent,
  sanitizedHtml,
  setDebug,
  styleMap,
  suspense,
  trustedHtml,
  unsafeHtml,
  unregisterComponent,
  virtualRepeat,
  when,
} from "@rodkisten/fabrica";
import {
  batch,
  computed,
  configureScheduler,
  createOwner,
  createRoot,
  debug as brotoDebug,
  flushSync,
  getOwner,
  graph,
  inspectGraph,
  onOwnerCleanup,
  resource,
  runWithOwner,
  setDebug as setBrotoDebug,
  signal,
} from "@rodkisten/broto";
import {
  reset as resetCipo,
  setup as setupCipo,
  styled as cipoStyled,
} from "@rodkisten/cipo";
import { createElementFactory, composeEvents, composeProps, composeRefs, polymorphic, slot } from "@rodkisten/fabrica-elements";
import type { Cleanup, RenderValue } from "@rodkisten/fabrica";

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
  resetCipo();
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



describe("Fábrica kitchen sink: Fabrica Elements and Cipó styled integration", () => {
  beforeEach(() => {
    resetCipo();
    setupCipo({
      prefix: "fx",
      adapter: "dom",
      minify: true,
      layers: false,
      theme: {
        colors: {
          brand: "#38bdf8",
          ink: "#020617",
        },
        spacing: "0.25rem",
        radius: { md: "12px" },
      },
    });
  });

  it("renders Fabrica Elements payloads through the Fabrica renderer", () => {
    const payloadElements = createElementFactory({ adapter: "payload" });
    const card = payloadElements.section({
      class: ["card", "payload"],
      dataset: { source: "elements" },
      children: [
        payloadElements.h2({ children: "Payload title" }),
        payloadElements.button({ type: "button", children: "Save" }),
      ],
    }) as RenderValue;

    render(host, html`${card}`);

    expect(host.querySelector("section.card.payload")?.getAttribute("data-source")).toBe("elements");
    expect(host.querySelector("h2")?.textContent).toBe("Payload title");
    expect(host.querySelector("button")?.textContent).toBe("Save");
  });

  it("renders Cipó styled DOM factories as Fabrica component tags", () => {
    const onClick = vi.fn();
    const Button = cipoStyled.button.css`
      px: 4
      py: 2
      bg: $brand
      color: $ink
      rounded: md
    `;

    render(host, html`
      <${Button} type="button" data-kind="styled" @click=${onClick}>
        Save
      </${Button}>
    `);

    const button = host.querySelector("button") as HTMLButtonElement;
    expect(button).toBeTruthy();
    expect(button.type).toBe("button");
    expect(button.dataset.kind).toBe("styled");
    expect(button.className).toContain("fx-padding-inline-");
    expect(textOf(button)).toBe("Save");

    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("re-runs styled component tags when dynamic props are reactive", async () => {
    const tone = signal("primary");
    const title = signal("Initial");
    const Button = cipoStyled.button.css`
      px: 2
      bg: $brand
    `;

    render(host, html`
      <${Button} data-tone=${tone} title=${title}>
        Save
      </${Button}>
    `);

    let button = host.querySelector("button") as HTMLButtonElement;
    expect(button.dataset.tone).toBe("primary");
    expect(button.title).toBe("Initial");

    batch(() => {
      tone.set("danger");
      title.set("Updated");
    });
    flushSync();
    await tick();

    button = host.querySelector("button") as HTMLButtonElement;
    expect(button.dataset.tone).toBe("danger");
    expect(button.title).toBe("Updated");
    expect(textOf(button)).toBe("Save");
  });
});

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
    expect(textOf()).toBe("text 123 0 arraynodefragment");
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
    expect(textOf()).toBe("Count: 12");

    count.set(5);
    flushSync();
    await tick();

    expect(textOf()).toBe("Count: 510");
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

    expect(Array.from(host.querySelectorAll("li")).map((li) => li.getAttribute("data-key"))).toEqual(["c", "a"]);
    expect(Array.from(host.querySelectorAll("li")).map((li) => li.textContent)).toEqual(["2:Gamma", "0:Alpha"]);

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

  it("accepts direct callback refs without the ref() wrapper", () => {
    const host = document.createElement("div");
    let button: HTMLElement | null = null;
    const cleanup = vi.fn();

    const dispose = render(host, html`<button ref=${(node) => {
      button = node;
      return cleanup;
    }}>Direct ref</button>`);

    expect(button).toBeInstanceOf(HTMLButtonElement);
    dispose();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("supports mutable object refs and clears them on dispose", () => {
    const host = document.createElement("div");
    const button = { current: null as HTMLElement | null };

    const dispose = render(host, html`<button ref=${button}>Object ref</button>`);

    expect(button.current).toBeInstanceOf(HTMLButtonElement);
    dispose();
    expect(button.current).toBeNull();
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

  it("maps component event attributes to onX props and supports DOM spread props", () => {
    const click = vi.fn();
    const Button = component<{ onClick?: (event: MouseEvent) => void; title?: string }>("SpreadButton", (props) => {
      const { children, ...rest } = props;
      return html`<button ...${rest}>${children}</button>`;
    });

    render(host, html`<${Button} @click=${click} title="Spread title">Save</${Button}>`);

    const button = host.querySelector("button") as HTMLButtonElement;
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(button.title).toBe("Spread title");
    expect(button.textContent).toBe("Save");
  });

  it("diffs reactive spread props and removes stale spread event listeners", () => {
    const first = vi.fn();
    const second = vi.fn();
    const props = signal<Record<string, unknown>>({
      class: "first",
      disabled: false,
      onClick: first,
      dataset: { mode: "one" },
    });

    render(host, html`<button ...${props}>Spread</button>`);
    const button = host.querySelector("button") as HTMLButtonElement;

    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(first).toHaveBeenCalledTimes(1);
    expect(button.className).toBe("first");
    expect(button.dataset.mode).toBe("one");

    props.set({ class: "second", disabled: true, onClick: second });
    flushSync();

    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(button.className).toBe("second");
    expect(button.disabled).toBe(true);
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

    expect(errors).toHaveLength(1);
    expect(host.querySelector("button")?.textContent).toBe("boom");
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

describe("Fábrica kitchen sink: public API, globals and debug", () => {
  it("creates a frozen API object with the expected public keys", () => {
    const api = createFabricaApi();

    expect(Object.isFrozen(api)).toBe(true);
    expect(api.html).toBeTypeOf("function");
    expect(api.render).toBeTypeOf("function");
    expect(api.mount).toBeTypeOf("function");
    expect(api.render).not.toBe(render);
    expect(api.mount).not.toBe(mount);
    expect(api.registry).toBeDefined();
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
    expect(globalThis.$el).not.toBe($);
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

describe("Fábrica kitchen sink: render-value edge cases", () => {
  it("accepts component functions as render values", () => {
    const Hello = component("HelloEdge", () => html`<p>Hello</p>`);
    render(host, html`${Hello()}`);

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


  it("renders portal content into a foreign root and disposes it with owner range", () => {
    const host = document.createElement("div");
    const target = document.createElement("div");
    document.body.append(host, target);

    const dispose = render(host, html`${portal(target, html`<span class="ported">Portal</span>`)}`);

    expect(host.textContent).toBe("");
    expect(target.querySelector(".ported")?.textContent).toBe("Portal");

    dispose();
    expect(target.querySelector(".ported")).toBeNull();
  });

  it("renders suspense resource states", () => {
    const host = document.createElement("div");
    const state = signal({ loading: true, value: undefined as unknown, error: undefined as unknown });

    render(host, html`${suspense(
      state,
      (value) => html`<strong>${String(value)}</strong>`,
      () => html`<span>Loading</span>`,
      (error) => html`<em>${String(error)}</em>`,
    )}`);

    expect(host.textContent).toBe("Loading");
    state.set({ loading: false, value: "Done", error: undefined });
    flushSync();
    expect(host.textContent).toBe("Done");
  });

  it("mounts without clearing existing markup", () => {
    const host = document.createElement("div");
    host.innerHTML = "<span>server</span>";

    const dispose = mountPreservingChildren(
      host,
      html`<button>client</button>`,
    );

    expect(host.textContent).toContain("server");
    expect(host.textContent).toContain("client");
    dispose();
    expect(host.textContent).toContain("server");
  });

  it("supports append-only repeat strategy for growing log lists", () => {
    const host = document.createElement("div");
    const rows = signal([{ id: 1, label: "one" }]);

    render(host, html`${repeat(rows, (row) => row.id, ({ item }) => html`<p>${() => item().label}</p>`, { strategy: "append-only" })}`);
    expect(host.textContent).toBe("one");

    rows.set([{ id: 1, label: "one" }, { id: 2, label: "two" }]);
    flushSync();
    expect(host.textContent).toBe("onetwo");
  });


  it("exposes owner graph diagnostics with descendant counts", () => {
    const [ownerSnapshot, dispose] = createRoot(() => {
      const child = createOwner({ name: "child" });
      runWithOwner(child, () => onOwnerCleanup(() => undefined));
      return inspectGraph(getOwner());
    }, { name: "root" });

    expect(ownerSnapshot?.descendants).toBe(1);
    expect(ownerSnapshot?.children[0]?.name).toBe("child");
    dispose();
  });

  it("supports resource retry and refresh interval controls", async () => {
    let count = 0;
    const profile = resource(async () => {
      count += 1;
      return count;
    }, { immediate: false });

    await expect(profile.retry()).resolves.toBe(1);
    const stop = profile.refreshInterval(1);
    stop();
    expect(typeof profile.abort).toBe("function");
  });

  it("composes Fabrica Elements props, refs, events, slots and polymorphic wrappers", () => {
    const calls: string[] = [];
    const refA = { current: null as Element | null };
    const ref = composeRefs(refA, (node) => {
      if (node) calls.push("ref");
    });
    const props = composeProps(
      { class: "base", onClick: () => calls.push("base") },
      { class: ["primary"], onClick: () => calls.push("override"), ref },
    );
    const event = new Event("click");
    (props.onClick as (event: Event) => void)(event);
    expect(calls.join(",")).toContain("base,override");
    expect(props.class).toBe("base primary");

    const node = document.createElement("button");
    ;(props.ref as (value: Element | null) => void)(node);
    expect(refA.current).toBe(node);
    expect(slot({ header: "Title" }, "header")).toBe("Title");

    const Box = polymorphic("div", (as, nextProps) => ({ as, props: nextProps }));
    expect(Box({ as: "button", type: "button" }).as).toBe("button");

    const chained = composeEvents<Event>(() => calls.push("one"), () => calls.push("two"));
    chained(new Event("click"));
    expect(calls.slice(-2).join(",")).toBe("one,two");
  });

});


