import { createDeepStore } from "@rodkisten/broto";
import { maquinaFabrica, html, ref } from "@rodkisten/maquina/components";
import { resolveMaquinaTheme } from "@rodkisten/maquina/theme";
import { tokenizeMaquina } from "@rodkisten/maquina/tokenizer";
import type { MaquinaCompletionContext, MaquinaCompletionItem, MaquinaCompletionMatch, MaquinaHandle, MaquinaLanguage, MaquinaOptions, MaquinaThemeName } from "@rodkisten/maquina/types";

interface EditorState {
  value: string;
  language: MaquinaLanguage;
  theme: MaquinaThemeName;
  suggestions: MaquinaCompletionItem[];
  suggestionFrom: number;
  activeSuggestion: number;
  open: boolean;
}

export function mountMaquina(options: MaquinaOptions): MaquinaHandle {
  const theme = resolveMaquinaTheme(options.theme, options.dark);
  const state = createDeepStore({
    value: options.value,
    language: (options.language ?? "text") as MaquinaLanguage,
    theme: theme.name as MaquinaThemeName,
    suggestions: [] as MaquinaCompletionItem[],
    suggestionFrom: 0,
    activeSuggestion: 0,
    open: false as boolean,
  } satisfies EditorState);

  let textarea: HTMLTextAreaElement | null = null;
  let highlight: HTMLElement | null = null;
  let suggestions: HTMLElement | null = null;
  let destroyed = false;
  let completionVersion = 0;

  const dispose = maquinaFabrica.render(options.parent, html`
    <MaquinaRoot data-theme=${theme.name}>
      <MaquinaViewport>
        <MaquinaHighlight aria-hidden="true" ref=${ref<HTMLElement>((node) => { highlight = node; })}></MaquinaHighlight>
        <MaquinaInput
          ref=${ref<HTMLTextAreaElement>((node) => { textarea = node; })}
          .value=${options.value}
          placeholder=${options.placeholder ?? ""}
          aria-label=${options.ariaLabel ?? "Code editor"}
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
          autocorrect="off"
          
          inputmode="none"
          :gramm="false"
          :gramm_editor="false"
          :enable-grammarly="false"
          :ms-editor="false"
          
          ?readonly=${options.readOnly === true}
        />
        <MaquinaSuggestions hidden ref=${ref<HTMLElement>((node) => { suggestions = node; })}></MaquinaSuggestions>
      </MaquinaViewport>
    </MaquinaRoot>
  `);

  const root = options.parent.firstElementChild as HTMLElement | null;
  const mountedTextarea = options.parent.querySelector<HTMLTextAreaElement>("textarea");
  const mountedHighlight = highlight as HTMLElement | null;
  const mountedSuggestions = suggestions as HTMLElement | null;
  if (!root || !mountedTextarea || !mountedHighlight || !mountedSuggestions) {
    throw new Error("[Maquina] Editor failed to mount");
  }
  textarea = mountedTextarea;
  highlight = mountedHighlight;
  suggestions = mountedSuggestions;

  // Property bindings are intentionally mirrored here so standalone/editor
  // adapters always expose the initial value and cursor synchronously.
  textarea.value = options.value;
  textarea.setSelectionRange(options.value.length, options.value.length);

  applyTheme(root, theme.name);
  root.style.setProperty("--maq-tab-size", String(Math.max(1, Math.min(16, options.tabSize ?? 2))));
  root.style.setProperty("--maq-scale", String(Math.max(0.5, Math.min(2, (options.fontSize ?? 16) / 16))));
  const scale = Math.max(0.5, Math.min(2, (options.fontSize ?? 16) / 16));
  root.style.transformOrigin = "top left";
  root.style.transform = scale === 1 ? "" : `scale(${scale})`;
  root.style.width = scale === 1 ? "100%" : `${100 / scale}%`;
  root.style.height = scale === 1 ? "100%" : `${100 / scale}%`;
  const whiteSpace = options.lineWrapping === false ? "pre" : "pre-wrap";
  textarea.style.fontSize = "16px";
  highlight.style.fontSize = "16px";
  textarea.style.whiteSpace = whiteSpace;
  highlight.style.whiteSpace = whiteSpace;
  textarea.style.overflowWrap = options.lineWrapping === false ? "normal" : "anywhere";
  highlight.style.overflowWrap = options.lineWrapping === false ? "normal" : "anywhere";

  const renderHighlight = (): void => {
    if (!highlight) return;
    highlight.replaceChildren(...tokenizeMaquina(state.value.peek(), state.language.peek()).map((token) => {
      const span = document.createElement("span");
      span.textContent = token.value;
      span.dataset.token = token.kind;
      if (token.kind !== "plain") span.style.color = `var(--maq-${token.kind})`;
      return span;
    }));
    if (state.value.peek().endsWith("\n")) highlight.append(document.createTextNode("\n"));
  };

  const syncScroll = (): void => {
    if (!textarea || !highlight) return;
    highlight.style.transform = `translate(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px)`;
  };

  const closeSuggestions = (): void => {
    state.patch({ open: false as boolean, suggestions: [] as MaquinaCompletionItem[], activeSuggestion: 0 }, { cause: "maquina:close-completions" });
    if (suggestions) suggestions.hidden = true;
  };

  const renderSuggestions = (): void => {
    if (!suggestions || !textarea) return;
    const items = state.suggestions.peek();
    if (!state.open.peek() || !items.length) {
      suggestions.hidden = true;
      return;
    }
    suggestions.hidden = false;
    suggestions.replaceChildren(...items.map((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.active = String(index === state.activeSuggestion.peek());
      button.innerHTML = `<span></span><small></small>`;
      button.firstElementChild!.textContent = item.label;
      button.lastElementChild!.textContent = item.detail || item.type || "";
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        applySuggestion(index);
      });
      return button;
    }));
    const lineHeight = 24.8;
    const before = textarea.value.slice(0, textarea.selectionStart);
    const lines = before.split("\n");
    const line = lines.length - 1;
    const column = lines.at(-1)?.length ?? 0;
    suggestions.style.left = `${Math.min(root.clientWidth - 230, 16 + column * 8.5)}px`;
    suggestions.style.top = `${Math.min(root.clientHeight - 180, 18 + line * lineHeight)}px`;
  };

  const requestCompletions = async (): Promise<void> => {
    if (!options.completions || !textarea || options.readOnly) return;
    const version = ++completionVersion;
    const cursor = textarea.selectionStart;
    const context = createCompletionContext(textarea.value, cursor);
    const result = await options.completions(context);
    if (destroyed || version !== completionVersion || !result?.options.length) {
      closeSuggestions();
      return;
    }
    state.patch({ suggestions: result.options.slice(0, 100), suggestionFrom: result.from, activeSuggestion: 0, open: true }, { cause: "maquina:completions" });
    renderSuggestions();
  };

  const applySuggestion = (index: number): void => {
    if (!textarea) return;
    const item = state.suggestions.peek()[index];
    if (!item) return;
    const from = state.suggestionFrom.peek();
    const to = textarea.selectionStart;
    const insert = item.apply ?? item.label;
    textarea.setRangeText(insert, from, to, "end");
    state.value.set(textarea.value);
    options.onChange?.(textarea.value);
    renderHighlight();
    closeSuggestions();
    textarea.focus();
  };

  const onInput = (): void => {
    if (!textarea) return;
    state.value.set(textarea.value);
    options.onChange?.(textarea.value);
    renderHighlight();
    if (options.activateCompletionOnTyping !== false) void requestCompletions();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (state.open.peek()) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        const length = state.suggestions.peek().length;
        state.activeSuggestion.set((state.activeSuggestion.peek() + delta + length) % length);
        renderSuggestions();
        return;
      }
      if (event.key === "Tab" || event.key === "Enter") {
        event.preventDefault();
        applySuggestion(state.activeSuggestion.peek());
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeSuggestions();
        return;
      }
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      options.onRun?.();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && options.onRun) {
      event.preventDefault();
      options.onRun();
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      const indent = " ".repeat(Math.max(1, options.tabSize ?? 2));
      textarea?.setRangeText(indent, textarea.selectionStart, textarea.selectionEnd, "end");
      onInput();
    }
  };

  textarea.addEventListener("input", onInput);
  textarea.addEventListener("scroll", syncScroll, { passive: true });
  textarea.addEventListener("keydown", onKeyDown);
  textarea.addEventListener("focus", () => options.onFocus?.());
  textarea.addEventListener("blur", () => { window.setTimeout(closeSuggestions, 80); options.onBlur?.(); });
  textarea.addEventListener("keyup", () => { if (options.activateCompletionOnTyping === false) return; void requestCompletions(); });
  textarea.addEventListener("click", () => { if (options.activateCompletionOnTyping === false) return; void requestCompletions(); });

  renderHighlight();

  return {
    getValue: () => textarea?.value ?? state.value.peek(),
    setValue(value) {
      if (!textarea || textarea.value === value) return;
      textarea.value = value;
      state.value.set(value);
      renderHighlight();
    },
    focus: () => textarea?.focus(),
    run: () => options.onRun?.(),
    setLanguage(language) { state.language.set(language); renderHighlight(); },
    setTheme(nextTheme) { state.theme.set(nextTheme); applyTheme(root, nextTheme); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      completionVersion += 1;
      dispose();
      options.parent.replaceChildren();
    },
  };
}

function createCompletionContext(value: string, cursor: number): MaquinaCompletionContext {
  return {
    value,
    cursor,
    matchBefore(pattern: RegExp): MaquinaCompletionMatch | null {
      const prefix = value.slice(0, cursor);
      const flags = pattern.flags.replace("g", "");
      const anchored = new RegExp(`${pattern.source}$`, flags);
      const match = anchored.exec(prefix);
      return match ? { from: cursor - match[0].length, text: match[0] } : null;
    },
  };
}

function applyTheme(root: HTMLElement, name: MaquinaThemeName): void {
  const theme = resolveMaquinaTheme(name, undefined);
  root.dataset.theme = name;
  for (const [key, value] of Object.entries(theme)) {
    if (key === "name" || key === "dark") continue;
    root.style.setProperty(`--maq-${key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`, String(value));
  }
}
