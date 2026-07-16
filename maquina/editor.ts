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

interface EditorState {
  value: string;
  language: MaquinaLanguage;
  theme: MaquinaThemeName;
  suggestions: MaquinaCompletionItem[];
  suggestionFrom: number;
  activeSuggestion: number;
  open: boolean;
}

type Dispose = () => void;

/**
 * Mounts a Maquina editor into the provided parent.
 *
 * The editor shell, token highlights, suggestion items, refs, and event handlers
 * are all rendered through Fabrica. Direct DOM access is intentionally limited
 * to browser-specific mutable state such as textarea selection and scrolling.
 */
export function mountMaquina(options: MaquinaOptions): MaquinaHandle {
  const initialTheme = resolveMaquinaTheme(options.theme, options.dark);

  const state = createDeepStore({
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

    const value = editorTextarea.value;

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
        (keyboardEvent.key === "Tab" || keyboardEvent.key === "Enter")
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
        clamp(options.tabSize ?? DEFAULT_TAB_SIZE, MIN_TAB_SIZE, MAX_TAB_SIZE),
      );

      editorTextarea.setRangeText(
        indent,
        editorTextarea.selectionStart,
        editorTextarea.selectionEnd,
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
            placeholder=${options.placeholder ?? ""}
            aria-label=${options.ariaLabel ?? "Code editor"}
            spellcheck="false"
            autocapitalize="off"
            autocomplete="off"
            autocorrect="off"
            inputmode="text"
            wrap=${options.lineWrapping === false ? "off" : "soft"}
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
  const editorRoot = rootRef;
  const editorTextarea = textareaRef;
  const editorHighlight = highlightRef;
  const editorSuggestions = suggestionsRef;

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
   * Explicitly mirror the initial value because consumers may query getValue()
   * immediately after mounting, before any browser painting occurs.
   */
  editorTextarea.value = options.value;
  editorTextarea.setSelectionRange(
    options.value.length,
    options.value.length,
  );

  applyTheme(editorRoot, initialTheme.name);
  applyEditorMetrics(
    editorRoot,
    editorTextarea,
    editorHighlight,
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

    editorHighlight.replaceChildren();

    disposeHighlightContent = maquinaFabrica.render(
      editorHighlight,
      html`
        ${tokens.map((token) => html`
          <span
            :token=${token.kind}
            style=${token.kind === "plain"
              ? ""
              : `color: var(--maq-${token.kind})`}
          >${token.value}</span>
        `)}
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

    editorHighlight.style.transform =
      `translate(${-editorTextarea.scrollLeft}px, ${-editorTextarea.scrollTop}px)`;
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

    editorSuggestions.replaceChildren();
    editorSuggestions.hidden = true;
  }

  /**
   * Renders the completion popup through Fabrica.
   *
   * Pointer handlers live inside the template so their lifecycle is tied to
   * the rendered suggestion subtree rather than manually managed DOM listeners.
   */
  function renderSuggestions(): void {
    if (destroyed) return;

    const items = state.suggestions.peek();

    if (!state.open.peek() || items.length === 0) {
      editorSuggestions.hidden = true;
      return;
    }

    const activeSuggestion = state.activeSuggestion.peek();

    disposeSuggestionsContent?.();
    disposeSuggestionsContent = undefined;

    editorSuggestions.replaceChildren();

    disposeSuggestionsContent = maquinaFabrica.render(
      editorSuggestions,
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

    editorSuggestions.hidden = false;

    positionSuggestions();
  }

  /**
   * Positions completion UI near the current caret using inexpensive text
   * metrics. Scroll offsets are included so long documents stay correctly
   * aligned while the editor viewport moves.
   */
  function positionSuggestions(): void {
    const beforeCursor = editorTextarea.value.slice(
      0,
      editorTextarea.selectionStart,
    );

    const lines = beforeCursor.split("\n");
    const line = lines.length - 1;
    const column = lines.at(-1)?.length ?? 0;

    const computedStyle = window.getComputedStyle(editorTextarea);
    const fontSize =
      Number.parseFloat(computedStyle.fontSize) || DEFAULT_FONT_SIZE;

    const parsedLineHeight = Number.parseFloat(computedStyle.lineHeight);
    const lineHeight = Number.isFinite(parsedLineHeight)
      ? parsedLineHeight
      : fontSize * 1.55;

    /*
     * Code fonts are normally monospace. This estimate avoids an expensive
     * mirror DOM measurement on every completion update.
     */
    const characterWidth = fontSize * 0.53;

    const desiredLeft =
      16 +
      column * characterWidth -
      editorTextarea.scrollLeft;

    const desiredTop =
      18 +
      (line + 1) * lineHeight -
      editorTextarea.scrollTop;

    const popupWidth = editorSuggestions.offsetWidth || 230;
    const popupHeight = editorSuggestions.offsetHeight || 180;

    const maxLeft = Math.max(
      8,
      editorRoot.clientWidth - popupWidth - 8,
    );

    const maxTop = Math.max(
      8,
      editorRoot.clientHeight - popupHeight - 8,
    );

    editorSuggestions.style.left =
      `${clamp(desiredLeft, 8, maxLeft)}px`;

    editorSuggestions.style.top =
      `${clamp(desiredTop, 8, maxTop)}px`;
  }

  /**
   * Requests completions using monotonically increasing versions.
   *
   * An older asynchronous request is ignored instead of closing or overwriting
   * a newer result. This prevents completion flicker during fast typing.
   */
  async function requestCompletions(): Promise<void> {
    if (
      destroyed ||
      !options.completions ||
      options.readOnly
    ) {
      return;
    }

    const version = ++completionVersion;
    const cursor = editorTextarea.selectionStart;
    const value = editorTextarea.value;
    const context = createCompletionContext(value, cursor);

    try {
      const result = await options.completions(context);

      /*
       * A stale request must do absolutely nothing. In particular, it must not
       * close a newer suggestion popup that may already be visible.
       */
      if (
        destroyed ||
        version !== completionVersion
      ) {
        return;
      }

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
          suggestions: result.options.slice(0, MAX_COMPLETIONS),
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
       * Completion providers are optional extensions. A provider failure should
       * not break editing or surface an unhandled promise rejection.
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
   * Applies the selected completion directly through the native textarea API.
   *
   * setRangeText preserves browser-native selection semantics while avoiding
   * manual string slicing and cursor calculations.
   */
  function applySuggestion(index: number): void {
    if (destroyed) return;

    const item = state.suggestions.peek()[index];

    if (!item) return;

    const from = clamp(
      state.suggestionFrom.peek(),
      0,
      editorTextarea.selectionStart,
    );

    const to = editorTextarea.selectionStart;
    const insert = item.apply ?? item.label;

    editorTextarea.setRangeText(
      insert,
      from,
      to,
      "end",
    );

    const value = editorTextarea.value;

    state.value.set(value);
    options.onChange?.(value);

    renderHighlight();
    closeSuggestions();
    syncScroll();

    editorTextarea.focus();
  }

  return {
    getValue(): string {
      return destroyed
        ? state.value.peek()
        : editorTextarea.value;
    },

    setValue(value: string): void {
      if (
        destroyed ||
        editorTextarea.value === value
      ) {
        return;
      }

      completionVersion += 1;

      editorTextarea.value = value;
      state.value.set(value);

      closeSuggestions(false);
      renderHighlight();
      syncScroll();
    },

    focus(): void {
      if (!destroyed) {
        editorTextarea.focus();
      }
    },

    run(): void {
      if (!destroyed) {
        options.onRun?.();
      }
    },

    setLanguage(language: MaquinaLanguage): void {
      if (
        destroyed ||
        state.language.peek() === language
      ) {
        return;
      }

      state.language.set(language);
      renderHighlight();
    },

    setTheme(nextTheme: MaquinaThemeName): void {
      if (destroyed) return;

      const resolvedTheme = resolveMaquinaTheme(
        nextTheme,
        undefined,
      );

      state.theme.set(resolvedTheme.name);
      applyTheme(editorRoot, resolvedTheme.name);
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

      disposeHighlightContent = undefined;
      disposeSuggestionsContent = undefined;

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
      const prefix = value.slice(0, cursor);

      /*
       * Global and sticky expressions carry positional state that conflicts
       * with matching strictly against the suffix immediately before cursor.
       */
      const flags = pattern.flags.replace(/[gy]/g, "");
      const anchored = new RegExp(
        `(?:${pattern.source})$`,
        flags,
      );

      const match = anchored.exec(prefix);

      if (!match) return null;

      return {
        from: cursor - match[0].length,
        text: match[0],
      };
    },
  };
}

/**
 * Applies resolved theme tokens as CSS custom properties.
 */
function applyTheme(
  root: HTMLElement,
  name: MaquinaThemeName,
): void {
  const theme = resolveMaquinaTheme(name, undefined);

  root.dataset.theme = theme.name;

  for (const [key, value] of Object.entries(theme)) {
    if (
      key === "name" ||
      key === "dark"
    ) {
      continue;
    }

    const property = key.replace(
      /[A-Z]/g,
      (character) => `-${character.toLowerCase()}`,
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
    options.tabSize ?? DEFAULT_TAB_SIZE,
    MIN_TAB_SIZE,
    MAX_TAB_SIZE,
  );

  const scale = clamp(
    (options.fontSize ?? DEFAULT_FONT_SIZE) /
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

  root.style.transformOrigin = "top left";
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
  textarea.style.fontSize = `${DEFAULT_FONT_SIZE}px`;
  highlight.style.fontSize = `${DEFAULT_FONT_SIZE}px`;

  textarea.style.whiteSpace = whiteSpace;
  highlight.style.whiteSpace = whiteSpace;

  textarea.style.overflowWrap = overflowWrap;
  highlight.style.overflowWrap = overflowWrap;

  textarea.style.tabSize = String(tabSize);
  highlight.style.tabSize = String(tabSize);
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    Math.max(value, minimum),
    maximum,
  );
}
