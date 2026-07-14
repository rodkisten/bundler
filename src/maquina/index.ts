/**
 * @tool Maquina
 * @global Maquina
 * @package maquina
 * @description A dependency-free, Safari-safe code editor powered by Fábrica, Cipó and Broto.
 */
export { mountMaquina } from "./editor";
export { maquinaThemes, resolveMaquinaTheme } from "./theme";
export type { MaquinaTheme } from "./theme";
export { tokenizeMaquina } from "./tokenizer";
export { maquinaStyleArtifacts } from "./components";
export type {
  MaquinaCompletionContext,
  MaquinaCompletionItem,
  MaquinaCompletionMatch,
  MaquinaCompletionProvider,
  MaquinaCompletionResult,
  MaquinaHandle,
  MaquinaLanguage,
  MaquinaOptions,
  MaquinaThemeName,
  MaquinaToken,
} from "./types";
