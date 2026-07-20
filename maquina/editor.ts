import { createDeepStore } from "@rodkisten/broto";
import {
  event,
  html,
  maquinaFabrica,
  ref,
} from "@rodkisten/maquina/components";
import { resolveMaquinaTheme } from "@rodkisten/maquina/theme";
import { tokenizeMaquina } from "@rodkisten/maquina/tokenizer";
import type {
  MaquinaCompletionContext,
  MaquinaCompletionItem,
  MaquinaCompletionMatch,
  MaquinaHandle,
  MaquinaLanguage,
  MaquinaOptions,
  MaquinaThemeName,
} from "@rodkisten/maquina/types";

const MAX_COMPLETIONS = 100;
const DEFAULT_TAB_SIZE = 2;
const DEFAULT_FONT_SIZE = 16;
const MIN_FONT_SCALE = 0.5;
const MAX_FONT_SCALE = 2;
const MIN_TAB_SIZE = 1;
const MAX_TAB_SIZE = 16;
const SUGGESTIONS_BLUR_DELAY_MS = 80;
const MAX_RUNTIME_PROTOTYPE_DEPTH = 16;

interface EditorState extends Record<string, unknown> {
  value: string;
  language: MaquinaLanguage;
  theme: MaquinaThemeName;
  suggestions: MaquinaCompletionItem[];
  suggestionFrom: number;
  activeSuggestion: number;
  open: boolean;
}

interface CaretMeasurement {
  readonly left: number;
  readonly top: number;
  readonly height: number;
}

interface CompletionResultLike {
  readonly from: number;
  readonly options: readonly MaquinaCompletionItem[];
}

interface RuntimeCompletionResult extends CompletionResultLike {
  readonly memberAccess: boolean;
}

type Dispose = () => void;

/**
 * Mounts a Maquina editor into the provided parent.
 *
 * The editor shell, token highlights, suggestion items, refs, and event
 * handlers are all rendered through Fabrica. Direct DOM access is
 * intentionally limited to browser-specific mutable state such as textarea
 * selection and scrolling.
 */
export function mountMaquina(options: MaquinaOptions): MaquinaHandle {
  const initialTheme = resolveMaquinaTheme(options.theme, options.dark);

  const state = createDeepStore<EditorState>({
    value: options.value,
    language: (options.language ?? "text") as MaquinaLanguage,
    theme: initialTheme.name as MaquinaThemeName,
    suggestions: [] as MaquinaCompletionItem[],
    suggestionFrom: 0,
    activeSuggestion: 0,
    open: false,
  } satisfies EditorState);

  let rootRef: HTMLElement | null = null;
  let textareaRef: HTMLTextAreaElement | null = null;
  let highlightRef: HTMLElement | null = null;
  let suggestionsRef: HTMLElement | null = null;

  let caretMirrorRef: HTMLDivElement | null = null;
  let caretMarkerRef: HTMLSpanElement | null = null;

  let disposeHighlightContent: Dispose | undefined;
  let disposeSuggestionsContent: Dispose | undefined;

  let blurTimer: number | undefined;
  let completionVersion = 0;
  let destroyed = false;

  /*
   * Event handlers use function declarations intentionally. They can be safely
   * referenced by the Fabrica template before the mounted refs are normalized
   * into the non-null local constants below.
   */

  function onInput(): void {
    if (destroyed) return;

    const textarea = textareaRef;

    if (!textarea) return;

    const value = textarea.value;

    if (state.value.peek() !== value) {
      state.value.set(value);
      options.onChange?.(value);
    }

    renderHighlight();

    if (options.activateCompletionOnTyping !== false) {
      void requestCompletions();
    }
  }

  function onScroll(): void {
    syncScroll();

    if (state.open.peek()) {
      positionSuggestions();
    }
  }

  function onFocus(): void {
    if (blurTimer !== undefined) {
      window.clearTimeout(blurTimer);
      blurTimer = undefined;
    }

    options.onFocus?.();
  }

  function onBlur(): void {
    if (blurTimer !== undefined) {
      window.clearTimeout(blurTimer);
    }

    /*
     * Pointer selection starts by blurring the textarea. Delaying the close
     * gives a suggestion's pointerdown handler time to apply the completion.
     */
    blurTimer = window.setTimeout(() => {
      blurTimer = undefined;
      closeSuggestions();
    }, SUGGESTIONS_BLUR_DELAY_MS);

    options.onBlur?.();
  }

  function onClick(): void {
    if (options.activateCompletionOnTyping === false) return;

    void requestCompletions();
  }

  function onKeyUp(keyboardEvent: KeyboardEvent): void {
    if (options.activateCompletionOnTyping === false) return;

    /*
     * Regular typing is already handled by the input event. Only request again
     * when the keyboard changed the cursor without changing the textarea value.
     * This avoids issuing two completion requests for every typed character.
     */
    switch (keyboardEvent.key) {
      case "ArrowLeft":
      case "ArrowRight":
      case "ArrowUp":
      case "ArrowDown":
      case "Home":
      case "End":
      case "PageUp":
      case "PageDown":
        void requestCompletions();
        break;
    }
  }

  function onKeyDown(keyboardEvent: KeyboardEvent): void {
    if (destroyed) return;

    if (state.open.peek()) {
      const items = state.suggestions.peek();

      if (
        items.length > 0 &&
        (keyboardEvent.key === "ArrowDown" ||
          keyboardEvent.key === "ArrowUp")
      ) {
        keyboardEvent.preventDefault();

        const delta = keyboardEvent.key === "ArrowDown" ? 1 : -1;
        const current = state.activeSuggestion.peek();
        const next = (current + delta + items.length) % items.length;

        state.activeSuggestion.set(next);
        renderSuggestions();
        return;
      }

      if (
        items.length > 0 &&
        (keyboardEvent.key === "Tab" ||
          keyboardEvent.key === "Enter")
      ) {
        keyboardEvent.preventDefault();
        applySuggestion(state.activeSuggestion.peek());
        return;
      }

      if (keyboardEvent.key === "Escape") {
        keyboardEvent.preventDefault();
        closeSuggestions();
        return;
      }
    }

    if (
      (keyboardEvent.metaKey || keyboardEvent.ctrlKey) &&
      keyboardEvent.key === "Enter"
    ) {
      keyboardEvent.preventDefault();
      options.onRun?.();
      return;
    }

    if (
      keyboardEvent.key === "Enter" &&
      !keyboardEvent.shiftKey &&
      options.onRun
    ) {
      keyboardEvent.preventDefault();
      options.onRun();
      return;
    }

    if (keyboardEvent.key === "Tab" && !options.readOnly) {
      keyboardEvent.preventDefault();

      const indent = " ".repeat(
        clamp(
          options.tabSize ?? DEFAULT_TAB_SIZE,
          MIN_TAB_SIZE,
          MAX_TAB_SIZE,
        ),
      );

      const textarea = textareaRef;

      if (!textarea) return;

      textarea.setRangeText(
        indent,
        textarea.selectionStart,
        textarea.selectionEnd,
        "end",
      );

      onInput();
    }
  }

  const disposeEditor = maquinaFabrica.render(
    options.parent,
    html`
      <MaquinaRoot
        ref=${ref<HTMLElement>((node) => {
          rootRef = node;
        })}
        data-theme=${initialTheme.name}
      >
        <MaquinaViewport>
          <MaquinaHighlight
            aria-hidden="true"
            ref=${ref<HTMLElement>((node) => {
              highlightRef = node;
            })}
          ></MaquinaHighlight>

          <MaquinaInput
            ref=${ref<HTMLTextAreaElement>((node) => {
              textareaRef = node;
            })}
            .value=${options.value}
            .placeholder=${options.placeholder ?? ""}
            aria-label=${options.ariaLabel ?? "Code editor"}
            .spellcheck="false"
            .autocapitalize="off"
            .autocomplete="off"
            .autocorrect="off"
            .inputmode="text"
            .wrap=${options.lineWrapping === false ? "off" : "soft"}
            :gramm="false"
            :gramm_editor="false"
            :enable-grammarly="false"
            :ms-editor="false"
            ?readonly=${options.readOnly === true}
            @input=${event.input(onInput)}
            @scroll=${event.scroll(onScroll)}
            @keydown=${event.keydown(onKeyDown)}
            @keyup=${event.keyup(onKeyUp)}
            @click=${event.click(onClick)}
            @focus=${event.focus(onFocus)}
            @blur=${event.blur(onBlur)}
          />
          <MaquinaSuggestions
            hidden
            role="listbox"
            ref=${ref<HTMLElement>((node) => {
              suggestionsRef = node;
            })}
          ></MaquinaSuggestions>
        </MaquinaViewport>
      </MaquinaRoot>
    `,
  );

  /*
   * Normalize callback refs once after the synchronous Fabrica mount.
   *
   * Keeping these as stable non-null references makes every hot-path function
   * simpler and avoids repeated optional checks after successful mounting.
   */
  const editorRoot = rootRef as HTMLElement | null;
  const editorTextarea = textareaRef as HTMLTextAreaElement | null;
  const editorHighlight = highlightRef as HTMLElement | null;
  const editorSuggestions = suggestionsRef as HTMLElement | null;

  if (
    !editorRoot ||
    !editorTextarea ||
    !editorHighlight ||
    !editorSuggestions
  ) {
    disposeEditor();
    throw new Error("[Maquina] Editor failed to mount");
  }

  /*
   * Callback refs are guaranteed by the synchronous Fabrica mount above.
   * Copy the narrowed values into immutable aliases so nested hot-path
   * closures retain their non-null types without repeated runtime guards.
   */
  const mountedRoot = editorRoot;
  const mountedTextarea = editorTextarea;
  const mountedHighlight = editorHighlight;
  const mountedSuggestions = editorSuggestions;

  /*
   * Explicitly mirror the initial value because consumers may query getValue()
   * immediately after mounting, before any browser painting occurs.
   */
  mountedTextarea.value = options.value;
  mountedTextarea.setSelectionRange(
    options.value.length,
    options.value.length,
  );

  applyTheme(mountedRoot, initialTheme.name);
  applyEditorMetrics(
    mountedRoot,
    mountedTextarea,
    mountedHighlight,
    options,
  );

  renderHighlight();
  syncScroll();

  /**
   * Re-renders syntax highlighting through Fabrica.
   *
   * The previous Fabrica subtree is disposed before mounting the next one,
   * preventing retained bindings when the editor updates frequently.
   */
  function renderHighlight(): void {
    if (destroyed) return;

    const value = state.value.peek();
    const language = state.language.peek();
    const tokens = tokenizeMaquina(value, language);

    disposeHighlightContent?.();
    disposeHighlightContent = undefined;

    mountedHighlight.replaceChildren();

    disposeHighlightContent = maquinaFabrica.render(
      mountedHighlight,
      html`
        ${tokens.map(
          (token) => html`
            <span :token=${token.kind}>${token.value}</span>
          `,
        )}
        ${value.endsWith("\n") ? "\n" : ""}
      `,
    );
  }

  /**
   * Keeps the visual highlight layer aligned with the native textarea.
   *
   * The textarea remains the source of truth for scrolling while the highlight
   * layer is translated instead of independently scrolling.
   */
  function syncScroll(): void {
    if (destroyed) return;

    mountedHighlight.style.transform =
      `translate(${-mountedTextarea.scrollLeft}px, ` +
      `${-mountedTextarea.scrollTop}px)`;
  }

  /**
   * Closes completion UI and optionally invalidates pending asynchronous
   * completion requests.
   */
  function closeSuggestions(invalidatePending = true): void {
    if (invalidatePending) {
      completionVersion += 1;
    }

    if (
      state.open.peek() ||
      state.suggestions.peek().length > 0 ||
      state.activeSuggestion.peek() !== 0
    ) {
      state.patch(
        {
          open: false,
          suggestions: [],
          activeSuggestion: 0,
        },
        {
          cause: "maquina:close-completions",
        },
      );
    }

    disposeSuggestionsContent?.();
    disposeSuggestionsContent = undefined;

    mountedSuggestions.replaceChildren();
    mountedSuggestions.hidden = true;
  }

  /**
   * Renders the completion popup through Fabrica.
   *
   * Pointer handlers live inside the template so their lifecycle is tied to
   * the rendered suggestion subtree rather than manually managed DOM
   * listeners.
   */
  function renderSuggestions(): void {
    if (destroyed) return;

    const items = state.suggestions.peek();

    if (!state.open.peek() || items.length === 0) {
      mountedSuggestions.hidden = true;
      return;
    }

    const activeSuggestion = state.activeSuggestion.peek();

    disposeSuggestionsContent?.();
    disposeSuggestionsContent = undefined;

    mountedSuggestions.replaceChildren();

    disposeSuggestionsContent = maquinaFabrica.render(
      mountedSuggestions,
      html`
        ${items.map((item, index) => {
          const active = index === activeSuggestion;

          return html`
            <button
              type="button"
              role="option"
              :active=${active}
              aria-selected=${String(active)}
              @pointerdown=${event.pointerdown((pointerEvent) => {
                /*
                 * Prevent textarea blur from winning the race against applying
                 * the selected completion.
                 */
                pointerEvent.preventDefault();
                applySuggestion(index);
              })}
            >
              <span>${item.label}</span>
              <small>${item.detail || item.type || ""}</small>
            </button>
          `;
        })}
      `,
    );

    mountedSuggestions.hidden = false;

    positionSuggestions();
  }

  /**
   * Positions the completion popup beside the real native textarea caret.
   *
   * A hidden layout mirror is used instead of estimating column width. This
   * stays accurate with tabs, wrapping, custom fonts, letter spacing, zoom,
   * scrolling, and other text metrics that invalidate character-based math.
   */
  function positionSuggestions(): void {
    if (
      destroyed ||
      mountedSuggestions.hidden
    ) {
      return;
    }

    const measurement = measureCaretPosition();

    const offsetParent =
      mountedSuggestions.offsetParent as HTMLElement | null;

    const container =
      offsetParent ??
      mountedRoot;

    const popupWidth =
      mountedSuggestions.offsetWidth ||
      230;

    const popupHeight =
      mountedSuggestions.offsetHeight ||
      180;

    const maxLeft = Math.max(
      8,
      container.clientWidth -
        popupWidth -
        8,
    );

    const maxTop = Math.max(
      8,
      container.clientHeight -
        popupHeight -
        8,
    );

    const desiredLeft =
      measurement.left;

    const desiredTop =
      measurement.top +
      measurement.height +
      4;

    mountedSuggestions.style.left =
      `${clamp(
        desiredLeft,
        8,
        maxLeft,
      )}px`;

    mountedSuggestions.style.top =
      `${clamp(
        desiredTop,
        8,
        maxTop,
      )}px`;
  }

  /**
   * Measures the actual textarea caret position using a hidden text mirror.
   */
  function measureCaretPosition(): CaretMeasurement {
    const textarea =
      mountedTextarea;

    const documentRef =
      textarea.ownerDocument;

    let mirror =
      caretMirrorRef;

    let marker =
      caretMarkerRef;

    if (!mirror) {
      mirror =
        documentRef.createElement("div");

      mirror.setAttribute(
        "aria-hidden",
        "true",
      );

      mirror.style.position = "absolute";
      mirror.style.left = "-100000px";
      mirror.style.top = "0";
      mirror.style.visibility = "hidden";
      mirror.style.pointerEvents = "none";
      mirror.style.overflow = "hidden";

      mountedRoot.append(mirror);

      caretMirrorRef = mirror;
    }

    if (!marker) {
      marker =
        documentRef.createElement("span");

      marker.style.display =
        "inline-block";

      marker.style.width = "0";
      marker.style.padding = "0";
      marker.style.margin = "0";
      marker.style.border = "0";
      marker.style.overflow = "hidden";

      caretMarkerRef = marker;
    }

    const view =
      documentRef.defaultView ??
      window;

    const computedStyle =
      view.getComputedStyle(textarea);

    copyTextareaMetrics(
      mirror,
      computedStyle,
    );

    const beforeCursor =
      textarea.value.slice(
        0,
        textarea.selectionStart,
      );

    /*
     * The zero-width marker stays measurable after a trailing newline without
     * adding visible layout width to the mirrored content.
     */
    marker.textContent = "\u200b";

    mirror.replaceChildren(
      documentRef.createTextNode(
        beforeCursor,
      ),
      marker,
    );

    const offsetParent =
      mountedSuggestions.offsetParent as HTMLElement | null;

    const container =
      offsetParent ??
      mountedRoot;

    const textareaOffset =
      getOffsetWithin(
        textarea,
        container,
      );

    const parsedLineHeight =
      Number.parseFloat(
        computedStyle.lineHeight,
      );

    const parsedFontSize =
      Number.parseFloat(
        computedStyle.fontSize,
      );

    const fontSize =
      Number.isFinite(parsedFontSize)
        ? parsedFontSize
        : DEFAULT_FONT_SIZE;

    const lineHeight =
      Number.isFinite(parsedLineHeight)
        ? parsedLineHeight
        : fontSize * 1.55;

    return {
      left:
        textareaOffset.left +
        marker.offsetLeft -
        textarea.scrollLeft,

      top:
        textareaOffset.top +
        marker.offsetTop -
        textarea.scrollTop,

      height: lineHeight,
    };
  }

  /**
   * Requests provider and browser-runtime completions.
   *
   * Older asynchronous requests are ignored instead of overwriting a newer
   * result. Runtime completion is available even when no external provider is
   * configured.
   */
  async function requestCompletions(): Promise<void> {
    if (
      destroyed ||
      options.readOnly
    ) {
      return;
    }

    const language =
      state.language.peek();

    const supportsRuntime =
      supportsRuntimeCompletions(
        language,
      );

    if (
      !options.completions &&
      !supportsRuntime
    ) {
      return;
    }

    const version =
      ++completionVersion;

    const cursor =
      mountedTextarea.selectionStart;

    const value =
      mountedTextarea.value;

    const context =
      createCompletionContext(
        value,
        cursor,
      );

    try {
      const externalResult =
        options.completions
          ? await options.completions(
              context,
            )
          : null;

      if (
        destroyed ||
        version !== completionVersion
      ) {
        return;
      }

      const runtimeRoot =
        mountedTextarea.ownerDocument.defaultView ??
        window;

      const runtimeResult =
        supportsRuntime
          ? createRuntimeCompletionResult(
              value,
              cursor,
              runtimeRoot,
            )
          : null;

      const result =
        resolveCompletionResult(
          externalResult,
          runtimeResult,
        );

      if (!result?.options.length) {
        closeSuggestions(false);
        return;
      }

      const suggestionFrom = clamp(
        result.from,
        0,
        cursor,
      );

      state.patch(
        {
          suggestions:
            result.options.slice(
              0,
              MAX_COMPLETIONS,
            ),
          suggestionFrom,
          activeSuggestion: 0,
          open: true,
        },
        {
          cause: "maquina:completions",
        },
      );

      renderSuggestions();
    } catch {
      /*
       * Completion providers are optional extensions. A provider failure
       * should not break editing or surface an unhandled promise rejection.
       */
      if (
        !destroyed &&
        version === completionVersion
      ) {
        closeSuggestions(false);
      }
    }
  }

  /**
   * Applies the selected completion through the native textarea API.
   *
   * setRangeText preserves browser-native selection semantics while avoiding
   * manual string slicing and cursor calculations.
   */
  function applySuggestion(index: number): void {
    if (destroyed) return;

    const item =
      state.suggestions.peek()[index];

    if (!item) return;

    const from = clamp(
      state.suggestionFrom.peek(),
      0,
      mountedTextarea.selectionStart,
    );

    const to =
      mountedTextarea.selectionStart;

    const insert =
      item.apply ??
      item.label;

    mountedTextarea.setRangeText(
      insert,
      from,
      to,
      "end",
    );

    const value =
      mountedTextarea.value;

    state.value.set(value);
    options.onChange?.(value);

    renderHighlight();
    closeSuggestions();
    syncScroll();

    mountedTextarea.focus();
  }

  return {
    getValue(): string {
      return destroyed
        ? state.value.peek()
        : mountedTextarea.value;
    },

    setValue(value: string): void {
      if (
        destroyed ||
        mountedTextarea.value === value
      ) {
        return;
      }

      completionVersion += 1;

      mountedTextarea.value = value;
      state.value.set(value);

      closeSuggestions(false);
      renderHighlight();
      syncScroll();
    },

    focus(): void {
      if (!destroyed) {
        mountedTextarea.focus();
      }
    },

    run(): void {
      if (!destroyed) {
        options.onRun?.();
      }
    },

    setLanguage(
      language: MaquinaLanguage,
    ): void {
      if (
        destroyed ||
        state.language.peek() === language
      ) {
        return;
      }

      state.language.set(language);
      closeSuggestions();
      renderHighlight();
    },

    setTheme(
      nextTheme: MaquinaThemeName,
    ): void {
      if (destroyed) return;

      const resolvedTheme =
        resolveMaquinaTheme(
          nextTheme,
          undefined,
        );

      state.theme.set(
        resolvedTheme.name,
      );

      applyTheme(
        mountedRoot,
        resolvedTheme.name,
      );
    },

    destroy(): void {
      if (destroyed) return;

      destroyed = true;
      completionVersion += 1;

      if (blurTimer !== undefined) {
        window.clearTimeout(blurTimer);
        blurTimer = undefined;
      }

      disposeHighlightContent?.();
      disposeSuggestionsContent?.();

      disposeHighlightContent =
        undefined;

      disposeSuggestionsContent =
        undefined;

      caretMirrorRef?.remove();

      caretMirrorRef = null;
      caretMarkerRef = null;

      /*
       * Fabrica owns the editor subtree and its declarative event bindings.
       * Disposing it is enough; clearing the entire parent would incorrectly
       * remove unrelated siblings mounted by the consumer.
       */
      disposeEditor();
    },
  };
}

/**
 * Creates the lightweight context exposed to completion providers.
 */
function createCompletionContext(
  value: string,
  cursor: number,
): MaquinaCompletionContext {
  return {
    value,
    cursor,

    matchBefore(
      pattern: RegExp,
    ): MaquinaCompletionMatch | null {
      const prefix =
        value.slice(
          0,
          cursor,
        );

      /*
       * Global and sticky expressions carry positional state that conflicts
       * with matching strictly against the suffix immediately before cursor.
       */
      const flags =
        pattern.flags.replace(
          /[gy]/g,
          "",
        );

      const anchored =
        new RegExp(
          `(?:${pattern.source})$`,
          flags,
        );

      const match =
        anchored.exec(prefix);

      if (!match) return null;

      return {
        from:
          cursor -
          match[0].length,

        text: match[0],
      };
    },
  };
}

/**
 * Returns whether the current language supports browser-runtime completion.
 */
function supportsRuntimeCompletions(
  language: MaquinaLanguage,
): boolean {
  switch (
    String(language).toLowerCase()
  ) {
    case "javascript":
    case "typescript":
    case "jsx":
    case "tsx":
    case "js":
    case "ts":
      return true;

    default:
      return false;
  }
}

/**
 * Creates completions for identifiers and dotted browser-runtime expressions.
 *
 * Examples:
 *
 * window.
 * window.location.
 * document.
 * document.body.
 * myPageObject.
 */
function createRuntimeCompletionResult(
  value: string,
  cursor: number,
  runtimeRoot: Window,
): RuntimeCompletionResult | null {
  const prefix =
    value.slice(
      0,
      cursor,
    );

  const memberMatch =
    /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.([\w$]*)$/
      .exec(prefix);

  if (memberMatch) {
    const expression =
      memberMatch[1];

    const propertyPrefix =
      memberMatch[2] ??
      "";

    const target =
      resolveRuntimeTarget(
        runtimeRoot,
        expression,
      );

    if (
      target === null ||
      target === undefined
    ) {
      return null;
    }

    return {
      from:
        cursor -
        propertyPrefix.length,

      options:
        createRuntimeCompletionItems(
          target,
          propertyPrefix,
        ),

      memberAccess: true,
    };
  }

  const identifierMatch =
    /[A-Za-z_$][\w$]*$/.exec(
      prefix,
    );

  if (!identifierMatch) {
    return null;
  }

  const identifier =
    identifierMatch[0];

  return {
    from:
      cursor -
      identifier.length,

    options:
      createRuntimeCompletionItems(
        runtimeRoot,
        identifier,
      ),

    memberAccess: false,
  };
}

/**
 * Resolves a simple dotted property path against the page global object.
 *
 * Arbitrary JavaScript is deliberately not evaluated. This keeps completion
 * predictable and prevents typing from executing user or page expressions.
 */
function resolveRuntimeTarget(
  runtimeRoot: Window,
  expression: string,
): unknown {
  const segments =
    expression.split(".");

  let current: unknown =
    runtimeRoot;

  let index = 0;

  switch (segments[0]) {
    case "window":
    case "self":
    case "globalThis":
    case "this":
      index = 1;
      break;
  }

  for (
    ;
    index < segments.length;
    index += 1
  ) {
    const segment =
      segments[index];

    if (
      !segment ||
      current === null ||
      current === undefined
    ) {
      return undefined;
    }

    try {
      current =
        Reflect.get(
          Object(current),
          segment,
        );
    } catch {
      return undefined;
    }
  }

  return current;
}

/**
 * Enumerates own and inherited runtime properties without eagerly evaluating
 * getters.
 */
function createRuntimeCompletionItems(
  target: unknown,
  prefix: string,
): MaquinaCompletionItem[] {
  const names =
    collectRuntimePropertyNames(
      target,
    );

  const items:
    MaquinaCompletionItem[] = [];

  for (const name of names) {
    if (
      !name.startsWith(prefix)
    ) {
      continue;
    }

    items.push({
      label: name,
      type:
        getRuntimePropertyType(
          target,
          name,
        ),
      detail: "runtime",
    });

    if (
      items.length >=
      MAX_COMPLETIONS
    ) {
      break;
    }
  }

  return items;
}

/**
 * Collects JavaScript identifier-like properties across the prototype chain.
 */
function collectRuntimePropertyNames(
  target: unknown,
): string[] {
  if (
    target === null ||
    target === undefined
  ) {
    return [];
  }

  const names =
    new Set<string>();

  let current: object | null =
    Object(target);

  let depth = 0;

  while (
    current &&
    depth < MAX_RUNTIME_PROTOTYPE_DEPTH
  ) {
    try {
      for (
        const name of
        Object.getOwnPropertyNames(
          current,
        )
      ) {
        if (
          /^[A-Za-z_$][\w$]*$/.test(
            name,
          )
        ) {
          names.add(name);
        }
      }

      current =
        Object.getPrototypeOf(
          current,
        );
    } catch {
      break;
    }

    depth += 1;
  }

  return Array
    .from(names)
    .sort(
      (left, right) =>
        left.localeCompare(
          right,
        ),
    );
}

/**
 * Describes a runtime property without invoking accessor getters.
 */
function getRuntimePropertyType(
  target: unknown,
  property: string,
): string {
  if (
    target === null ||
    target === undefined
  ) {
    return "property";
  }

  let current: object | null =
    Object(target);

  while (current) {
    try {
      const descriptor =
        Object.getOwnPropertyDescriptor(
          current,
          property,
        );

      if (descriptor) {
        if (
          "value" in descriptor
        ) {
          return describeRuntimeValue(
            descriptor.value,
          );
        }

        if (descriptor.get) {
          return "getter";
        }

        if (descriptor.set) {
          return "setter";
        }

        return "property";
      }

      current =
        Object.getPrototypeOf(
          current,
        );
    } catch {
      return "property";
    }
  }

  return "property";
}

/**
 * Returns a compact runtime value category for suggestion metadata.
 */
function describeRuntimeValue(
  value: unknown,
): string {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  return typeof value;
}

/**
 * Combines provider completions with browser-runtime completions.
 *
 * Runtime member completion takes precedence when providers return a different
 * replacement range that could otherwise remove the base expression.
 */
function resolveCompletionResult(
  external:
    | CompletionResultLike
    | null
    | undefined,
  runtime:
    | RuntimeCompletionResult
    | null,
): CompletionResultLike | null {
  const hasExternal =
    Boolean(
      external?.options.length,
    );

  const hasRuntime =
    Boolean(
      runtime?.options.length,
    );

  if (
    !hasExternal &&
    !hasRuntime
  ) {
    return null;
  }

  if (
    !hasExternal &&
    runtime
  ) {
    return runtime;
  }

  if (
    external &&
    !hasRuntime
  ) {
    return external;
  }

  if (
    !external ||
    !runtime
  ) {
    return null;
  }

  if (
    external.from !== runtime.from
  ) {
    return runtime.memberAccess
      ? runtime
      : external;
  }

  return {
    from: external.from,

    options:
      mergeCompletionItems(
        external.options,
        runtime.options,
      ),
  };
}

/**
 * Merges completion lists while keeping external-provider entries
 * authoritative.
 */
function mergeCompletionItems(
  primary:
    readonly MaquinaCompletionItem[],
  secondary:
    readonly MaquinaCompletionItem[],
): MaquinaCompletionItem[] {
  const result:
    MaquinaCompletionItem[] = [];

  const labels =
    new Set<string>();

  for (
    const collection of
    [primary, secondary]
  ) {
    for (const item of collection) {
      if (
        labels.has(item.label)
      ) {
        continue;
      }

      labels.add(item.label);
      result.push(item);

      if (
        result.length >=
        MAX_COMPLETIONS
      ) {
        return result;
      }
    }
  }

  return result;
}

/**
 * Copies layout-affecting textarea styles into the hidden caret mirror.
 */
function copyTextareaMetrics(
  mirror: HTMLDivElement,
  style: CSSStyleDeclaration,
): void {
  mirror.style.boxSizing =
    style.boxSizing;

  mirror.style.width =
    style.width;

  mirror.style.paddingTop =
    style.paddingTop;

  mirror.style.paddingRight =
    style.paddingRight;

  mirror.style.paddingBottom =
    style.paddingBottom;

  mirror.style.paddingLeft =
    style.paddingLeft;

  mirror.style.borderTopWidth =
    style.borderTopWidth;

  mirror.style.borderRightWidth =
    style.borderRightWidth;

  mirror.style.borderBottomWidth =
    style.borderBottomWidth;

  mirror.style.borderLeftWidth =
    style.borderLeftWidth;

  mirror.style.borderStyle =
    "solid";

  mirror.style.borderColor =
    "transparent";

  mirror.style.fontFamily =
    style.fontFamily;

  mirror.style.fontSize =
    style.fontSize;

  mirror.style.fontWeight =
    style.fontWeight;

  mirror.style.fontStyle =
    style.fontStyle;

  mirror.style.fontVariant =
    style.fontVariant;

  mirror.style.lineHeight =
    style.lineHeight;

  mirror.style.letterSpacing =
    style.letterSpacing;

  mirror.style.wordSpacing =
    style.wordSpacing;

  mirror.style.textAlign =
    style.textAlign;

  mirror.style.textIndent =
    style.textIndent;

  mirror.style.textTransform =
    style.textTransform;

  mirror.style.whiteSpace =
    style.whiteSpace;

  mirror.style.overflowWrap =
    style.overflowWrap;

  mirror.style.wordBreak =
    style.wordBreak;

  mirror.style.direction =
    style.direction;

  mirror.style.tabSize =
    style.tabSize;
}

/**
 * Returns an element offset in CSS pixels relative to an ancestor.
 */
function getOffsetWithin(
  element: HTMLElement,
  ancestor: HTMLElement,
): {
  readonly left: number;
  readonly top: number;
} {
  let left = 0;
  let top = 0;

  let current: HTMLElement | null =
    element;

  while (
    current &&
    current !== ancestor
  ) {
    left += current.offsetLeft;
    top += current.offsetTop;

    current =
      current.offsetParent as
        | HTMLElement
        | null;
  }

  if (current === ancestor) {
    return {
      left,
      top,
    };
  }

  /*
   * Handles uncommon offset-parent boundaries such as shadow roots.
   * DOMRect coordinates are converted back into ancestor-local CSS pixels.
   */
  const elementRect =
    element.getBoundingClientRect();

  const ancestorRect =
    ancestor.getBoundingClientRect();

  const scaleX =
    ancestor.offsetWidth > 0
      ? ancestorRect.width /
        ancestor.offsetWidth
      : 1;

  const scaleY =
    ancestor.offsetHeight > 0
      ? ancestorRect.height /
        ancestor.offsetHeight
      : 1;

  return {
    left:
      (elementRect.left -
        ancestorRect.left) /
      (scaleX || 1),

    top:
      (elementRect.top -
        ancestorRect.top) /
      (scaleY || 1),
  };
}

/**
 * Applies resolved theme tokens as CSS custom properties.
 */
function applyTheme(
  root: HTMLElement,
  name: MaquinaThemeName,
): void {
  const theme =
    resolveMaquinaTheme(
      name,
      undefined,
    );

  root.dataset.theme =
    theme.name;

  for (
    const [key, value] of
    Object.entries(theme)
  ) {
    if (
      key === "name" ||
      key === "dark"
    ) {
      continue;
    }

    const property =
      key.replace(
        /[A-Z]/g,
        (character) =>
          `-${character.toLowerCase()}`,
      );

    root.style.setProperty(
      `--maq-${property}`,
      String(value),
    );
  }
}

/**
 * Configures editor dimensions while keeping the textarea at a mobile-safe
 * 16px font size. Visual scaling is applied to the whole editor instead.
 */
function applyEditorMetrics(
  root: HTMLElement,
  textarea: HTMLTextAreaElement,
  highlight: HTMLElement,
  options: MaquinaOptions,
): void {
  const tabSize = clamp(
    options.tabSize ??
      DEFAULT_TAB_SIZE,
    MIN_TAB_SIZE,
    MAX_TAB_SIZE,
  );

  const scale = clamp(
    (options.fontSize ??
      DEFAULT_FONT_SIZE) /
      DEFAULT_FONT_SIZE,
    MIN_FONT_SCALE,
    MAX_FONT_SCALE,
  );

  root.style.setProperty(
    "--maq-tab-size",
    String(tabSize),
  );

  root.style.setProperty(
    "--maq-scale",
    String(scale),
  );

  root.style.transformOrigin =
    "top left";

  root.style.transform =
    scale === 1
      ? ""
      : `scale(${scale})`;

  root.style.width =
    scale === 1
      ? "100%"
      : `${100 / scale}%`;

  root.style.height =
    scale === 1
      ? "100%"
      : `${100 / scale}%`;

  const whiteSpace =
    options.lineWrapping === false
      ? "pre"
      : "pre-wrap";

  const overflowWrap =
    options.lineWrapping === false
      ? "normal"
      : "anywhere";

  /*
   * Keeping native inputs at 16px avoids unwanted Safari/iOS focus zoom.
   * The requested editor font size is represented by the root scale instead.
   */
  textarea.style.fontSize =
    `${DEFAULT_FONT_SIZE}px`;

  highlight.style.fontSize =
    `${DEFAULT_FONT_SIZE}px`;

  textarea.style.whiteSpace =
    whiteSpace;

  highlight.style.whiteSpace =
    whiteSpace;

  textarea.style.overflowWrap =
    overflowWrap;

  highlight.style.overflowWrap =
    overflowWrap;

  textarea.style.tabSize =
    String(tabSize);

  highlight.style.tabSize =
    String(tabSize);
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    Math.max(
      value,
      minimum,
    ),
    maximum,
  );
}
