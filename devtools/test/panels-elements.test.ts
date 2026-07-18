// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolContext } from "@rodkisten/devtools/types";
import { getMocks, polyfillBrowserApis } from "./_tests.setup";

import { Elements } from "@rodkisten/devtools/panels/elements";
import {
  render,
  styledRegistry,
} from "@rodkisten/devtools/core/runtime";

const mocks = getMocks();

const mocks = getMocks();

type Fixture = {
  tool: Elements;
  host: HTMLElement;
  shadowRoot: ShadowRoot;
  root: HTMLElement;
  container: HTMLElement;
  context: ToolContext;
  disposeView: () => void;
  settings: {
    registerSeparator: ReturnType<typeof vi.fn>;
    registerText: ReturnType<typeof vi.fn>;
    registerConfigGroup: ReturnType<typeof vi.fn>;
    registerSwitch: ReturnType<typeof vi.fn>;
  };
  devtools: {
    hide: ReturnType<typeof vi.fn>;
    show: ReturnType<typeof vi.fn>;
    showTool: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };
};

function createFixture(show = true): Fixture {
  document.body.innerHTML = `
    <main id="page-app">
      <section id="page-target" class="card selected">
        <h1 title="Page title">Hello Elements</h1>
        <button id="page-button" type="button">Click me</button>
      </section>
      <article id="secondary">
        <p>Secondary content</p>
      </article>
    </main>
  `;

  const host = document.createElement("div");
  host.id = "roderuda-test-host";
  host.className = "__roderuda-host__";
  document.body.append(host);

  const shadowRoot = host.attachShadow({ mode: "open" });

  const root = document.createElement("div");
  root.setAttribute("data-roderuda-root", "");

  const container = document.createElement("section");
  container.setAttribute("data-tool", "elements");

  root.append(container);
  shadowRoot.append(root);

  const settings = {
    registerSeparator: vi.fn(),
    registerText: vi.fn(),
    registerConfigGroup: vi.fn(),
    registerSwitch: vi.fn(),
  };

  const devtools = {
    hide: vi.fn(),
    show: vi.fn(),
    showTool: vi.fn(),
    get: vi.fn(),
  };

  devtools.show.mockReturnValue(devtools);

  const context = {
    root,
    shadowRoot,
    container,
    devtools,
    settings,
    notify: vi.fn(),
    prompt: vi.fn(),
    confirm: vi.fn(),
  } as unknown as ToolContext;

  const tool = new Elements();
  tool.init(container, context);
  const disposeView = render(container, tool.renderView());
  if (show) tool.show();

  return {
    tool,
    host,
    shadowRoot,
    root,
    container,
    context,
    disposeView,
    settings,
    devtools,
  };
}

function findNodeRow(
  container: ParentNode,
  matcher: string | RegExp,
): HTMLElement {
  const rows = Array.from(
    container.querySelectorAll<HTMLElement>("[data-node-id]"),
  );

  const row = rows.find((candidate) => {
    const text = candidate.textContent ?? "";

    return typeof matcher === "string"
      ? text.includes(matcher)
      : matcher.test(text);
  });

  expect(
    row,
    `Expected to find a DOM tree row matching ${String(matcher)}`,
  ).toBeInstanceOf(HTMLElement);

  return row!;
}

function findPageTargetRow(container: ParentNode): HTMLElement {
  const mainRow = findNodeRow(container, 'id="page-app"');
  const toggle = mainRow.querySelector<HTMLElement>("[data-toggle-node]");
  if (toggle?.textContent === "▸") click(toggle);
  return findNodeRow(container, 'id="page-target"');
}

function click(element: Element): void {
  element.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    }),
  );
}

function doubleClick(element: Element): void {
  element.dispatchEvent(
    new MouseEvent("dblclick", {
      bubbles: true,
      cancelable: true,
    }),
  );
}

function contextMenu(element: Element, x = 120, y = 180): void {
  element.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    }),
  );
}

async function flushMutationObserver(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("Elements panel", () => {
  let fixture: Fixture | null = null;

  beforeEach(() => {
    polyfillBrowserApis();

    mocks.copyText.mockClear();
    mocks.getEventListeners.mockClear();
    mocks.installEventListenerRegistry.mockClear();
    mocks.restoreEventRegistry.mockClear();
    mocks.highlighterInstances.length = 0;
  });

  afterEach(() => {
    fixture?.tool.destroy();
    fixture?.disposeView();
    fixture = null;

    document.body.replaceChildren();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("mounts the shell lazily without traversing the page while inactive", () => {
    fixture = createFixture(false);

    const { container, tool } = fixture;

    expect(tool.active).toBe(false);

    expect(
      container.querySelector("[data-elements-layout]"),
    ).toBeInstanceOf(HTMLElement);

    expect(
      container.querySelector("[data-elements-tree]"),
    ).toBeInstanceOf(HTMLElement);

    expect(
      container.querySelector("[data-elements-crumbs]"),
    ).toBeInstanceOf(HTMLElement);

    expect(
      container.querySelector("[data-elements-detail]"),
    ).toBeInstanceOf(HTMLElement);

    expect(
      container.querySelector("fabrica-component-error"),
    ).toBeNull();

    expect(
      container.querySelectorAll("[data-elements-layout]"),
    ).toHaveLength(1);

    expect(
      container.querySelectorAll("[data-elements-tree]"),
    ).toHaveLength(1);

    expect(
      container.querySelectorAll("[data-elements-detail]"),
    ).toHaveLength(1);

    expect(container.querySelectorAll("[data-node-id]")).toHaveLength(0);
    expect(mocks.getEventListeners).not.toHaveBeenCalled();
  });

  it("renders the inspected page DOM without rendering its own DevTools host", () => {
    fixture = createFixture();

    const tree = fixture.container.querySelector<HTMLElement>(
      "[data-elements-tree]",
    );

    expect(tree).toBeInstanceOf(HTMLElement);
    expect(tree?.textContent).toContain("<html");
    expect(tree?.textContent).toContain("<body");
    expect(tree?.textContent).toContain("<main");
    expect(tree?.textContent).toContain('id="page-app"');

    expect(tree?.textContent).not.toContain("roderuda-test-host");
    expect(tree?.textContent).not.toContain("__roderuda-host__");

    expect(tree?.textContent).not.toContain("&lt;html");
    expect(tree?.textContent).not.toContain("&gt;");
    expect(tree?.textContent).not.toContain("[object Object]");
    expect(fixture.container.textContent).not.toContain("[object Object]");
    expect(fixture.container.querySelector("fabrica-component-error")).toBeNull();
  });

  it("selects a DOM node and renders its complete detail inspector", () => {
    fixture = createFixture();

    const row = findPageTargetRow(fixture.container);

    click(row);

    const detail = fixture.container.querySelector<HTMLElement>(
      "[data-elements-detail]",
    );

    expect(detail).toBeInstanceOf(HTMLElement);
    expect(detail?.dataset.active).toBe("false");

    doubleClick(row);
    expect(detail?.dataset.active).toBe("true");

    expect(detail?.textContent).toContain("Attributes");
    expect(detail?.textContent).toContain("Text Content");
    expect(detail?.textContent).toContain("Box Model");
    expect(detail?.textContent).toContain("Computed Style");
    expect(detail?.textContent).toContain("Styles");
    expect(detail?.textContent).toContain("Event Listeners");
    expect(detail?.textContent).toContain("Properties");

    const idAttributeRow = Array.from(
      detail?.querySelectorAll<HTMLElement>("[data-attribute-row]") ?? [],
    ).find((row) => row.dataset.originalName === "id");

    expect(
      idAttributeRow?.querySelector<HTMLInputElement>("[data-attribute-name]"),
    ).toBeInstanceOf(HTMLInputElement);

    expect(mocks.getEventListeners).toHaveBeenCalled();
  });

  it("renders breadcrumbs and lets delegated breadcrumb clicks navigate", () => {
    fixture = createFixture();

    const targetRow = findPageTargetRow(fixture.container);

    doubleClick(targetRow);

    const crumbs = fixture.container.querySelector<HTMLElement>(
      "[data-elements-crumbs]",
    );

    expect(crumbs).toBeInstanceOf(HTMLElement);
    expect(crumbs?.textContent).toContain("html");
    expect(crumbs?.textContent).toContain("body");
    expect(crumbs?.textContent).toContain("main");
    expect(crumbs?.textContent).toContain("section#page-target");

    const buttons = crumbs?.querySelectorAll<HTMLElement>(
      "[data-crumb-index]",
    );

    expect(buttons?.length).toBeGreaterThan(2);

    const bodyCrumb = Array.from(buttons ?? []).find(
      (button) => button.textContent?.startsWith("body"),
    );

    expect(bodyCrumb).toBeInstanceOf(HTMLElement);

    click(bodyCrumb!);

    expect(
      crumbs?.querySelector<HTMLElement>('[data-current="true"]')
        ?.textContent,
    ).toContain("body");
  });

  it("expands and collapses DOM branches through delegated toggle events", () => {
    fixture = createFixture();

    const bodyRow = findNodeRow(
      fixture.container,
      /<body/,
    );

    expect(fixture.container.textContent).toContain('id="page-app"');

    const toggle = bodyRow.querySelector<HTMLElement>(
      "[data-toggle-node]",
    );

    expect(toggle).toBeInstanceOf(HTMLElement);

    click(toggle!);

    expect(fixture.container.textContent).not.toContain(
      'id="page-app"',
    );

    const collapsedBodyRow = findNodeRow(
      fixture.container,
      /<body/,
    );

    const collapsedToggle =
      collapsedBodyRow.querySelector<HTMLElement>(
        "[data-toggle-node]",
      );

    click(collapsedToggle!);

    expect(fixture.container.textContent).toContain(
      'id="page-app"',
    );
  });

  it("refreshes the tree after external DOM mutations without duplicating roots", async () => {
    vi.useFakeTimers();

    fixture = createFixture();

    const newNode = document.createElement("aside");
    newNode.id = "mutation-result";
    newNode.textContent = "Mutation appeared";

    document.body.append(newNode);

    await flushMutationObserver();
    vi.advanceTimersByTime(100);

    expect(fixture.container.textContent).toContain(
      'id="mutation-result"',
    );

    expect(
      fixture.container.querySelectorAll(
        "[data-elements-layout]",
      ),
    ).toHaveLength(1);

    expect(
      fixture.container.querySelectorAll(
        "[data-elements-tree]",
      ),
    ).toHaveLength(1);
  });

  it("does not rebuild the visible tree for mutations inside collapsed branches", async () => {
    vi.useFakeTimers();
    fixture = createFixture();

    const tree = fixture.container.querySelector<HTMLElement>("[data-elements-tree]");
    const renderedRoot = tree?.firstElementChild;
    expect(renderedRoot).toBeInstanceOf(HTMLElement);

    const nested = document.createElement("span");
    nested.id = "collapsed-branch-mutation";
    document.querySelector("#page-target")?.append(nested);

    await flushMutationObserver();
    vi.advanceTimersByTime(200);

    expect(tree?.firstElementChild).toBe(renderedRoot);
    expect(tree?.textContent).not.toContain("collapsed-branch-mutation");
  });

  it("supports whitespace-only text nodes when the setting is enabled", () => {
    fixture = createFixture();

    const target = document.querySelector("#page-target")!;
    target.append(document.createTextNode("   \n   "));

    const targetRow = findPageTargetRow(fixture.container);

    const toggle = targetRow.querySelector<HTMLElement>(
      "[data-toggle-node]",
    );

    expect(toggle).toBeInstanceOf(HTMLElement);

    click(toggle!);

    const before = fixture.container.querySelectorAll(
      "[data-node-id]",
    ).length;

    fixture.tool.config.set("showWhitespace", true);

    const after = fixture.container.querySelectorAll(
      "[data-node-id]",
    ).length;

    expect(after).toBeGreaterThan(before);
  });

  it("opens a real context menu inside the delegated event boundary", async () => {
    fixture = createFixture();

    const targetRow = findPageTargetRow(fixture.container);

    contextMenu(targetRow, 5000, 5000);

    const menu = fixture.container.querySelector<HTMLElement>(
      "[data-elements-menu]",
    );

    expect(menu).toBeInstanceOf(HTMLElement);
    expect(menu?.parentElement).toBe(fixture.container);

    expect(menu?.style.left).toMatch(/px$/);
    expect(menu?.style.top).toMatch(/px$/);

    expect(
      menu?.querySelectorAll("[data-elements-menu-action]"),
    ).toHaveLength(9);

    await Promise.resolve();

    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
      }),
    );

    expect(
      fixture.container.querySelector("[data-elements-menu]"),
    ).toBeNull();
  });

  it("executes context-menu actions through delegated handlers", async () => {
    fixture = createFixture();

    const targetRow = findPageTargetRow(fixture.container);

    contextMenu(targetRow);

    const copySelector = fixture.container.querySelector<HTMLElement>(
      '[data-elements-menu-action="copy-selector"]',
    );

    expect(copySelector).toBeInstanceOf(HTMLElement);

    click(copySelector!);

    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.copyText).toHaveBeenCalledTimes(1);

    const copiedSelector = String(
      mocks.copyText.mock.calls[0]?.[0],
    );

    expect(copiedSelector).toContain("#page-target");

    expect(
      fixture.container.querySelector("[data-elements-menu]"),
    ).toBeNull();
  });

  it("edits an attribute using delegated change handling", () => {
    fixture = createFixture();

    const targetRow = findPageTargetRow(fixture.container);

    click(targetRow);

    const idRow = Array.from(
      fixture.container.querySelectorAll<HTMLElement>(
        "[data-attribute-row]",
      ),
    ).find(
      (row) => row.dataset.originalName === "id",
    );

    expect(idRow).toBeInstanceOf(HTMLElement);

    const nameInput = idRow!.querySelector<HTMLInputElement>(
      "[data-attribute-name]",
    );

    const valueInput = idRow!.querySelector<HTMLInputElement>(
      "[data-attribute-value]",
    );

    expect(nameInput).toBeInstanceOf(HTMLInputElement);
    expect(valueInput).toBeInstanceOf(HTMLInputElement);

    valueInput!.value = "page-target-renamed";

    valueInput!.dispatchEvent(
      new Event("change", {
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(
      document.querySelector("#page-target-renamed"),
    ).toBeInstanceOf(HTMLElement);

    expect(fixture.container.textContent).toContain(
      'id="page-target-renamed"',
    );
  });

  it("updates inline styles from the Styles editor", () => {
    fixture = createFixture();

    const targetRow = findPageTargetRow(fixture.container);

    click(targetRow);

    const editableRows = fixture.container.querySelectorAll<HTMLElement>(
      "[data-style-declaration]",
    );

    expect(editableRows.length).toBeGreaterThan(0);

    const emptyRow = Array.from(editableRows).find((row) => {
      const property = row.querySelector<HTMLInputElement>(
        "[data-style-property]",
      );

      return property?.value === "";
    });

    expect(emptyRow).toBeInstanceOf(HTMLElement);

    const propertyInput =
      emptyRow!.querySelector<HTMLInputElement>(
        "[data-style-property]",
      );

    const valueInput =
      emptyRow!.querySelector<HTMLInputElement>(
        "[data-style-value]",
      );

    expect(propertyInput).toBeInstanceOf(HTMLInputElement);
    expect(valueInput).toBeInstanceOf(HTMLInputElement);

    propertyInput!.value = "background-color";
    valueInput!.value = "rgb(255, 0, 0) !important";

    valueInput!.dispatchEvent(
      new Event("change", {
        bubbles: true,
        cancelable: true,
      }),
    );

    const target = document.querySelector<HTMLElement>(
      "#page-target",
    );

    expect(
      target?.style.getPropertyValue("background-color"),
    ).toBe("rgb(255, 0, 0)");

    expect(
      target?.style.getPropertyPriority("background-color"),
    ).toBe("important");
  });

  it("highlights nodes on selection and hides the overlay on panel hide", () => {
    fixture = createFixture();

    const targetRow = findPageTargetRow(fixture.container);

    click(targetRow);

    const highlighter = mocks.highlighterInstances.at(-1);

    expect(highlighter).toBeDefined();
    expect(highlighter?.highlight).not.toHaveBeenCalled();

    doubleClick(targetRow);
    expect(highlighter?.highlight).toHaveBeenCalled();

    fixture.tool.hide();

    expect(highlighter?.hide).toHaveBeenCalled();
  });

  it("installs and restores the event-listener registry", () => {
    fixture = createFixture();

    expect(
      mocks.installEventListenerRegistry,
    ).toHaveBeenCalledTimes(1);

    fixture.tool.config.set("overrideEventTarget", false);

    expect(
      mocks.restoreEventRegistry,
    ).toHaveBeenCalledTimes(1);

    fixture.tool.config.set("overrideEventTarget", true);

    expect(
      mocks.installEventListenerRegistry,
    ).toHaveBeenCalledTimes(2);
  });

  it("destroys and initializes again without duplicate DOM or hanging listeners", () => {
    fixture = createFixture();

    const firstTool = fixture.tool;
    const { container, context } = fixture;

    firstTool.destroy();
    fixture.disposeView();

    const secondTool = new Elements();
    secondTool.init(container, context);
    const disposeSecondView = render(container, secondTool.renderView());
    secondTool.show();

    expect(
      container.querySelectorAll("[data-elements-layout]"),
    ).toHaveLength(1);

    expect(
      container.querySelectorAll("[data-elements-tree]"),
    ).toHaveLength(1);

    expect(
      container.querySelector("fabrica-component-error"),
    ).toBeNull();

    secondTool.destroy();
    disposeSecondView();

    fixture = null;
  });

  it("collects panel Cipó artifacts without manual component lists or raw theme tokens", () => {
    const elementsArtifacts = styledRegistry.cssArtifacts.filter((artifact) =>
      styledRegistry.components.some((component) => component.displayName?.startsWith("RodElements") && component.artifacts.includes(artifact)),
    );

    expect(elementsArtifacts.length).toBeGreaterThan(0);

    const cssText = elementsArtifacts
      .map((artifact) => {
        const value = artifact as CipoArtifactLike;

        return (
          value.compiledCss
          ?? value.cssText
          ?? value.value
          ?? ""
        );
      })
      .join("\n");

    // Class-name strategy is intentionally an implementation detail: native
    // tests use readable runtime classes while production Vite builds use
    // compact hashes. Assert that real compiled rules exist instead.
    expect(cssText).toMatch(/\.[A-Za-z_-][\w-]*\s*\{/);
    expect(cssText).not.toContain("$background");
    expect(cssText).not.toContain("$border");
    expect(cssText).not.toContain("$primary");
    expect(cssText).not.toContain("$font.");
    expect(cssText).not.toContain("$$controlHeight");
    expect(cssText).not.toContain("$$safeBottom");
  });
  it("toggles soft wrapping for long DOM rows from panel config", () => {
    fixture = createFixture();
    const tree = fixture.container.querySelector<HTMLElement>("[data-elements-tree]");
    expect(tree?.dataset.wrap).toBe("true");
    fixture.tool.config.set("wrapLines", false);
    expect(tree?.dataset.wrap).toBe("false");
  });

});

type CipoArtifactLike = {
  cssText?: string;
  compiledCss?: string;
  value?: string;
};
