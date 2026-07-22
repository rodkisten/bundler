import { batch, signal, type Signal } from "@rodkisten/broto";
import type { MaquinaDocumentSnapshot } from "@rodkisten/maquina/document";
import type {
  MaquinaCompletionItem,
  MaquinaLanguage,
  MaquinaSelection,
  MaquinaThemeName,
} from "@rodkisten/maquina/types";

export interface MaquinaViewportState {
  readonly scrollTop: number;
  readonly scrollLeft: number;
  readonly width: number;
  readonly height: number;
}

export interface MaquinaEditorReactiveState {
  readonly value: Signal<string>;
  readonly selection: Signal<MaquinaSelection>;
  readonly version: Signal<number>;
  readonly language: Signal<MaquinaLanguage>;
  readonly theme: Signal<MaquinaThemeName>;
  readonly suggestions: Signal<MaquinaCompletionItem[]>;
  readonly suggestionFrom: Signal<number>;
  readonly activeSuggestion: Signal<number>;
  readonly open: Signal<boolean>;
  readonly viewport: Signal<MaquinaViewportState>;
  readonly focused: Signal<boolean>;
  readonly composing: Signal<boolean>;
  getDocument(): MaquinaDocumentSnapshot;
  setDocument(snapshot: MaquinaDocumentSnapshot): void;
  patchCompletion(patch: MaquinaCompletionPatch): void;
  setViewport(viewport: MaquinaViewportState): void;
}

export interface MaquinaEditorStateOptions {
  readonly document: MaquinaDocumentSnapshot;
  readonly language: MaquinaLanguage;
  readonly theme: MaquinaThemeName;
}

export interface MaquinaCompletionPatch {
  readonly suggestions?: MaquinaCompletionItem[];
  readonly suggestionFrom?: number;
  readonly activeSuggestion?: number;
  readonly open?: boolean;
}

/**
 * Creates the fine-grained Broto state used by one Maquina editor instance.
 * The document transformation logic remains pure in document.ts; this layer
 * only publishes committed snapshots and transient UI state reactively.
 */
export function createMaquinaEditorState(
  options: MaquinaEditorStateOptions,
): MaquinaEditorReactiveState {
  const value = signal(options.document.value, {
    name: "maquina:document:value",
  });
  const selection = signal(options.document.selection, {
    name: "maquina:document:selection",
  });
  const version = signal(options.document.version, {
    name: "maquina:document:version",
  });
  const language = signal(options.language, {
    name: "maquina:language",
  });
  const theme = signal(options.theme, {
    name: "maquina:theme",
  });
  const suggestions = signal<MaquinaCompletionItem[]>([], {
    name: "maquina:completion:items",
  });
  const suggestionFrom = signal(0, {
    name: "maquina:completion:from",
  });
  const activeSuggestion = signal(0, {
    name: "maquina:completion:active",
  });
  const open = signal(false, {
    name: "maquina:completion:open",
  });
  const viewport = signal<MaquinaViewportState>({
    scrollTop: 0,
    scrollLeft: 0,
    width: 0,
    height: 0,
  }, {
    name: "maquina:viewport",
  });
  const focused = signal(false, {
    name: "maquina:ui:focused",
  });
  const composing = signal(false, {
    name: "maquina:ui:composing",
  });

  return {
    value,
    selection,
    version,
    language,
    theme,
    suggestions,
    suggestionFrom,
    activeSuggestion,
    open,
    viewport,
    focused,
    composing,

    getDocument(): MaquinaDocumentSnapshot {
      return {
        value: value.peek(),
        selection: selection.peek(),
        version: version.peek(),
      };
    },

    setDocument(snapshot: MaquinaDocumentSnapshot): void {
      batch(() => {
        version.set(snapshot.version);

        const currentSelection = selection.peek();

        if (
          currentSelection.anchor !== snapshot.selection.anchor ||
          currentSelection.head !== snapshot.selection.head
        ) {
          selection.set(snapshot.selection);
        }

        // Commit value last so synchronous view effects observe a complete
        // snapshot, including the matching selection and document version.
        value.set(snapshot.value);
      });
    },

    patchCompletion(patch: MaquinaCompletionPatch): void {
      batch(() => {
        if (patch.suggestions !== undefined) {
          suggestions.set(patch.suggestions);
        }

        if (patch.suggestionFrom !== undefined) {
          suggestionFrom.set(patch.suggestionFrom);
        }

        if (patch.activeSuggestion !== undefined) {
          activeSuggestion.set(patch.activeSuggestion);
        }

        if (patch.open !== undefined) {
          open.set(patch.open);
        }
      });
    },

    setViewport(nextViewport: MaquinaViewportState): void {
      const currentViewport = viewport.peek();

      if (
        currentViewport.scrollTop === nextViewport.scrollTop &&
        currentViewport.scrollLeft === nextViewport.scrollLeft &&
        currentViewport.width === nextViewport.width &&
        currentViewport.height === nextViewport.height
      ) {
        return;
      }

      viewport.set(nextViewport);
    },
  };
}
