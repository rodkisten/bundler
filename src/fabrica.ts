/**
 * FabricaDOM v6.
 *
 * Tiny fine-grained DOM runtime with signals, components, directives,
 * reusable DOM bags, Shadow DOM, CSS helpers, and safe global installation.
 */
const Fabrica = (() => {
  "use strict";

  const TEXT_MARKER = "fabrica:text:";
  const ATTR_MARKER = "__fabrica_attr_";
  const ATTR_SUFFIX = "__";
  const START = "fabrica:start";
  const END = "fabrica:end";
  const RAW = Symbol("fabrica.raw");
  const DIRECTIVE = Symbol("fabrica.directive");
  const COMPONENT = Symbol("fabrica.component");

  const templateCache = new WeakMap();
  const cleanupMap = new WeakMap();
  const effectQueue = new Set();

  let activeEffect = null;
  let shouldTrack = true;
  let batchDepth = 0;
  let flushQueued = false;
  let previousDollar = globalThis.$;
  let previousDollarEl = globalThis.$el;

  const config = {
    exposeDollar: false,
    exposeDollarEl: true,
    dollarAlias: "$el",
    forceAlias: false,
    allowInlineHandlers: false,
    createWhenSelectorMisses: true,
  };

  const debugState = {
    templates: 0,
    parts: 0,
    effects: 0,
    updates: 0,
    flushes: 0,
    components: 0,
  };

  /**
   * Creates a reactive signal.
   *
   * @param {unknown} initial Initial value.
   * @returns {Function} Signal reader with mutation helpers.
   *
   * @example
   * ```js
   * const count = Fabrica.signal(0);
   * count.set(1);
   * count.update((value) => value + 1);
   * console.log(count());
   * ```
   */
  function signal(initial) {
    let value = initial;
    const subscribers = new Set();

    function read() {
      if (activeEffect && shouldTrack && !subscribers.has(activeEffect)) {
        subscribers.add(activeEffect);
        activeEffect.deps.push(subscribers);
      }

      return value;
    }

    read.set = function set(next) {
      if (Object.is(value, next)) return;
      value = next;

      for (const subscriber of Array.from(subscribers)) {
        scheduleEffect(subscriber);
      }
    };

    read.update = function update(updater) {
      if (typeof updater !== "function") {
        throw new TypeError("signal.update() expects a function.");
      }

      read.set(updater(value));
    };

    read.peek = function peek() {
      return value;
    };

    read.subscribe = function subscribe(listener) {
      subscribers.add(listener);

      return function unsubscribe() {
        subscribers.delete(listener);
      };
    };

    return read;
  }

  /**
   * Runs a tracked effect.
   *
   * @param {(onCleanup: (cleanup: Function) => void) => void} callback Effect body.
   * @param {{ sync?: boolean }} [options] Effect options.
   * @returns {Function} Dispose function.
   *
   * @example
   * ```js
   * const stop = Fabrica.effect((cleanup) => {
   *   const id = setInterval(() => console.log(count()), 1000);
   *   cleanup(() => clearInterval(id));
   * });
   * stop();
   * ```
   */
  function effect(callback, options = {}) {
    function runner() {
      if (runner.disposed) return;

      cleanupEffect(runner);

      const previous = activeEffect;
      activeEffect = runner;

      try {
        callback(onCleanup);
      } finally {
        activeEffect = previous;
      }
    }

    runner.deps = [];
    runner.cleanups = [];
    runner.disposed = false;
    runner.sync = Boolean(options.sync);

    debugState.effects += 1;
    runner();

    return function dispose() {
      runner.disposed = true;
      cleanupEffect(runner);
    };
  }

  /**
   * Registers cleanup for the current effect.
   *
   * @param {Function} cleanup Cleanup callback.
   * @returns {void}
   *
   * @example
   * ```js
   * Fabrica.effect((onCleanup) => {
   *   const controller = new AbortController();
   *   onCleanup(() => controller.abort());
   * });
   * ```
   */
  function onCleanup(cleanup) {
    if (activeEffect && typeof cleanup === "function") {
      activeEffect.cleanups.push(cleanup);
    }
  }

  /**
   * Creates a derived signal.
   *
   * @param {Function} getter Getter.
   * @returns {Function} Derived signal.
   *
   * @example
   * ```js
   * const doubled = Fabrica.computed(() => count() * 2);
   * ```
   */
  function computed(getter) {
    const output = signal(undefined);

    effect(() => {
      output.set(getter());
    });

    return output;
  }

  /**
   * Alias for computed.
   *
   * @param {Function} getter Getter.
   * @returns {Function} Memoized signal.
   *
   * @example
   * ```js
   * const label = Fabrica.memo(() => `Count: ${count()}`);
   * ```
   */
  function memo(getter) {
    return computed(getter);
  }

  /**
   * Runs code without dependency tracking.
   *
   * @param {Function} callback Callback.
   * @returns {unknown} Callback result.
   *
   * @example
   * ```js
   * const raw = Fabrica.untrack(() => count());
   * ```
   */
  function untrack(callback) {
    const previous = shouldTrack;
    shouldTrack = false;

    try {
      return callback();
    } finally {
      shouldTrack = previous;
    }
  }

  /**
   * Batches multiple writes into one flush.
   *
   * @param {Function} callback Batch callback.
   * @returns {unknown} Callback result.
   *
   * @example
   * ```js
   * Fabrica.batch(() => {
   *   first.set("Rod");
   *   last.set("Dev");
   * });
   * ```
   */
  function batch(callback) {
    batchDepth += 1;

    try {
      return callback();
    } finally {
      batchDepth -= 1;

      if (batchDepth === 0 && effectQueue.size > 0) {
        queueFlush();
      }
    }
  }

  /**
   * Creates DOM from a tagged template.
   *
   * @param {TemplateStringsArray} strings Template strings.
   * @param {...unknown} values Dynamic values.
   * @returns {DocumentFragment} Rendered fragment.
   *
   * @example
   * ```js
   * const view = Fabrica.html`<strong>${name}</strong>`;
   * ```
   */
  function html(strings, ...values) {
    const compiled = compileTemplate(strings);
    const fragment = compiled.template.content.cloneNode(true);

    applyParts(fragment, compiled.parts, values);

    return fragment;
  }

  /**
   * Creates trusted raw HTML.
   *
   * @param {string} value Trusted HTML.
   * @returns {object} Raw HTML directive.
   *
   * @example
   * ```js
   * Fabrica.html`<article>${Fabrica.html.raw("<strong>Safe because I trust it</strong>")}</article>`;
   * ```
   */
  html.raw = function raw(value) {
    return { [RAW]: true, value: String(value) };
  };

  /**
   * Replaces a container with rendered content.
   *
   * @param {Element | DocumentFragment | ShadowRoot} container Container.
   * @param {unknown} value Render value.
   * @returns {Function} Dispose function.
   *
   * @example
   * ```js
   * const dispose = Fabrica.render(document.body, Fabrica.html`<h1>Hello</h1>`);
   * ```
   */
  function render(container, value) {
    disposeTree(container);
    container.replaceChildren();
    appendValue(container, value);

    return function dispose() {
      disposeTree(container);
      container.replaceChildren();
    };
  }

  /**
   * Mounts content without clearing the container.
   *
   * @param {Node} container Container.
   * @param {unknown} value Render value.
   * @returns {Function} Dispose function.
   *
   * @example
   * ```js
   * const dispose = Fabrica.mount(document.body, Fabrica.html`<button>Hi</button>`);
   * ```
   */
  function mount(container, value) {
    const start = document.createComment("fabrica:mount:start");
    const end = document.createComment("fabrica:mount:end");

    container.append(start);
    appendValue(container, value);
    container.append(end);

    return function dispose() {
      disposeRange(start, end);
      removeRange(start, end);
    };
  }

  /**
   * Creates a reusable component.
   *
   * @param {(props: object, ctx: object) => unknown} factory Component factory.
   * @returns {Function} Component function.
   *
   * @example
   * ```js
   * const Counter = Fabrica.component(() => {
   *   const count = Fabrica.signal(0);
   *   return Fabrica.html`<button @click=${() => count.update((n) => n + 1)}>${count}</button>`;
   * });
   * ```
   */
  function component(factory) {
    function Component(props = {}) {
      const cleanups = [];
      const mounted = [];

      const ctx = {
        signal,
        effect(callback, options) {
          const stop = effect(callback, options);
          cleanups.push(stop);
          return stop;
        },
        computed,
        memo,
        batch,
        untrack,
        onMount(callback) {
          if (typeof callback === "function") mounted.push(callback);
        },
        onDispose(callback) {
          if (typeof callback === "function") cleanups.push(callback);
        },
        ref(callback) {
          return ref((node) => {
            const cleanup = callback(node);
            if (typeof cleanup === "function") cleanups.push(cleanup);
          });
        },
        id: `fab-${Math.random().toString(36).slice(2)}`,
      };

      const output = factory(props, ctx);
      const fragment = document.createDocumentFragment();
      const start = document.createComment("fabrica:component:start");
      const end = document.createComment("fabrica:component:end");

      fragment.append(start);
      appendValue(fragment, output);
      fragment.append(end);

      registerCleanup(start, () => {
        for (const cleanup of cleanups.splice(0)) cleanup();
      });

      queueMicrotask(() => {
        if (start.isConnected) {
          for (const callback of mounted.splice(0)) {
            const cleanup = callback();
            if (typeof cleanup === "function") cleanups.push(cleanup);
          }
        }
      });

      return fragment;
    }

    Object.defineProperty(Component, COMPONENT, { value: true });
    debugState.components += 1;

    return Component;
  }

  /**
   * Creates a conditional directive.
   *
   * @param {unknown} condition Condition.
   * @param {Function} truthy Truthy renderer.
   * @param {Function} [falsy] Falsy renderer.
   * @returns {object} Directive.
   *
   * @example
   * ```js
   * Fabrica.when(open, () => Fabrica.html`Open`, () => Fabrica.html`Closed`);
   * ```
   */
  function when(condition, truthy, falsy) {
    return directive({ kind: "when", condition, truthy, falsy });
  }

  /**
   * Creates a keyed repeat directive.
   *
   * @param {unknown[] | Function} items Items.
   * @param {Function} key Key getter.
   * @param {Function} renderItem Item renderer.
   * @param {{ empty?: Function }} [options] Options.
   * @returns {object} Directive.
   *
   * @example
   * ```js
   * Fabrica.repeat(users, (user) => user.id, ({ item }) => Fabrica.html`<li>${() => item().name}</li>`);
   * ```
   */
  function repeat(items, key, renderItem, options = {}) {
    return directive({ kind: "repeat", items, key, render: renderItem, empty: options.empty });
  }

  /**
   * Creates a ref directive.
   *
   * @param {(node: Element) => void | Function} callback Ref callback.
   * @returns {object} Ref directive.
   *
   * @example
   * ```js
   * Fabrica.html`<input ref=${Fabrica.ref((node) => node.focus())} />`;
   * ```
   */
  function ref(callback) {
    return directive({ kind: "ref", callback });
  }

  /**
   * Creates a class map directive.
   *
   * @param {Record<string, unknown>} value Class map.
   * @returns {object} Class map directive.
   *
   * @example
   * ```js
   * Fabrica.html`<div class=${Fabrica.classMap({ active })}></div>`;
   * ```
   */
  function classMap(value) {
    return directive({ kind: "classMap", value });
  }

  /**
   * Creates a style map directive.
   *
   * @param {Record<string, unknown>} value Style map.
   * @returns {object} Style map directive.
   *
   * @example
   * ```js
   * Fabrica.html`<div style=${Fabrica.styleMap({ opacity: () => open() ? "1" : "0.5" })}></div>`;
   * ```
   */
  function styleMap(value) {
    return directive({ kind: "styleMap", value });
  }

  /**
   * Creates CSS text from template, string, or object.
   *
   * @param {TemplateStringsArray | string | Record<string, unknown>} input CSS input.
   * @param {...unknown} values Dynamic values.
   * @returns {string} CSS text.
   *
   * @example
   * ```js
   * const css = Fabrica.css`
   *   color: ${color};
   * `;
   * ```
   */
  function css(input, ...values) {
    if (typeof input === "string") return input;

    if (isTemplateStrings(input)) {
      let output = "";

      for (let index = 0; index < input.length; index += 1) {
        output += input[index] || "";

        if (index < values.length) {
          output += stringify(readValue(values[index]));
        }
      }

      return output;
    }

    if (isPlainObject(input)) {
      let output = "";

      for (const key in input) {
        const value = readValue(input[key]);
        if (value == null || value === false) continue;
        output += `${kebab(key)}: ${String(value)};`;
      }

      return output;
    }

    return "";
  }

  /**
   * Creates or queries a DOM bag.
   *
   * @param {string | Element | NodeList | Element[]} target Target.
   * @param {ParentNode} [root] Query root.
   * @returns {Function} DOM bag.
   *
   * @example
   * ```js
   * Fabrica.$("body").html`<h1>Hello</h1>`;
   * ```
   */
  function $(target, root = document) {
    return createBag(resolveElements(target, root), { shadow: false, important: false });
  }

  $.create = function create(expression) {
    return createBag([createElement(expression)], { shadow: false, important: false });
  };

  $.find = function find(selector, root = document) {
    return createBag(Array.from(root.querySelectorAll(selector)).filter(isElement), {
      shadow: false,
      important: false,
    });
  };

  $.html = html;
  $.css = css;
  $.raw = html.raw;
  $.signal = signal;
  $.effect = effect;
  $.computed = computed;
  $.memo = memo;
  $.batch = batch;
  $.untrack = untrack;
  $.component = component;
  $.when = when;
  $.repeat = repeat;
  $.ref = ref;
  $.classMap = classMap;
  $.styleMap = styleMap;

  /**
   * Creates a DOM bag.
   *
   * @param {Element[]} elements Elements.
   * @param {{ shadow: boolean, important: boolean }} options Options.
   * @returns {Function} Bag.
   */
  function createBag(elements, options) {
    let disposeRender = null;

    function bag(props = {}) {
      for (const element of elements) {
        applyProps(element, props);
      }

      return bag;
    }

    bag.$$fabricaBag = true;
    bag.elements = elements;
    bag.el = elements[0] || null;
    bag.count = elements.length;
    bag.size = elements.length;
    bag.dispose = function dispose() {
      if (disposeRender) disposeRender();
      disposeRender = null;
      return bag;
    };

    Object.defineProperty(bag, "length", {
      get() {
        return elements.length;
      },
    });

    Object.defineProperty(bag, "shadow", {
      get() {
        return createBag(elements, { ...options, shadow: true });
      },
    });

    Object.defineProperty(bag, "important", {
      get() {
        return createBag(elements, { ...options, important: true });
      },
    });

    bag.html = function bagHtml(strings, ...values) {
      if (disposeRender) disposeRender();

      const disposers = [];

      for (const element of elements) {
        const root = options.shadow ? getShadowRoot(element) : element;
        disposers.push(render(root, html(strings, ...values)));
      }

      disposeRender = function disposeAll() {
        for (const dispose of disposers.splice(0)) dispose();
      };

      return bag;
    };

    bag.mount = function bagMount(value) {
      const disposers = [];

      for (const element of elements) {
        const root = options.shadow ? getShadowRoot(element) : element;
        disposers.push(mount(root, value));
      }

      return function disposeAll() {
        for (const dispose of disposers.splice(0)) dispose();
      };
    };

    bag.css = function bagCss(input, ...values) {
      for (const element of elements) {
        applyCss(element, input, values, options.important);
      }

      return bag;
    };

    bag.appendTo = function appendTo(parent) {
      parent.append(...elements);
      return bag;
    };

    bag.prependTo = function prependTo(parent) {
      parent.prepend(...elements);
      return bag;
    };

    bag.remove = function remove() {
      for (const element of elements) {
        disposeTree(element);
        element.remove();
      }

      return bag;
    };

    return bag;
  }

  function compileTemplate(strings) {
    const cached = templateCache.get(strings);
    if (cached) return cached;

    const template = document.createElement("template");
    template.innerHTML = buildSource(strings);

    const parts = [];
    collectChildParts(template.content, parts);
    collectAttributeParts(template.content, parts);

    const compiled = { template, parts };
    templateCache.set(strings, compiled);

    debugState.templates += 1;
    debugState.parts += parts.length;

    return compiled;
  }

  function buildSource(strings) {
    let source = "";

    for (let index = 0; index < strings.length; index += 1) {
      const chunk = strings[index] || "";
      source += chunk;

      if (index >= strings.length - 1) continue;

      source += isAttributePosition(chunk)
        ? `${ATTR_MARKER}${index}${ATTR_SUFFIX}`
        : `<!--${TEXT_MARKER}${index}-->`;
    }

    return source;
  }

  function isAttributePosition(chunk) {
    return /(?:[.?@:a-zA-Z_][\w:.-]*)\s*=\s*(?:"[^"]*|'[^']*)?$/.test(chunk);
  }

  function collectChildParts(root, parts) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const value = node.nodeValue || "";

      if (!value.startsWith(TEXT_MARKER)) continue;

      parts.push({
        type: "child",
        index: Number(value.slice(TEXT_MARKER.length)),
        path: nodePath(root, node),
      });
    }
  }

  function collectAttributeParts(root, parts) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);

    while (walker.nextNode()) {
      const element = walker.currentNode;

      for (const attr of Array.from(element.attributes)) {
        const index = attrIndex(attr.value);
        if (index === -1) continue;

        parts.push({
          type: "attribute",
          index,
          name: attr.name,
          path: nodePath(root, element),
        });

        element.removeAttribute(attr.name);
      }
    }
  }

  function applyParts(fragment, parts, values) {
    const resolved = [];

    for (const part of parts) {
      const node = resolvePath(fragment, part.path);
      if (node) resolved.push({ part, node });
    }

    resolved.sort((left, right) => reverseDom(left.part.path, right.part.path));

    for (const item of resolved) {
      if (item.part.type === "child") {
        bindChild(item.node, values[item.part.index]);
      } else {
        bindAttribute(item.node, item.part.name, values[item.part.index]);
      }
    }
  }

  function bindChild(marker, value) {
    const part = createChildPart(marker);

    if (hasReactive(value)) {
      const dispose = effect(() => part.set(readValue(value)));
      registerCleanup(part.start, dispose);
      return;
    }

    part.set(value);
  }

  function createChildPart(marker) {
    const start = document.createComment(START);
    const end = document.createComment(END);
    const parent = marker.parentNode;

    let type = "empty";
    let text = "";
    let textNode = null;
    let currentNode = null;
    let controller = null;

    if (parent) {
      parent.insertBefore(start, marker);
      parent.insertBefore(end, marker);
      parent.removeChild(marker);
    }

    return {
      start,
      end,
      set(value) {
        debugState.updates += 1;

        const next = readValue(value);

        if (isDirective(next)) {
          if (!controller || controller.kind !== next.kind) {
            if (controller) controller.dispose();
            clearRange(start, end);
            controller = createDirectiveController(start, end, next);
            type = `directive:${next.kind}`;
          }

          controller.update(next);
          return;
        }

        if (controller) {
          controller.dispose();
          controller = null;
        }

        if (next == null || next === false || next === true) {
          if (type !== "empty") {
            clearRange(start, end);
            type = "empty";
            text = "";
            textNode = null;
            currentNode = null;
          }

          return;
        }

        if (Array.isArray(next)) {
          clearRange(start, end);

          for (const item of next) {
            appendValue(end.parentNode, item, end);
          }

          type = "array";
          textNode = null;
          currentNode = null;
          return;
        }

        if (isRaw(next)) {
          if (type === "raw" && text === next.value) return;

          clearRange(start, end);

          const template = document.createElement("template");
          template.innerHTML = next.value;
          appendValue(end.parentNode, template.content, end);

          type = "raw";
          text = next.value;
          textNode = null;
          currentNode = null;
          return;
        }

        if (isNode(next)) {
          if (type === "node" && currentNode === next) return;

          clearRange(start, end);
          appendValue(end.parentNode, next, end);

          type = "node";
          currentNode = next;
          textNode = null;
          return;
        }

        const nextText = String(next);

        if (type === "text" && textNode) {
          if (text !== nextText) {
            textNode.data = nextText;
            text = nextText;
          }

          return;
        }

        clearRange(start, end);
        textNode = document.createTextNode(nextText);
        appendValue(end.parentNode, textNode, end);

        type = "text";
        text = nextText;
        currentNode = textNode;
      },
    };
  }

  function bindAttribute(node, rawName, value) {
    if (!isElement(node)) return;

    if (isRef(value)) {
      const cleanup = value.callback(node);
      if (typeof cleanup === "function") registerCleanup(node, cleanup);
      return;
    }

    if (rawName.startsWith("@")) {
      bindEvent(node, rawName.slice(1), value);
      return;
    }

    if (rawName.startsWith(".")) {
      bindProperty(node, rawName.slice(1), value);
      return;
    }

    if (rawName.startsWith("?")) {
      bindBoolean(node, rawName.slice(1), value);
      return;
    }

    if (rawName.startsWith("class:")) {
      bindConditionalClass(node, rawName.slice("class:".length), value);
      return;
    }

    bindPlainAttribute(node, rawName, value);
  }

  function bindPlainAttribute(element, name, value) {
    let previous = Symbol("initial");
    let mapState = null;

    const update = () => {
      const next = readValue(value);

      if (isClassMap(next) && name === "class") {
        mapState = applyClassMap(element, next.value, mapState);
        return;
      }

      if (isStyleMap(next) && name === "style") {
        mapState = applyStyleMap(element, next.value, mapState);
        return;
      }

      if (Object.is(previous, next)) return;
      previous = next;

      if (next == null || next === false) {
        element.removeAttribute(name);
        return;
      }

      element.setAttribute(name, String(next));
    };

    const dispose = hasReactive(value) ? effect(update) : (update(), null);
    if (dispose) registerCleanup(element, dispose);
  }

  function bindProperty(element, name, value) {
    let previous = Symbol("initial");

    const update = () => {
      const next = readValue(value);
      if (Object.is(previous, next)) return;
      previous = next;
      element[name] = next;
    };

    const dispose = hasReactive(value) ? effect(update) : (update(), null);
    if (dispose) registerCleanup(element, dispose);
  }

  function bindBoolean(element, name, value) {
    let previous = null;

    const update = () => {
      const next = Boolean(readValue(value));
      if (previous === next) return;
      previous = next;

      if (next) element.setAttribute(name, "");
      else element.removeAttribute(name);
    };

    const dispose = hasReactive(value) ? effect(update) : (update(), null);
    if (dispose) registerCleanup(element, dispose);
  }

  function bindConditionalClass(element, className, value) {
    let previous = null;

    const update = () => {
      const next = Boolean(readValue(value));
      if (previous === next) return;
      previous = next;
      element.classList.toggle(className, next);
    };

    const dispose = hasReactive(value) ? effect(update) : (update(), null);
    if (dispose) registerCleanup(element, dispose);
  }

  function bindEvent(element, rawName, value) {
    const eventConfig = parseEvent(rawName);
    let previousHandler = null;

    const update = () => {
      const handler = isSignal(value) ? value() : value;

      if (previousHandler && previousHandler.original === handler) return;

      if (previousHandler) {
        element.removeEventListener(eventConfig.name, previousHandler, eventConfig.options);
        previousHandler = null;
      }

      if (typeof handler !== "function") return;

      previousHandler = function wrapped(event) {
        if (eventConfig.prevent && !eventConfig.options.passive) event.preventDefault();
        if (eventConfig.stop) event.stopPropagation();
        handler.call(element, event);
      };

      previousHandler.original = handler;
      element.addEventListener(eventConfig.name, previousHandler, eventConfig.options);
    };

    const dispose = isSignal(value) ? effect(update) : (update(), null);
    if (dispose) registerCleanup(element, dispose);

    registerCleanup(element, () => {
      if (previousHandler) {
        element.removeEventListener(eventConfig.name, previousHandler, eventConfig.options);
      }
    });
  }

  function createDirectiveController(start, end, initial) {
    if (initial.kind === "when") return createWhenController(start, end);
    if (initial.kind === "repeat") return createRepeatController(start, end);

    return {
      kind: initial.kind,
      update() {},
      dispose() {
        clearRange(start, end);
      },
    };
  }

  function createWhenController(start, end) {
    let current = null;
    let disposeEffect = null;
    let branch = "";

    return {
      kind: "when",
      update(next) {
        current = next;

        if (disposeEffect) return;

        disposeEffect = effect(() => {
          if (!current) return;

          const active = Boolean(readValue(current.condition));
          const nextBranch = active ? "truthy" : "falsy";

          if (branch === nextBranch) return;
          branch = nextBranch;

          clearRange(start, end);

          const factory = active ? current.truthy : current.falsy;
          if (factory) appendValue(end.parentNode, factory(), end);
        });

        registerCleanup(start, disposeEffect);
      },
      dispose() {
        if (disposeEffect) disposeEffect();
        disposeEffect = null;
        clearRange(start, end);
      },
    };
  }

  function createRepeatController(start, end) {
    const records = new Map();
    let current = null;
    let disposeEffect = null;
    let emptyStart = null;
    let emptyEnd = null;

    const updateList = () => {
      if (!current) return;

      const items = Array.isArray(readValue(current.items)) ? readValue(current.items) : [];
      const nextKeys = new Set();
      let cursor = start.nextSibling;

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const key = current.key(item, index);

        nextKeys.add(key);

        let record = records.get(key);

        if (!record) {
          record = createRepeatRecord(item, index, key, current.render);
          records.set(key, record);
        } else {
          batch(() => {
            record.item.set(item);
            record.index.set(index);
            record.key.set(key);
          });
        }

        if (record.fragment) {
          end.parentNode.insertBefore(record.fragment, cursor || end);
          record.fragment = null;
        } else {
          moveRangeBefore(record.start, record.end, cursor || end);
        }

        cursor = record.end.nextSibling;
      }

      for (const [key, record] of Array.from(records.entries())) {
        if (nextKeys.has(key)) continue;

        disposeRange(record.start, record.end);
        removeRange(record.start, record.end);
        records.delete(key);
      }

      if (items.length === 0 && current.empty) {
        if (!emptyStart) {
          emptyStart = document.createComment("fabrica:empty:start");
          emptyEnd = document.createComment("fabrica:empty:end");
          end.parentNode.insertBefore(emptyStart, end);
          appendValue(end.parentNode, current.empty(), end);
          end.parentNode.insertBefore(emptyEnd, end);
        }

        return;
      }

      if (emptyStart && emptyEnd) {
        disposeRange(emptyStart, emptyEnd);
        removeRange(emptyStart, emptyEnd);
        emptyStart = null;
        emptyEnd = null;
      }
    };

    return {
      kind: "repeat",
      update(next) {
        current = next;

        if (disposeEffect) return;

        disposeEffect = hasReactive(current.items) ? effect(updateList) : (updateList(), null);
        if (disposeEffect) registerCleanup(start, disposeEffect);
      },
      dispose() {
        if (disposeEffect) disposeEffect();

        for (const record of records.values()) {
          disposeRange(record.start, record.end);
        }

        records.clear();
        clearRange(start, end);
      },
    };
  }

  function createRepeatRecord(item, index, key, renderItem) {
    const start = document.createComment("fabrica:item:start");
    const end = document.createComment("fabrica:item:end");

    const ctx = {
      item: signal(item),
      index: signal(index),
      key: signal(key),
    };

    const fragment = document.createDocumentFragment();
    fragment.append(start);
    appendValue(fragment, renderItem(ctx));
    fragment.append(end);

    return { ...ctx, start, end, fragment };
  }

  function applyProps(element, props) {
    for (const key in props) {
      const value = props[key];

      if (key === "text") {
        element.textContent = stringify(readValue(value));
      } else if (key === "html" || key === "unsafeHTML") {
        element.innerHTML = stringify(readValue(value));
      } else if (key === "class" || key === "className") {
        applyClassValue(element, value);
      } else if (key === "style") {
        applyStyleValue(element, value);
      } else if (key === "attrs") {
        for (const name in value || {}) setPropOrAttr(element, name, readValue(value[name]));
      } else if (key === "dataset") {
        for (const name in value || {}) {
          const next = readValue(value[name]);
          if (next == null) delete element.dataset[name];
          else element.dataset[name] = String(next);
        }
      } else if (key === "on") {
        for (const name in value || {}) {
          element.addEventListener(name, value[name]);
        }
      } else {
        setPropOrAttr(element, key, readValue(value));
      }
    }
  }

  function applyCss(element, input, values, important) {
    const update = () => {
      const text = css(input, ...values);

      if (element.tagName === "STYLE") {
        element.textContent = important ? addImportant(text) : text;
        return;
      }

      for (const declaration of parseCssDeclarations(text)) {
        element.style.setProperty(
          declaration.name,
          declaration.value,
          important || declaration.important ? "important" : "",
        );
      }
    };

    if (values.some(hasReactive)) {
      const dispose = effect(update);
      registerCleanup(element, dispose);
    } else {
      update();
    }
  }

  function applyClassValue(element, value) {
    const next = readValue(value);

    if (Array.isArray(next)) {
      element.className = next.filter(Boolean).join(" ");
      return;
    }

    if (isPlainObject(next)) {
      applyClassMap(element, next, null);
      return;
    }

    if (next == null || next === false) {
      element.removeAttribute("class");
      return;
    }

    element.className = String(next);
  }

  function applyStyleValue(element, value) {
    const next = readValue(value);

    if (isPlainObject(next)) {
      applyStyleMap(element, next, null);
      return;
    }

    if (typeof next === "string") {
      for (const declaration of parseCssDeclarations(next)) {
        element.style.setProperty(
          declaration.name,
          declaration.value,
          declaration.important ? "important" : "",
        );
      }
    }
  }

  function applyClassMap(element, map, state) {
    const previous = state?.keys || new Set();
    const next = new Set(Object.keys(map));

    for (const className of previous) {
      if (!next.has(className)) element.classList.remove(className);
    }

    for (const className of next) {
      element.classList.toggle(className, Boolean(readValue(map[className])));
    }

    return { keys: next };
  }

  function applyStyleMap(element, map, state) {
    const previous = state?.keys || new Set();
    const next = new Set(Object.keys(map));

    for (const property of previous) {
      if (!next.has(property)) element.style.removeProperty(kebab(property));
    }

    for (const property of next) {
      const value = readValue(map[property]);
      const name = kebab(property);

      if (value == null || value === false) element.style.removeProperty(name);
      else element.style.setProperty(name, String(value));
    }

    return { keys: next };
  }

  function setPropOrAttr(element, name, value) {
    if (value == null || value === false) {
      element.removeAttribute(name);
      if (name in element && typeof element[name] === "boolean") element[name] = false;
      return;
    }

    if (value === true) {
      element.setAttribute(name, "");
      if (name in element && typeof element[name] === "boolean") element[name] = true;
      return;
    }

    if (!name.startsWith("data-") && !name.startsWith("aria-") && name in element) {
      try {
        element[name] = value;
        return;
      } catch {
        element.setAttribute(name, String(value));
        return;
      }
    }

    element.setAttribute(name, String(value));
  }

  function install(options = {}) {
    Object.assign(config, options);

    globalThis.Fabrica = api;

    if (config.exposeDollar && (config.forceAlias || !globalThis.$)) {
      globalThis.$ = $;
    }

    const alias = config.dollarAlias || "$el";

    if (config.exposeDollarEl && (config.forceAlias || !globalThis[alias])) {
      globalThis[alias] = $;
    }

    return api;
  }

  function noConflict() {
    if (globalThis.$ === $) globalThis.$ = previousDollar;
    if (globalThis.$el === $) globalThis.$el = previousDollarEl;
    return api;
  }

  function debug() {
    return Object.freeze({ ...debugState });
  }

  function setDebug(enabled) {
    debugState.enabled = Boolean(enabled);
  }

  function directive(value) {
    Object.defineProperty(value, DIRECTIVE, { value: true });
    return value;
  }

  function cleanupEffect(runner) {
    for (const cleanup of runner.cleanups.splice(0)) cleanup();

    for (const dep of runner.deps) dep.delete(runner);
    runner.deps.length = 0;
  }

  function scheduleEffect(runner) {
    if (runner.disposed) return;
    if (runner.sync) {
      runner();
      return;
    }

    effectQueue.add(runner);

    if (batchDepth === 0) queueFlush();
  }

  function queueFlush() {
    if (flushQueued) return;
    flushQueued = true;
    queueMicrotask(flushEffects);
  }

  function flushEffects() {
    flushQueued = false;
    debugState.flushes += 1;

    for (const runner of Array.from(effectQueue)) {
      effectQueue.delete(runner);
      runner();
    }

    if (effectQueue.size > 0 && batchDepth === 0) queueFlush();
  }

  function registerCleanup(node, cleanup) {
    const cleanups = cleanupMap.get(node) || [];
    cleanups.push(cleanup);
    cleanupMap.set(node, cleanups);
  }

  function disposeTree(node) {
    const cleanups = cleanupMap.get(node);

    if (cleanups) {
      for (const cleanup of cleanups.splice(0)) cleanup();
      cleanupMap.delete(node);
    }

    for (const child of Array.from(node.childNodes || [])) {
      disposeTree(child);
    }
  }

  function disposeRange(start, end) {
    let current = start;

    while (current) {
      disposeTree(current);
      if (current === end) break;
      current = current.nextSibling;
    }
  }

  function clearRange(start, end) {
    let current = start.nextSibling;

    while (current && current !== end) {
      const next = current.nextSibling;
      disposeTree(current);
      current.parentNode?.removeChild(current);
      current = next;
    }
  }

  function removeRange(start, end) {
    let current = start;

    while (current) {
      const next = current.nextSibling;
      current.parentNode?.removeChild(current);
      if (current === end) break;
      current = next;
    }
  }

  function moveRangeBefore(start, end, before) {
    const parent = before.parentNode;
    if (!parent || start === before || end.nextSibling === before) return;

    const fragment = document.createDocumentFragment();
    let current = start;

    while (current) {
      const next = current.nextSibling;
      fragment.append(current);
      if (current === end) break;
      current = next;
    }

    parent.insertBefore(fragment, before);
  }

  function appendValue(parent, value, before = null) {
    if (!parent) return;

    const next = readValue(value);

    if (next == null || next === false || next === true) return;

    if (isBag(next)) {
      for (const element of next.elements) parent.insertBefore(element, before);
      return;
    }

    if (Array.isArray(next)) {
      for (const item of next) appendValue(parent, item, before);
      return;
    }

    if (isRaw(next)) {
      const template = document.createElement("template");
      template.innerHTML = next.value;
      parent.insertBefore(template.content, before);
      return;
    }

    if (isNode(next)) {
      parent.insertBefore(next, before);
      return;
    }

    parent.insertBefore(document.createTextNode(String(next)), before);
  }

  function readValue(value) {
    if (isSignal(value)) return value();

    if (Array.isArray(value) || isRaw(value) || isDirective(value) || isNode(value) || isComponent(value)) {
      return value;
    }

    if (typeof value === "function") return value();

    return value;
  }

  function hasReactive(value) {
    if (isSignal(value)) return true;
    if (typeof value === "function" && !isComponent(value)) return true;

    if (isClassMap(value) || isStyleMap(value)) {
      return Object.values(value.value).some(hasReactive);
    }

    return false;
  }

  function nodePath(root, node) {
    const path = [];
    let current = node;

    while (current && current !== root) {
      const parent = current.parentNode;
      if (!parent) break;

      path.push(Array.prototype.indexOf.call(parent.childNodes, current));
      current = parent;
    }

    return path.reverse();
  }

  function resolvePath(root, path) {
    let current = root;

    for (const index of path) {
      current = current.childNodes[index];
      if (!current) return null;
    }

    return current;
  }

  function reverseDom(left, right) {
    const length = Math.max(left.length, right.length);

    for (let index = 0; index < length; index += 1) {
      const a = left[index] ?? -1;
      const b = right[index] ?? -1;
      if (a !== b) return b - a;
    }

    return right.length - left.length;
  }

  function attrIndex(value) {
    const start = value.indexOf(ATTR_MARKER);
    if (start === -1) return -1;

    return Number(value.slice(start + ATTR_MARKER.length).split(ATTR_SUFFIX)[0]);
  }

  function parseEvent(raw) {
    const parts = raw.split(".");
    const name = parts.shift() || raw;
    const modifiers = new Set(parts);

    return {
      name,
      prevent: modifiers.has("prevent"),
      stop: modifiers.has("stop"),
      options: {
        once: modifiers.has("once"),
        passive: modifiers.has("passive"),
        capture: modifiers.has("capture"),
      },
    };
  }

  function parseCssDeclarations(text) {
    return String(text)
      .split(";")
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const index = chunk.indexOf(":");
        const name = chunk.slice(0, index).trim();
        let value = chunk.slice(index + 1).trim();
        const important = /\s*!important\s*$/i.test(value);
        value = value.replace(/\s*!important\s*$/i, "").trim();
        return { name, value, important };
      })
      .filter((item) => item.name && item.value);
  }

  function addImportant(text) {
    return String(text).replace(/:\s*([^;{}]+)(;?)/g, (_match, value, semicolon) => {
      if (/\s*!important\s*$/i.test(value)) return `: ${value.trim()}${semicolon || ";"}`;
      return `: ${value.trim()} !important${semicolon || ";"}`;
    });
  }

  function resolveElements(target, root) {
    if (typeof target === "string") {
      if (/^<[^<>]+>$/.test(target.trim())) {
        return [createElement(target.slice(1, -1))];
      }

      const found = Array.from(root.querySelectorAll(target)).filter(isElement);

      if (found.length || !config.createWhenSelectorMisses || !/^[a-zA-Z][\w-]*(?:#[\w-]+)?(?:\.[\w-]+)*$/.test(target)) {
        return found;
      }

      return [createElement(target)];
    }

    if (isElement(target)) return [target];

    if (target && typeof target.length === "number") {
      return Array.from(target).filter(isElement);
    }

    return [];
  }

  function createElement(expression) {
    const source = String(expression).trim().replace(/^<|>$/g, "");
    const tag = (source.match(/^[a-zA-Z][\w-]*/) || ["div"])[0];
    const element = document.createElement(tag);
    const id = source.match(/#([\w-]+)/);

    if (id) element.id = id[1];

    for (const match of source.matchAll(/\.([\w-]+)/g)) {
      element.classList.add(match[1]);
    }

    return element;
  }

  function getShadowRoot(element) {
    return element.shadowRoot || element.attachShadow({ mode: "open" });
  }

  function isSignal(value) {
    return (
      typeof value === "function" &&
      typeof value.set === "function" &&
      typeof value.update === "function" &&
      typeof value.peek === "function" &&
      typeof value.subscribe === "function"
    );
  }

  function isComponent(value) {
    return Boolean(value && typeof value === "function" && value[COMPONENT]);
  }

  function isDirective(value) {
    return Boolean(value && typeof value === "object" && value[DIRECTIVE]);
  }

  function isRef(value) {
    return isDirective(value) && value.kind === "ref";
  }

  function isClassMap(value) {
    return isDirective(value) && value.kind === "classMap";
  }

  function isStyleMap(value) {
    return isDirective(value) && value.kind === "styleMap";
  }

  function isRaw(value) {
    return Boolean(value && typeof value === "object" && value[RAW]);
  }

  function isNode(value) {
    return Boolean(value && typeof value === "object" && typeof value.nodeType === "number");
  }

  function isElement(value) {
    return Boolean(value && typeof value === "object" && value.nodeType === 1 && typeof value.tagName === "string");
  }

  function isBag(value) {
    return Boolean(value && typeof value === "function" && value.$$fabricaBag);
  }

  function isPlainObject(value) {
    return Boolean(value && typeof value === "object" && value.constructor === Object);
  }

  function isTemplateStrings(value) {
    return Array.isArray(value) && "raw" in value;
  }

  function kebab(value) {
    return String(value).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  }

  function stringify(value) {
    return value == null ? "" : String(value);
  }

  const api = Object.freeze({
    html,
    render,
    mount,
    component,
    signal,
    effect,
    onCleanup,
    computed,
    memo,
    untrack,
    batch,
    when,
    repeat,
    ref,
    classMap,
    styleMap,
    css,
    $,
    config,
    install,
    noConflict,
    setDebug,
    debug,
  });

  install();

  return api;
})();

globalThis.Fabrica = Fabrica;
