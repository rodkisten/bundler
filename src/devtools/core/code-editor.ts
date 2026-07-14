/**
 * DevTools compatibility façade for Máquina.
 *
 * Keeping this module stable avoids leaking editor implementation details into
 * panels while allowing the editor runtime to evolve independently.
 */
export { mountMaquina as mountCodeEditor } from "../../maquina";
export type {
  MaquinaCompletionContext as CompletionContext,
  MaquinaCompletionResult as CompletionResult,
  MaquinaHandle as CodeEditorHandle,
  MaquinaLanguage as CodeEditorLanguage,
  MaquinaOptions as CodeEditorOptions,
} from "../../maquina";
