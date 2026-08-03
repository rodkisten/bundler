import { effect } from "@rodkisten/broto";
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
import { createMaquinaEditorState } from "@rodkisten/maquina/editor-state";
import { MaquinaHistory } from "@rodkisten/maquina/history";
import { diffInputValue } from "@rodkisten/maquina/input";
import { computePopupPlacement } from "@rodkisten/maquina/popup";
import {
  event,
  html,
  maquinaFabrica,
  MaquinaTokenText,
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
const MIN_FONT_SIZE = 8;
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
  const state = createMaquinaEditorState({
    document: createDocumentSnapshot(options.value),
    language: (options.language ?? "text") as MaquinaLanguage,
    theme: initialTheme.name as MaquinaThemeName,
  });

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
  const history = new MaquinaHistory();

  function onInput(): void {
    if (destroyed || !textareaRef) return;

    const nextValue = textareaRef.value;
    const selection = readTextareaSelection(textareaRef);
    const diff = diffInputValue(
      state.value.peek(),
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

    if (
      !state.composing.peek() &&
      options.activateCompletionOnTyping !== false
    ) {
      void requestCompletions();
    }
  }

  function onScroll(): void {
    syncViewportState();

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
    state.focused.set(true);
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

    state.focused.set(false);
    blurTimer = window.setTimeout(() => {
      blurTimer = undefined;

      if (!textareaRef?.matches(":focus")) {
        closeSuggestions();
      }
    }, SUGGESTIONS_BLUR_DELAY_MS);

    options.onBlur?.();
  }

  function onCompositionStart(): void {
    state.composing.set(true);
  }

  function onCompositionEnd(): void {
    state.composing.set(false);

    if (options.activateCompletionOnTyping !== false) {
      void requestCompletions();
    }
  }

  function onSelectionChange(): void {
    if (destroyed || !textareaRef) return;

    dispatchTransaction(
      {
        selection: readTextareaSelection(textareaRef),
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

  function isolateKeyboardEvent(keyboardEvent: KeyboardEvent): void {
    if (!options.isolateKeyboardEvents) return;
    keyboardEvent.stopPropagation();
    keyboardEvent.stopImmediatePropagation();
  }

  function insertNewline(): void {
    const textarea = textareaRef;
    if (!textarea || options.readOnly) return;

    const from = textarea.selectionStart;
    const to = textarea.selectionEnd;
    dispatchTransaction({
      changes: [{ from, to, insert: "\n" }],
      selection: { anchor: from + 1, head: from + 1 },
      origin: "input",
    });
  }

  function onKeyUp(keyboardEvent: KeyboardEvent): void {
    isolateKeyboardEvent(keyboardEvent);
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
    isolateKeyboardEvent(keyboardEvent);

    if (
      keyboardEvent.key === "Enter" &&
      (keyboardEvent.shiftKey || keyboardEvent.ctrlKey) &&
      options.modifiedEnter === "newline"
    ) {
      keyboardEvent.preventDefault();
      insertNewline();
      return;
    }

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
          (
            keyboardEvent.key === "Enter" &&
            !keyboardEvent.shiftKey &&
            !keyboardEvent.ctrlKey &&
            !keyboardEvent.metaKey &&
            !keyboardEvent.altKey
          )
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
      keyboardEvent.key === "Enter" &&
      options.modifiedEnter !== "newline"
    ) {
      keyboardEvent.preventDefault();
      options.onRun?.();
      return;
    }

    if (
      keyboardEvent.key === "Enter" &&
      !keyboardEvent.shiftKey &&
      !keyboardEvent.ctrlKey &&
      !keyboardEvent.metaKey &&
      !keyboardEvent.altKey &&
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
            :peer="editor"
            :open=${state.open}
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
            @compositionstart=${event.compositionstart(onCompositionStart)}
            @compositionend=${event.compositionend(onCompositionEnd)}
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

  function syncViewportState(): void {
    state.setViewport({
      scrollTop: mountedTextarea.scrollTop,
      scrollLeft: mountedTextarea.scrollLeft,
      width: mountedTextarea.clientWidth,
      height: mountedTextarea.clientHeight,
    });
  }

  function onViewportGeometryChange(): void {
    syncViewportState();

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
  applyTextareaSelection(mountedTextarea, {
    anchor: options.value.length,
    head: options.value.length,
  });

  applyTheme(mountedRoot, initialTheme.name);
  applyEditorMetrics(
    mountedRoot,
    mountedViewport,
    mountedTextarea,
    mountedHighlight,
    options,
  );
  syncViewportState();

  const disposeDocumentViewEffect = effect(() => {
    state.value();
    state.language();
    updateGutterMetrics();
    renderHighlight();
    syncScroll();
  }, {
    sync: true,
    name: `maquina:${instanceId}:document-view`,
  });

  function syncInputFromDocument(): void {
    const documentState = state.getDocument();

    if (mountedTextarea.value !== documentState.value) {
      mountedTextarea.value = documentState.value;
    }

    applyTextareaSelection(
      mountedTextarea,
      documentState.selection,
    );
  }

  function dispatchTransaction(
    transaction: MaquinaTransaction,
    inputAlreadyApplied = false,
  ): void {
    if (destroyed) return;

    const before = state.getDocument();
    const applied = applyDocumentTransaction(before, transaction);
    const documentState = applied.snapshot;

    state.setDocument(documentState);

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

    if (!inputAlreadyApplied) {
      syncInputFromDocument();
    }

    if (valueChanged) {
      options.onChange?.(documentState.value);
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
    const lineCount = getLineStarts(state.value.peek()).length;
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
      state.version.peek(),
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
            <MaquinaLine :maquinaLine=${String(line.number)}>
              ${lineNumbers
                ? html`
                    <MaquinaLineNumber
                      :maquinaLineNumber=${String(line.number)}
                    >${String(line.number)}</MaquinaLineNumber>
                  `
                : ""}
              <MaquinaCodeClip :maquinaCodeClip>
                <MaquinaLineCode
                  :maquinaLineCode=${String(line.number)}
                >${line.tokens.length > 0
                    ? line.tokens.map(
                        (token) =>
                          html`<MaquinaTokenText :token=${token.kind}>${token.value}</MaquinaTokenText>`,
                      )
                    : "\u200b"}</MaquinaLineCode>
              </MaquinaCodeClip>
            </MaquinaLine>
          `,
        )}
      `,
    );
    hardenHighlightRows(
      mountedHighlight,
      lineNumbers,
      mountedRoot.style.getPropertyValue("--maq-gutter-width") || "0px",
      options.lineWrapping !== false,
    );
  }

  function shouldVirtualizeHighlight(): boolean {
    if (options.lineWrapping !== false) return false;

    let lines = 1;
    const value = state.value.peek();

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

    const viewportState = state.viewport.peek();

    return getVisibleLineRange(
      value,
      viewportState.scrollTop,
      viewportState.height,
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

    const viewportState = state.viewport.peek();

    mountedHighlight.style.setProperty(
      "transform",
      `translateY(${renderedHighlightTop - viewportState.scrollTop}px)`,
      "important",
    );
    mountedRoot.style.setProperty(
      "--maq-scroll-x",
      `${-viewportState.scrollLeft}px`,
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
      state.patchCompletion({
        open: false,
        suggestions: [],
        activeSuggestion: 0,
      });
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
              :active="false"
              :maquinaSuggestionIndex=${String(index)}
              @pointerdown=${event.pointerdown(() => {
                state.activeSuggestion.set(index);
                syncActiveSuggestion();
              })}
              @click=${event.click(() => {
                applySuggestion(index);
              })}
            >
              <span :slot="label">${item.label}</span>
              <small :slot="detail">${formatSuggestionDetail(item)}</small>
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
      setImportantStyles(mirror, {
        position: "absolute",
        display: "block",
        left: "-100000px",
        top: "0",
        width: "auto",
        height: "auto",
        minWidth: "0",
        minHeight: "0",
        margin: "0",
        overflow: "hidden",
        visibility: "hidden",
        pointerEvents: "none",
        boxSizing: "border-box",
        transform: "none",
      });
      mountedViewport.append(mirror);
      caretMirrorRef = mirror;
    }

    if (!marker) {
      marker = documentRef.createElement("span");
      setImportantStyles(marker, {
        display: "inline-block",
        width: "0",
        height: "1em",
        minWidth: "0",
        minHeight: "0",
        padding: "0",
        margin: "0",
        border: "0",
        overflow: "hidden",
        font: "inherit",
        lineHeight: "inherit",
        verticalAlign: "top",
        whiteSpace: "pre",
        transform: "none",
      });
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

      state.patchCompletion({
        suggestions: result.options.slice(0, MAX_COMPLETIONS),
        suggestionFrom,
        activeSuggestion: 0,
        open: true,
      });

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
      return state.value.peek();
    },

    setValue(value: string): void {
      if (destroyed || state.value.peek() === value) return;

      completionVersion += 1;

      const replaced = replaceDocument(
        state.getDocument(),
        value,
        undefined,
        "api",
      );

      state.setDocument(replaced.snapshot);
      history.clear();
      syncInputFromDocument();
      closeSuggestions(false);
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
      return state.getDocument();
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
      disposeDocumentViewEffect();

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
  setImportantStyles(mirror, {
    boxSizing: style.boxSizing,
    width: style.width,
    paddingTop: style.paddingTop,
    paddingRight: style.paddingRight,
    paddingBottom: style.paddingBottom,
    paddingLeft: style.paddingLeft,
    borderTopWidth: style.borderTopWidth,
    borderRightWidth: style.borderRightWidth,
    borderBottomWidth: style.borderBottomWidth,
    borderLeftWidth: style.borderLeftWidth,
    borderStyle: "solid",
    borderColor: "transparent",
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    fontVariant: style.fontVariant,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    wordSpacing: style.wordSpacing,
    textAlign: style.textAlign,
    textIndent: style.textIndent,
    textTransform: style.textTransform,
    whiteSpace: style.whiteSpace,
    overflowWrap: style.overflowWrap,
    wordBreak: style.wordBreak,
    direction: style.direction,
    tabSize: style.tabSize,
  });
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
 * A transformed textarea is prone to native-caret drift on iOS. The native
 * input and visual layer therefore use identical, unscaled metrics and are
 * hardened with inline invariants against hostile host-page CSS resets.
 */
function applyEditorMetrics(
  root: HTMLElement,
  viewport: HTMLElement,
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
    options.fontSize ?? DEFAULT_FONT_SIZE,
    MIN_FONT_SIZE,
    MAX_FONT_SIZE,
  );
  const lineHeight = fontSize * 1.55;
  const whiteSpace = options.lineWrapping === false ? "pre" : "pre-wrap";
  const overflowWrap = options.lineWrapping === false ? "normal" : "anywhere";
  const fontFamily = "var(--maq-font, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)";

  setImportantStyles(root, {
    position: "relative",
    display: "grid",
    width: "100%",
    height: "100%",
    minWidth: "0",
    minHeight: "0",
    maxWidth: "100%",
    maxHeight: "100%",
    overflow: "hidden",
    transform: "none",
    transformOrigin: "0 0",
    contain: "layout paint style",
    boxSizing: "border-box",
  });

  setImportantStyles(viewport, {
    position: "relative",
    width: "100%",
    height: "100%",
    minWidth: "0",
    minHeight: "0",
    overflow: "hidden",
    boxSizing: "border-box",
    touchAction: "pan-y pan-x",
  });

  root.style.setProperty("--maq-tab-size", String(tabSize));
  root.style.setProperty("--maq-font-size", `${fontSize}px`);
  root.style.setProperty("--maq-white-space", whiteSpace);
  root.style.setProperty("--maq-overflow-wrap", overflowWrap);

  setImportantStyles(highlight, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    minWidth: "100%",
    minHeight: "100%",
    margin: "0",
    padding: "14px 0 26px",
    overflow: "hidden",
    boxSizing: "border-box",
    pointerEvents: "none",
    userSelect: "none",
    fontFamily,
    fontSize: `${fontSize}px`,
    fontWeight: "500",
    fontStyle: "normal",
    lineHeight: `${lineHeight}px`,
    letterSpacing: "normal",
    wordSpacing: "normal",
    textIndent: "0",
    whiteSpace,
    overflowWrap,
    wordBreak: "normal",
    tabSize: String(tabSize),
  });

  setImportantStyles(textarea, {
    position: "absolute",
    inset: "0",
    display: "block",
    width: "100%",
    height: "100%",
    minWidth: "0",
    minHeight: "0",
    maxWidth: "100%",
    maxHeight: "100%",
    margin: "0",
    paddingTop: "14px",
    paddingRight: "16px",
    paddingBottom: "26px",
    paddingLeft: "calc(var(--maq-gutter-width, 0px) + 16px)",
    overflow: "auto",
    boxSizing: "border-box",
    resize: "none",
    border: "0",
    outline: "0",
    appearance: "none",
    background: "transparent",
    color: "transparent",
    caretColor: "var(--maq-foreground)",
    fontFamily,
    fontSize: `${fontSize}px`,
    fontWeight: "500",
    fontStyle: "normal",
    lineHeight: `${lineHeight}px`,
    letterSpacing: "normal",
    wordSpacing: "normal",
    textIndent: "0",
    textTransform: "none",
    whiteSpace,
    overflowWrap,
    wordBreak: "normal",
    tabSize: String(tabSize),
    touchAction: "pan-y pan-x",
    userSelect: "text",
  });
  textarea.style.setProperty("-webkit-text-fill-color", "transparent", "important");
  textarea.style.setProperty("-webkit-user-select", "text", "important");
  textarea.style.setProperty("-webkit-overflow-scrolling", "touch");
}

function hardenHighlightRows(
  highlight: HTMLElement,
  lineNumbers: boolean,
  gutterWidth: string,
  wraps: boolean,
): void {
  const whiteSpace = wraps ? "pre-wrap" : "pre";
  const overflowWrap = wraps ? "anywhere" : "normal";

  for (const row of highlight.querySelectorAll<HTMLElement>("[data-maquina-line]")) {
    setImportantStyles(row, {
      display: "grid",
      gridTemplateColumns: lineNumbers
        ? `${gutterWidth || "0px"} minmax(0, 1fr)`
        : "minmax(0, 1fr)",
      alignItems: "stretch",
      minWidth: "100%",
      minHeight: "1.55em",
      margin: "0",
      padding: "0",
      border: "0",
      boxSizing: "border-box",
    });
  }

  for (const gutter of highlight.querySelectorAll<HTMLElement>("[data-maquina-line-number]")) {
    setImportantStyles(gutter, {
      display: "block",
      alignSelf: "stretch",
      margin: "0",
      padding: "0 12px 0 0",
      borderTop: "0",
      borderRight: "1px solid var(--maq-border)",
      borderBottom: "0",
      borderLeft: "0",
      boxSizing: "border-box",
      textAlign: "right",
      whiteSpace: "nowrap",
      lineHeight: "inherit",
    });
  }

  for (const clip of highlight.querySelectorAll<HTMLElement>("[data-maquina-code-clip]")) {
    setImportantStyles(clip, {
      display: "block",
      minWidth: "0",
      margin: "0",
      padding: "0",
      overflow: "hidden",
      boxSizing: "border-box",
    });
  }

  for (const code of highlight.querySelectorAll<HTMLElement>("[data-maquina-line-code]")) {
    setImportantStyles(code, {
      display: "block",
      minWidth: "0",
      margin: "0",
      padding: "0 16px",
      border: "0",
      boxSizing: "border-box",
      font: "inherit",
      lineHeight: "inherit",
      letterSpacing: "inherit",
      wordSpacing: "inherit",
      whiteSpace,
      overflowWrap,
      wordBreak: "normal",
      transform: "translateX(var(--maq-scroll-x, 0px))",
    });
  }

  for (const token of highlight.querySelectorAll<HTMLElement>("[data-token]")) {
    setImportantStyles(token, {
      display: "inline",
      margin: "0",
      padding: "0",
      border: "0",
      font: "inherit",
      lineHeight: "inherit",
      letterSpacing: "inherit",
      wordSpacing: "inherit",
      whiteSpace: "inherit",
      textIndent: "0",
      textTransform: "none",
    });
  }
}

function setImportantStyles(
  element: HTMLElement,
  styles: Partial<Record<keyof CSSStyleDeclaration, string>>,
): void {
  for (const [key, value] of Object.entries(styles)) {
    if (value == null) continue;
    const property = key.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
    element.style.setProperty(property, value, "important");
  }
}

function readTextareaSelection(textarea: HTMLTextAreaElement): { anchor: number; head: number } {
  const start = Number.isFinite(textarea.selectionStart) ? textarea.selectionStart : 0;
  const end = Number.isFinite(textarea.selectionEnd) ? textarea.selectionEnd : start;
  return textarea.selectionDirection === "backward"
    ? { anchor: end, head: start }
    : { anchor: start, head: end };
}

function applyTextareaSelection(
  textarea: HTMLTextAreaElement,
  selection: { anchor: number; head: number },
): void {
  const length = textarea.value.length;
  const anchor = clampFinitePosition(selection.anchor, length);
  const head = clampFinitePosition(selection.head, length);
  const start = Math.min(anchor, head);
  const end = Math.max(anchor, head);
  const direction: "forward" | "backward" = anchor > head ? "backward" : "forward";
  try {
    textarea.setSelectionRange(start, end, direction);
  } catch {
    textarea.setSelectionRange(end, end);
  }
}

function clampFinitePosition(value: number, length: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(length, Math.max(0, Math.trunc(value)));
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(Math.max(value, minimum), maximum);
}
