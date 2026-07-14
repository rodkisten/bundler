export type MaquinaLanguage = "javascript" | "json" | "html" | "css" | "text";
export type MaquinaThemeName = "obsidian" | "paper" | "midnight" | "forest";

export interface MaquinaCompletionItem {
  label: string;
  type?: string;
  detail?: string;
  apply?: string;
}

export interface MaquinaCompletionMatch {
  from: number;
  text: string;
}

export interface MaquinaCompletionContext {
  readonly value: string;
  readonly cursor: number;
  matchBefore(pattern: RegExp): MaquinaCompletionMatch | null;
}

export interface MaquinaCompletionResult {
  from: number;
  options: MaquinaCompletionItem[];
}

export type MaquinaCompletionProvider = (
  context: MaquinaCompletionContext,
) => MaquinaCompletionResult | null | Promise<MaquinaCompletionResult | null>;

export interface MaquinaOptions {
  parent: HTMLElement;
  value: string;
  language?: MaquinaLanguage;
  theme?: MaquinaThemeName;
  dark?: boolean;
  readOnly?: boolean;
  lineNumbers?: boolean;
  lineWrapping?: boolean;
  fontSize?: number;
  tabSize?: number;
  placeholder?: string;
  ariaLabel?: string;
  completions?: MaquinaCompletionProvider;
  activateCompletionOnTyping?: boolean;
  onChange?(value: string): void;
  onRun?(): void;
  onFocus?(): void;
  onBlur?(): void;
}

export interface MaquinaHandle {
  getValue(): string;
  setValue(value: string): void;
  focus(): void;
  run(): void;
  setLanguage(language: MaquinaLanguage): void;
  setTheme(theme: MaquinaThemeName): void;
  destroy(): void;
}

export interface MaquinaToken {
  value: string;
  kind: "plain" | "keyword" | "string" | "number" | "comment" | "tag" | "attribute" | "property" | "punctuation" | "boolean";
}
