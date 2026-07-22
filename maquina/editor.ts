import { createDeepStore } from "@rodkisten/broto";
import {
  createRuntimeCompletionResult,
  createScopeCompletionResult,
  resolveCompletionResult,
} from "@rodkisten/maquina/completion";
import {
  applyDocumentTransaction,
  createDocumentSnapshot,
  replaceDocument,
} from "@rodkisten/maquina/document";
import { MaquinaHistory } from "@rodkisten/maquina/history";
import { diffInputValue } from "@rodkisten/maquina/input";
import { computePopupPlacement } from "@rodkisten/maquina/popup";
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
  MaquinaTransaction,
} from "@rodkisten/maquina/types";
import {
  getLineStarts,
  getVisibleLineRange,
} from "@rodkisten/maquina/viewport";
import {
  createVisualLines,
  getLineNumberGutterWidth,
} from "@rodkisten/maquina/visual";

const MAX_COMPLETIONS = 100;
const DEFAULT_TAB_SIZE = 2;
const DEFAULT_FONT_SIZE = 16;
const MIN_FONT_SIZE = 16;
const MAX_FONT_SIZE = 32;
const MIN_TAB_SIZE = 1;
const MAX_TAB_SIZE = 16;
const SUGGESTIONS_BLUR_DELAY_MS = 100;
const VIRTUALIZATION_MIN_LINES = 200;
const VIRTUALIZATION_OVERSCAN = 12;
const POPUP_VIEWPORT_MARGIN = 8;
const POPUP_GAP = 6;
const POPUP_MIN_WIDTH = 220;
const POPUP_MAX_WIDTH = 440;

let editorInstanceId = 0;

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

interface HighlightRange {
  readonly fromLine: number;
  readonly toLine: number;
  readonly from: number;
  readonly to: number;
  readonly top: number;
}

type Dispose = () => void;

/**
 * Mounts a document-first code editor with native textarea input and a separate
 * visual layer for syntax highlighting, line numbers, and completion UI.
 */
export function mountMaquina(options: MaquinaOptions): MaquinaHandle {
  const initialTheme = resolveMaquinaTheme(options.theme, options.dark);
  const lineNumbers = options.lineNumbers !== false;
  const instanceId = ++editorInstanceId;
  const suggestionsId = `maquina-suggestions-${instanceId}`;
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
  let viewportRef: HTMLElement | null = null;
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
  let renderedHighlightTop = 0;
  let renderedHighlightRange = "";
  let documentState = createDocumentSnapshot(options.value);
  const history = new MaquinaHistory();

  function onInput(): void {
    if (destroyed || !textareaRef) return;

    const nextValue = textareaRef.value;
    const selection = {
      anchor: textareaRef.selectionStart,
      head: textareaRef.selectionEnd,
    };
    const diff = diffInputValue(
      documentState.value,
      nextValue,
      selection,
    );

    dispatchTransaction(
      {
        changes: diff.changes,
        selection: diff.selection,
        origin: "input",
      },
      true,
    );

    if (options.activateCompletionOnTyping !== false) {
      void requestCompletions();
    }
  }

  function onScroll(): void {
    if (shouldVirtualizeHighlight()) {
      renderHighlight();
    }

    syncScroll();

    if (state.open.peek()) {
      positionSuggestions();
    }
  }

  function onFocus(): void {
    clearBlurTimer();
    options.onFocus?.();
  }

  function onBlur(blurEvent: FocusEvent): void {
    clearBlurTimer();

    const nextTarget = blurEvent.relatedTarget;

    if (
      nextTarget instanceof Node &&
      suggestionsRef?.contains(nextTarget)
    ) {
      return;
    }

    blurTimer = window.setTimeout(() => {
      blurTimer = undefined;

      if (!textareaRef?.matches(":focus")) {
        closeSuggestions();
      }
    }, SUGGESTIONS_BLUR_DELAY_MS);

    options.onBlur?.();
  }

  function onSelectionChange(): void {
    if (destroyed || !textareaRef) return;

    dispatchTransaction(
      {
        selection: {
          anchor: textareaRef.selectionStart,
          head: textareaRef.selectionEnd,
        },
        origin: "input",
        addToHistory: false,
      },
      true,
    );
  }

  function onClick(): void {
    onSelectionChange();

    if (options.activateCompletionOnTyping !== false) {
      void requestCompletions();
    }
  }

  function onKeyUp(keyboardEvent: KeyboardEvent): void {
    onSelectionChange();

    if (options.activateCompletionOnTyping === false) return;

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
        (
          keyboardEvent.key === "ArrowDown" ||
          keyboardEvent.key === "ArrowUp"
        )
      ) {
        keyboardEvent.preventDefault();

        const delta = keyboardEvent.key === "ArrowDown" ? 1 : -1;
        const current = state.activeSuggestion.peek();
        const next = (current + delta + items.length) % items.length;

        state.activeSuggestion.set(next);
        syncActiveSuggestion();
        return;
      }

      if (
        items.length > 0 &&
        (
          keyboardEvent.key === "Tab" ||
          keyboardEvent.key === "Enter"
        )
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
      !keyboardEvent.shiftKey &&
      keyboardEvent.key.toLowerCase() === "z"
    ) {
      keyboardEvent.preventDefault();
      undo();
      return;
    }

    if (
      (keyboardEvent.metaKey || keyboardEvent.ctrlKey) &&
      (
        keyboardEvent.key.toLowerCase() === "y" ||
        (
          keyboardEvent.shiftKey &&
          keyboardEvent.key.toLowerCase() === "z"
        )
      )
    ) {
      keyboardEvent.preventDefault();
      redo();
      return;
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

      const from = textarea.selectionStart;
      const to = textarea.selectionEnd;

      dispatchTransaction({
        changes: [{ from, to, insert: indent }],
        selection: {
          anchor: from + indent.length,
          head: from + indent.length,
        },
        origin: "indent",
      });
    }
  }

  const disposeEditor = maquinaFabrica.render(
    options.parent,
    html`
      <MaquinaRoot
        ref=${ref<HTMLElement>((node) => {
          rootRef = node;
        })}
        :theme=${initialTheme.name}
        :lineNumbers=${String(lineNumbers)}
      >
        <MaquinaViewport
          ref=${ref<HTMLElement>((node) => {
            viewportRef = node;
          })}
        >
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
            aria-autocomplete="list"
            aria-controls=${suggestionsId}
            aria-expanded="false"
            role="combobox"
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
            @select=${event.select(onSelectionChange)}
            @click=${event.click(onClick)}
            @focus=${event.focus(onFocus)}
            @blur=${event.blur(onBlur)}
          />

          <MaquinaSuggestions
            id=${suggestionsId}
            hidden
            role="listbox"
            aria-label="Code completions"
            ref=${ref<HTMLElement>((node) => {
              suggestionsRef = node;
            })}
          ></MaquinaSuggestions>
        </MaquinaViewport>
      </MaquinaRoot>
    `,
  );

  const editorRoot = rootRef as HTMLElement | null;
  const editorViewport = viewportRef as HTMLElement | null;
  const editorTextarea = textareaRef as HTMLTextAreaElement | null;
  const editorHighlight = highlightRef as HTMLElement | null;
  const editorSuggestions = suggestionsRef as HTMLElement | null;

  if (
    !editorRoot ||
    !editorViewport ||
    !editorTextarea ||
    !editorHighlight ||
    !editorSuggestions
  ) {
    disposeEditor();
    throw new Error("[Maquina] Editor failed to mount");
  }

  const mountedRoot = editorRoot;
  const mountedViewport = editorViewport;
  const mountedTextarea = editorTextarea;
  const mountedHighlight = editorHighlight;
  const mountedSuggestions = editorSuggestions;
  const ownerWindow =
    mountedTextarea.ownerDocument.defaultView ?? window;
  const visualViewport = ownerWindow.visualViewport;

  function onViewportGeometryChange(): void {
    if (!destroyed && state.open.peek()) {
      positionSuggestions();
    }
  }

  const resizeObserver =
    typeof ownerWindow.ResizeObserver === "function"
      ? new ownerWindow.ResizeObserver(onViewportGeometryChange)
      : null;

  resizeObserver?.observe(mountedViewport);
  ownerWindow.addEventListener("resize", onViewportGeometryChange, {
    passive: true,
  });
  visualViewport?.addEventListener("resize", onViewportGeometryChange, {
    passive: true,
  });
  visualViewport?.addEventListener("scroll", onViewportGeometryChange, {
    passive: true,
  });

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
  updateGutterMetrics();
  renderHighlight();
  syncScroll();

  function syncInputFromDocument(): void {
    if (mountedTextarea.value !== documentState.value) {
      mountedTextarea.value = documentState.value;
    }

    const selection = documentState.selection;

    mountedTextarea.setSelectionRange(
      selection.anchor,
      selection.head,
    );
  }

  function dispatchTransaction(
    transaction: MaquinaTransaction,
    inputAlreadyApplied = false,
  ): void {
    if (destroyed) return;

    const before = documentState;
    const applied = applyDocumentTransaction(before, transaction);
    documentState = applied.snapshot;

    const valueChanged = before.value !== documentState.value;
    const shouldRecord =
      valueChanged &&
      transaction.addToHistory !== false &&
      transaction.origin !== "history";

    if (shouldRecord) {
      history.push({
        undo: applied.inverse,
        redo: {
          ...transaction,
          selection: documentState.selection,
          origin: "history",
        },
      });
    }

    state.value.set(documentState.value);

    if (!inputAlreadyApplied) {
      syncInputFromDocument();
    }

    if (valueChanged) {
      options.onChange?.(documentState.value);
      updateGutterMetrics();
      renderHighlight();
      syncScroll();
    }
  }

  function undo(): boolean {
    const entry = history.takeUndo();

    if (!entry) return false;

    dispatchTransaction(entry.undo);
    closeSuggestions();
    return true;
  }

  function redo(): boolean {
    const entry = history.takeRedo();

    if (!entry) return false;

    dispatchTransaction(entry.redo);
    closeSuggestions();
    return true;
  }

  function updateGutterMetrics(): void {
    const lineCount = getLineStarts(documentState.value).length;
    const gutterWidth = getLineNumberGutterWidth(
      lineCount,
      lineNumbers,
    );

    mountedRoot.style.setProperty(
      "--maq-gutter-width",
      gutterWidth,
    );
  }

  /**
   * Re-renders highlighted logical rows. Line-number cells share each row's
   * height, so wrapped lines cannot drift away from their corresponding code.
   */
  function renderHighlight(): void {
    if (destroyed) return;

    const value = state.value.peek();
    const language = state.language.peek();
    const range = getHighlightRange(value);
    const rangeKey = [
      documentState.version,
      language,
      range.from,
      range.to,
      lineNumbers,
    ].join(":");

    if (rangeKey === renderedHighlightRange) return;

    renderedHighlightRange = rangeKey;
    renderedHighlightTop = range.top;

    const visibleValue = value.slice(range.from, range.to);
    const tokens = tokenizeMaquina(visibleValue, language);
    const expectedLines = Math.max(1, range.toLine - range.fromLine);
    const visualLines = createVisualLines(tokens, range.fromLine).slice(
      0,
      expectedLines,
    );

    disposeHighlightContent?.();
    disposeHighlightContent = undefined;
    mountedHighlight.replaceChildren();

    disposeHighlightContent = maquinaFabrica.render(
      mountedHighlight,
      html`
        ${visualLines.map(
          (line) => html`
            <MaquinaLine data-maquina-line=${String(line.number)}>
              ${lineNumbers
                ? html`
                    <MaquinaLineNumber
                      data-maquina-line-number=${String(line.number)}
                    >${String(line.number)}</MaquinaLineNumber>
                  `
                : ""}
              <MaquinaCodeClip>
                <MaquinaLineCode
                  data-maquina-line-code=${String(line.number)}
                >${line.tokens.length > 0
                    ? line.tokens.map(
                        (token) =>
                          html`
                            <span :token=${token.kind}>
                              ${token.value}
                            </span>
                          `,
                      )
                    : "\u200b"}</MaquinaLineCode>
              </MaquinaCodeClip>
            </MaquinaLine>
          `,
        )}
      `,
    );
  }

  function shouldVirtualizeHighlight(): boolean {
    if (options.lineWrapping !== false) return false;

    let lines = 1;
    const value = documentState.value;

    for (let index = 0; index < value.length; index += 1) {
      if (value.charCodeAt(index) !== 10) continue;

      lines += 1;

      if (lines >= VIRTUALIZATION_MIN_LINES) {
        return true;
      }
    }

    return false;
  }

  function getHighlightRange(value: string): HighlightRange {
    const lineCount = getLineStarts(value).length;

    if (!shouldVirtualizeHighlight()) {
      return {
        fromLine: 0,
        toLine: lineCount,
        from: 0,
        to: value.length,
        top: 0,
      };
    }

    const style = ownerWindow.getComputedStyle(mountedTextarea);
    const parsed = Number.parseFloat(style.lineHeight);
    const lineHeight = Number.isFinite(parsed)
      ? parsed
      : DEFAULT_FONT_SIZE * 1.55;

    return getVisibleLineRange(
      value,
      mountedTextarea.scrollTop,
      mountedTextarea.clientHeight,
      lineHeight,
      VIRTUALIZATION_OVERSCAN,
    );
  }

  /**
   * Keeps vertical scrolling shared by the full visual layer while horizontal
   * scrolling moves code cells only, leaving the line-number gutter anchored.
   */
  function syncScroll(): void {
    if (destroyed) return;

    mountedHighlight.style.transform =
      `translateY(${renderedHighlightTop - mountedTextarea.scrollTop}px)`;
    mountedRoot.style.setProperty(
      "--maq-scroll-x",
      `${-mountedTextarea.scrollLeft}px`,
    );

    if (state.open.peek()) {
      positionSuggestions();
    }
  }

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
    mountedTextarea.setAttribute("aria-expanded", "false");
    mountedTextarea.removeAttribute("aria-activedescendant");
  }

  /**
   * Renders a semantic listbox. Options deliberately keep focus on the native
   * textarea, which preserves the software keyboard and native caret on touch.
   */
  function renderSuggestions(): void {
    if (destroyed) return;

    const items = state.suggestions.peek();

    if (!state.open.peek() || items.length === 0) {
      closeSuggestions(false);
      return;
    }

    disposeSuggestionsContent?.();
    disposeSuggestionsContent = undefined;
    mountedSuggestions.replaceChildren();

    disposeSuggestionsContent = maquinaFabrica.render(
      mountedSuggestions,
      html`
        ${items.map(
          (item, index) => html`
            <MaquinaSuggestion
              id=${getSuggestionId(index)}
              role="option"
              aria-selected="false"
              data-active="false"
              data-maquina-suggestion-index=${String(index)}
              @pointerdown=${event.pointerdown(() => {
                state.activeSuggestion.set(index);
                syncActiveSuggestion();
              })}
              @click=${event.click(() => {
                applySuggestion(index);
              })}
            >
              <span>${item.label}</span>
              <small>${formatSuggestionDetail(item)}</small>
            </MaquinaSuggestion>
          `,
        )}
      `,
    );

    mountedSuggestions.hidden = false;
    mountedTextarea.setAttribute("aria-expanded", "true");
    syncActiveSuggestion();
    positionSuggestions();
  }

  function syncActiveSuggestion(): void {
    if (destroyed || !state.open.peek()) return;

    const activeIndex = state.activeSuggestion.peek();
    const optionsNodes = mountedSuggestions.querySelectorAll<HTMLElement>(
      "[data-maquina-suggestion-index]",
    );
    let activeNode: HTMLElement | null = null;

    for (const node of optionsNodes) {
      const index = Number(node.dataset.maquinaSuggestionIndex);
      const active = index === activeIndex;

      node.dataset.active = String(active);
      node.setAttribute("aria-selected", String(active));

      if (active) activeNode = node;
    }

    if (!activeNode) return;

    mountedTextarea.setAttribute(
      "aria-activedescendant",
      activeNode.id,
    );
    ensureSuggestionVisible(activeNode);
  }

  function ensureSuggestionVisible(activeNode: HTMLElement): void {
    const top = activeNode.offsetTop;
    const bottom = top + activeNode.offsetHeight;
    const visibleTop = mountedSuggestions.scrollTop;
    const visibleBottom = visibleTop + mountedSuggestions.clientHeight;

    if (top < visibleTop) {
      mountedSuggestions.scrollTop = top;
      return;
    }

    if (bottom > visibleBottom) {
      mountedSuggestions.scrollTop = bottom - mountedSuggestions.clientHeight;
    }
  }

  /**
   * Positions the listbox inside both the editor and the mobile visual
   * viewport. It flips above the caret when the keyboard leaves more room
   * there.
   */
  function positionSuggestions(): void {
    if (destroyed || mountedSuggestions.hidden) return;

    const measurement = measureCaretPosition();
    const bounds = getVisiblePopupBounds(
      mountedViewport,
      ownerWindow,
    );
    const preferredWidth = Math.max(
      POPUP_MIN_WIDTH,
      mountedSuggestions.scrollWidth || mountedSuggestions.offsetWidth || 280,
    );
    const preferredHeight = Math.max(
      1,
      mountedSuggestions.scrollHeight || mountedSuggestions.offsetHeight || 220,
    );
    const placement = computePopupPlacement({
      anchor: measurement,
      bounds,
      preferredWidth,
      preferredHeight,
      minWidth: POPUP_MIN_WIDTH,
      maxWidth: POPUP_MAX_WIDTH,
      gap: POPUP_GAP,
    });

    mountedSuggestions.style.left = `${placement.left}px`;
    mountedSuggestions.style.top = `${placement.top}px`;
    mountedSuggestions.style.width = `${placement.width}px`;
    mountedSuggestions.style.maxHeight = `${placement.maxHeight}px`;
    mountedSuggestions.dataset.side = placement.side;
  }

  /**
   * Measures the caret with a hidden textarea-layout mirror that copies the
   * input's real width, padding, font, wrapping, and gutter-aware text origin.
   */
  function measureCaretPosition(): CaretMeasurement {
    const documentRef = mountedTextarea.ownerDocument;
    let mirror = caretMirrorRef;
    let marker = caretMarkerRef;

    if (!mirror) {
      mirror = documentRef.createElement("div");
      mirror.setAttribute("aria-hidden", "true");
      mirror.style.position = "absolute";
      mirror.style.left = "-100000px";
      mirror.style.top = "0";
      mirror.style.visibility = "hidden";
      mirror.style.pointerEvents = "none";
      mirror.style.overflow = "hidden";
      mirror.style.height = "auto";
      mirror.style.minHeight = "0";
      mountedViewport.append(mirror);
      caretMirrorRef = mirror;
    }

    if (!marker) {
      marker = documentRef.createElement("span");
      marker.style.display = "inline-block";
      marker.style.width = "0";
      marker.style.padding = "0";
      marker.style.margin = "0";
      marker.style.border = "0";
      marker.style.overflow = "hidden";
      caretMarkerRef = marker;
    }

    const computedStyle = ownerWindow.getComputedStyle(mountedTextarea);

    copyTextareaMetrics(mirror, computedStyle);

    const beforeCursor = mountedTextarea.value.slice(
      0,
      mountedTextarea.selectionStart,
    );

    marker.textContent = "\u200b";
    mirror.replaceChildren(
      documentRef.createTextNode(beforeCursor),
      marker,
    );

    const textareaOffset = getOffsetWithin(
      mountedTextarea,
      mountedViewport,
    );
    const parsedLineHeight = Number.parseFloat(computedStyle.lineHeight);
    const parsedFontSize = Number.parseFloat(computedStyle.fontSize);
    const fontSize = Number.isFinite(parsedFontSize)
      ? parsedFontSize
      : DEFAULT_FONT_SIZE;
    const lineHeight = Number.isFinite(parsedLineHeight)
      ? parsedLineHeight
      : fontSize * 1.55;

    return {
      left:
        textareaOffset.left +
        marker.offsetLeft -
        mountedTextarea.scrollLeft,
      top:
        textareaOffset.top +
        marker.offsetTop -
        mountedTextarea.scrollTop,
      height: lineHeight,
    };
  }

  /**
   * Requests external, lexical-scope, and browser-runtime completions.
   */
  async function requestCompletions(): Promise<void> {
    if (destroyed || options.readOnly) return;

    const language = state.language.peek();
    const supportsJavaScript = supportsRuntimeCompletions(language);

    if (!options.completions && !supportsJavaScript) {
      closeSuggestions();
      return;
    }

    const version = ++completionVersion;
    const cursor = mountedTextarea.selectionStart;
    const value = mountedTextarea.value;
    const context = createCompletionContext(value, cursor);

    try {
      const externalResult = options.completions
        ? await options.completions(context)
        : null;

      if (destroyed || version !== completionVersion) return;

      const scopeResult = supportsJavaScript
        ? createScopeCompletionResult(value, cursor)
        : null;
      const runtimeResult = supportsJavaScript
        ? createRuntimeCompletionResult(value, cursor, ownerWindow)
        : null;
      const result = resolveCompletionResult(
        externalResult,
        scopeResult,
        runtimeResult,
      );

      if (!result?.options.length) {
        closeSuggestions(false);
        return;
      }

      const suggestionFrom = clamp(result.from, 0, cursor);

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
      if (!destroyed && version === completionVersion) {
        closeSuggestions(false);
      }
    }
  }

  function applySuggestion(index: number): void {
    if (destroyed) return;

    const item = state.suggestions.peek()[index];

    if (!item) return;

    const from = clamp(
      state.suggestionFrom.peek(),
      0,
      mountedTextarea.selectionStart,
    );
    const to = mountedTextarea.selectionStart;
    const insert = item.apply ?? item.label;

    dispatchTransaction({
      changes: [{ from, to, insert }],
      selection: {
        anchor: from + insert.length,
        head: from + insert.length,
      },
      origin: "completion",
    });

    closeSuggestions();
    mountedTextarea.focus({ preventScroll: true });
  }

  function getSuggestionId(index: number): string {
    return `${suggestionsId}-option-${index}`;
  }

  function clearBlurTimer(): void {
    if (blurTimer === undefined) return;

    ownerWindow.clearTimeout(blurTimer);
    blurTimer = undefined;
  }

  return {
    getValue(): string {
      return documentState.value;
    },

    setValue(value: string): void {
      if (destroyed || documentState.value === value) return;

      completionVersion += 1;

      const replaced = replaceDocument(
        documentState,
        value,
        undefined,
        "api",
      );

      documentState = replaced.snapshot;
      state.value.set(value);
      history.clear();
      syncInputFromDocument();
      updateGutterMetrics();
      closeSuggestions(false);
      renderHighlight();
      syncScroll();
    },

    focus(): void {
      if (!destroyed) {
        mountedTextarea.focus({ preventScroll: true });
      }
    },

    run(): void {
      if (!destroyed) {
        options.onRun?.();
      }
    },

    setLanguage(language: MaquinaLanguage): void {
      if (destroyed || state.language.peek() === language) return;

      state.language.set(language);
      closeSuggestions();
      renderedHighlightRange = "";
      renderHighlight();
    },

    setTheme(nextTheme: MaquinaThemeName): void {
      if (destroyed) return;

      const resolvedTheme = resolveMaquinaTheme(nextTheme, undefined);

      state.theme.set(resolvedTheme.name);
      applyTheme(mountedRoot, resolvedTheme.name);
    },

    dispatch(transaction: MaquinaTransaction): void {
      dispatchTransaction(transaction);
    },

    getState() {
      return {
        value: documentState.value,
        selection: documentState.selection,
        version: documentState.version,
      };
    },

    undo,
    redo,

    destroy(): void {
      if (destroyed) return;

      destroyed = true;
      completionVersion += 1;
      clearBlurTimer();

      ownerWindow.removeEventListener(
        "resize",
        onViewportGeometryChange,
      );
      visualViewport?.removeEventListener(
        "resize",
        onViewportGeometryChange,
      );
      visualViewport?.removeEventListener(
        "scroll",
        onViewportGeometryChange,
      );
      resizeObserver?.disconnect();

      disposeHighlightContent?.();
      disposeSuggestionsContent?.();
      disposeHighlightContent = undefined;
      disposeSuggestionsContent = undefined;
      caretMirrorRef?.remove();
      caretMirrorRef = null;
      caretMarkerRef = null;
      disposeEditor();
    },
  };
}

function createCompletionContext(
  value: string,
  cursor: number,
): MaquinaCompletionContext {
  return {
    value,
    cursor,

    matchBefore(pattern: RegExp): MaquinaCompletionMatch | null {
      const prefix = value.slice(0, cursor);
      const flags = pattern.flags.replace(/[gy]/g, "");
      const anchored = new RegExp(`(?:${pattern.source})$`, flags);
      const match = anchored.exec(prefix);

      if (!match) return null;

      return {
        from: cursor - match[0].length,
        text: match[0],
      };
    },
  };
}

function supportsRuntimeCompletions(
  language: MaquinaLanguage,
): boolean {
  switch (String(language).toLowerCase()) {
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

function formatSuggestionDetail(item: MaquinaCompletionItem): string {
  if (item.detail && item.type) {
    return `${item.detail} · ${item.type}`;
  }

  return item.detail || item.type || "";
}

/**
 * Returns popup bounds in local CSS pixels for the intersection between the
 * editor viewport and the browser's visual viewport.
 */
function getVisiblePopupBounds(
  container: HTMLElement,
  view: Window,
): {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
} {
  const rect = container.getBoundingClientRect();
  const visualViewport = view.visualViewport;
  const viewportLeft = visualViewport?.offsetLeft ?? 0;
  const viewportTop = visualViewport?.offsetTop ?? 0;
  const viewportWidth = visualViewport?.width ?? view.innerWidth;
  const viewportHeight = visualViewport?.height ?? view.innerHeight;
  const viewportRight = viewportLeft + viewportWidth;
  const viewportBottom = viewportTop + viewportHeight;
  const intersectLeft = Math.max(rect.left, viewportLeft);
  const intersectTop = Math.max(rect.top, viewportTop);
  const intersectRight = Math.min(rect.right, viewportRight);
  const intersectBottom = Math.min(rect.bottom, viewportBottom);
  const scaleX =
    container.clientWidth > 0
      ? rect.width / container.clientWidth
      : 1;
  const scaleY =
    container.clientHeight > 0
      ? rect.height / container.clientHeight
      : 1;
  const safeScaleX = scaleX || 1;
  const safeScaleY = scaleY || 1;

  if (
    intersectRight <= intersectLeft ||
    intersectBottom <= intersectTop
  ) {
    return {
      left: POPUP_VIEWPORT_MARGIN,
      top: POPUP_VIEWPORT_MARGIN,
      right: Math.max(
        POPUP_VIEWPORT_MARGIN,
        container.clientWidth - POPUP_VIEWPORT_MARGIN,
      ),
      bottom: Math.max(
        POPUP_VIEWPORT_MARGIN,
        container.clientHeight - POPUP_VIEWPORT_MARGIN,
      ),
    };
  }

  return {
    left:
      (intersectLeft - rect.left) / safeScaleX +
      POPUP_VIEWPORT_MARGIN,
    top:
      (intersectTop - rect.top) / safeScaleY +
      POPUP_VIEWPORT_MARGIN,
    right:
      (intersectRight - rect.left) / safeScaleX -
      POPUP_VIEWPORT_MARGIN,
    bottom:
      (intersectBottom - rect.top) / safeScaleY -
      POPUP_VIEWPORT_MARGIN,
  };
}

/**
 * Copies every layout-affecting textarea metric into the hidden caret mirror.
 */
function copyTextareaMetrics(
  mirror: HTMLDivElement,
  style: CSSStyleDeclaration,
): void {
  mirror.style.boxSizing = style.boxSizing;
  mirror.style.width = style.width;
  mirror.style.paddingTop = style.paddingTop;
  mirror.style.paddingRight = style.paddingRight;
  mirror.style.paddingBottom = style.paddingBottom;
  mirror.style.paddingLeft = style.paddingLeft;
  mirror.style.borderTopWidth = style.borderTopWidth;
  mirror.style.borderRightWidth = style.borderRightWidth;
  mirror.style.borderBottomWidth = style.borderBottomWidth;
  mirror.style.borderLeftWidth = style.borderLeftWidth;
  mirror.style.borderStyle = "solid";
  mirror.style.borderColor = "transparent";
  mirror.style.fontFamily = style.fontFamily;
  mirror.style.fontSize = style.fontSize;
  mirror.style.fontWeight = style.fontWeight;
  mirror.style.fontStyle = style.fontStyle;
  mirror.style.fontVariant = style.fontVariant;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.wordSpacing = style.wordSpacing;
  mirror.style.textAlign = style.textAlign;
  mirror.style.textIndent = style.textIndent;
  mirror.style.textTransform = style.textTransform;
  mirror.style.whiteSpace = style.whiteSpace;
  mirror.style.overflowWrap = style.overflowWrap;
  mirror.style.wordBreak = style.wordBreak;
  mirror.style.direction = style.direction;
  mirror.style.tabSize = style.tabSize;
}

/** Returns an element offset in CSS pixels relative to an ancestor. */
function getOffsetWithin(
  element: HTMLElement,
  ancestor: HTMLElement,
): {
  readonly left: number;
  readonly top: number;
} {
  let left = 0;
  let top = 0;
  let current: HTMLElement | null = element;

  while (current && current !== ancestor) {
    left += current.offsetLeft;
    top += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }

  if (current === ancestor) {
    return { left, top };
  }

  const elementRect = element.getBoundingClientRect();
  const ancestorRect = ancestor.getBoundingClientRect();
  const scaleX =
    ancestor.offsetWidth > 0
      ? ancestorRect.width / ancestor.offsetWidth
      : 1;
  const scaleY =
    ancestor.offsetHeight > 0
      ? ancestorRect.height / ancestor.offsetHeight
      : 1;

  return {
    left:
      (elementRect.left - ancestorRect.left) /
      (scaleX || 1),
    top:
      (elementRect.top - ancestorRect.top) /
      (scaleY || 1),
  };
}

/** Applies resolved theme tokens as CSS custom properties. */
function applyTheme(
  root: HTMLElement,
  name: MaquinaThemeName,
): void {
  const theme = resolveMaquinaTheme(name, undefined);

  root.dataset.theme = theme.name;

  for (const [key, value] of Object.entries(theme)) {
    if (key === "name" || key === "dark") continue;

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
 * Configures shared text metrics without transforming the editor root.
 *
 * A transformed textarea is prone to native-caret drift on iOS. Keeping the
 * input at a mobile-safe 16px minimum and letting it fill the container avoids
 * both Safari focus zoom and transformed native selection geometry.
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
  const fontSize = clamp(
    Math.max(options.fontSize ?? DEFAULT_FONT_SIZE, MIN_FONT_SIZE),
    MIN_FONT_SIZE,
    MAX_FONT_SIZE,
  );
  const whiteSpace = options.lineWrapping === false
    ? "pre"
    : "pre-wrap";
  const overflowWrap = options.lineWrapping === false
    ? "normal"
    : "anywhere";

  root.style.transform = "";
  root.style.transformOrigin = "";
  root.style.width = "100%";
  root.style.height = "100%";
  root.style.setProperty("--maq-tab-size", String(tabSize));
  root.style.setProperty("--maq-font-size", `${fontSize}px`);
  root.style.setProperty("--maq-white-space", whiteSpace);
  root.style.setProperty("--maq-overflow-wrap", overflowWrap);

  textarea.style.fontSize = `${fontSize}px`;
  highlight.style.fontSize = `${fontSize}px`;
  textarea.style.whiteSpace = whiteSpace;
  highlight.style.whiteSpace = "normal";
  textarea.style.overflowWrap = overflowWrap;
  textarea.style.tabSize = String(tabSize);
  highlight.style.tabSize = String(tabSize);
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(Math.max(value, minimum), maximum);
}
