/**
 * @tool Maquina
 * @global Maquina
 * @package maquina
 * @description A dependency-free, Safari-safe code editor powered by Fábrica, Cipó and Broto.
 */
import { mountMaquina } from "@rodkisten/maquina/editor";
export { maquinaThemes, resolveMaquinaTheme } from "@rodkisten/maquina/theme";
export type { MaquinaTheme } from "@rodkisten/maquina/theme";
export { tokenizeMaquina } from "@rodkisten/maquina/tokenizer";
export { maquinaStyleArtifacts } from "@rodkisten/maquina/components";
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
} from "@rodkisten/maquina/types";

export { mountMaquina }; 
