import type { MaquinaThemeName } from "./types";

export interface MaquinaTheme {
  name: MaquinaThemeName;
  dark: boolean;
  background: string;
  surface: string;
  foreground: string;
  muted: string;
  border: string;
  accent: string;
  selection: string;
  keyword: string;
  string: string;
  number: string;
  comment: string;
  tag: string;
  attribute: string;
  property: string;
}

export const maquinaThemes: Record<MaquinaThemeName, MaquinaTheme> = {
  obsidian: {
    name: "obsidian", dark: true, background: "#090b12", surface: "#111521", foreground: "#edf2ff", muted: "#79839a", border: "#273149", accent: "#8ea8ff", selection: "#294a8a88", keyword: "#c792ea", string: "#c3e88d", number: "#f78c6c", comment: "#697386", tag: "#82aaff", attribute: "#ffcb6b", property: "#89ddff",
  },
  midnight: {
    name: "midnight", dark: true, background: "#071018", surface: "#0d1924", foreground: "#e7f7ff", muted: "#6f8796", border: "#183447", accent: "#45d1ff", selection: "#0a7ca455", keyword: "#ff79c6", string: "#a8e66b", number: "#ffb86c", comment: "#607d8b", tag: "#50fa7b", attribute: "#8be9fd", property: "#bd93f9",
  },
  forest: {
    name: "forest", dark: true, background: "#0b120f", surface: "#121d18", foreground: "#ecf7ef", muted: "#75877b", border: "#294235", accent: "#7ee0a2", selection: "#2f775055", keyword: "#d7a8ff", string: "#b7e47d", number: "#ffae7b", comment: "#718276", tag: "#7dd3fc", attribute: "#f7d774", property: "#9ce4c4",
  },
  paper: {
    name: "paper", dark: false, background: "#fbfaf7", surface: "#ffffff", foreground: "#202631", muted: "#7b8492", border: "#d9dde4", accent: "#4f6ee8", selection: "#a9bcff66", keyword: "#7c3aed", string: "#3b7a21", number: "#c2410c", comment: "#84909c", tag: "#1d4ed8", attribute: "#a16207", property: "#0369a1",
  },
};

export function resolveMaquinaTheme(name: MaquinaThemeName | undefined, dark: boolean | undefined): MaquinaTheme {
  if (name) return maquinaThemes[name];
  return dark === false ? maquinaThemes.paper : maquinaThemes.obsidian;
}
