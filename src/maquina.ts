/**
 * @tool Maquina
 * @global Maquina
 * @package maquina
 * @description A dependency-free, Safari-safe code editor powered by Fábrica, Cipó and Broto.
 */
import { mountMaquina } from "./maquina/editor";
export { maquinaThemes, resolveMaquinaTheme } from "./maquina/theme";
export type { MaquinaTheme } from "./maquina/theme";
export { tokenizeMaquina } from "./maquina/tokenizer";
export { maquinaStyleArtifacts } from "./maquina/components";
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
} from "./maquina/types";

export { mountMaquina }; 
