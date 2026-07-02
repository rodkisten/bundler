import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { EditorState, type Extension } from "@codemirror/state";
import { drawSelection, EditorView, highlightActiveLine, keymap, lineNumbers } from "@codemirror/view";
import { oneDark } from "@codemirror/theme-one-dark";

export type CodeEditorLanguage = "javascript" | "json" | "html" | "css" | "text";

export interface CodeEditorOptions {
  value: string;
  language?: CodeEditorLanguage;
  dark?: boolean;
  readOnly?: boolean;
  parent: HTMLElement;
  completions?: (context: CompletionContext) => CompletionResult | null;
  onChange?(value: string): void;
  onRun?(): void;
}

export interface CodeEditorHandle {
  getValue(): string;
  setValue(value: string): void;
  focus(): void;
  destroy(): void;
}

export function mountCodeEditor(options: CodeEditorOptions): CodeEditorHandle {
  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) options.onChange?.(update.state.doc.toString());
  });
  const extensions: Extension[] = [
    lineNumbers(),
    history(),
    drawSelection(),
    highlightActiveLine(),
    keymap.of([
      { key: "Mod-Enter", run: () => { options.onRun?.(); return Boolean(options.onRun); } },
      ...defaultKeymap,
      ...historyKeymap,
    ]),
    languageExtension(options.language ?? "text"),
    autocompletion({ override: options.completions ? [options.completions as never] : undefined }),
    updateListener,
    EditorView.lineWrapping,
    EditorView.theme({
      "&": { minHeight: "100%", fontSize: "12px" },
      ".cm-scroller": { fontFamily: "var(--rd-font-mono)", minHeight: "100%" },
    }),
    EditorState.readOnly.of(options.readOnly === true),
  ];
  if (options.dark) extensions.push(oneDark);

  const view = new EditorView({
    parent: options.parent,
    state: EditorState.create({ doc: options.value, extensions }),
  });

  return {
    getValue: () => view.state.doc.toString(),
    setValue(value: string) {
      const current = view.state.doc.toString();
      if (current === value) return;
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}

function languageExtension(language: CodeEditorLanguage): Extension {
  if (language === "javascript") return javascript();
  if (language === "json") return json();
  if (language === "html") return html();
  if (language === "css") return css();
  return [];
}
