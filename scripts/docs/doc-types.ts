import type { RootEntry } from "../config";
import type { SourceExample } from "../example-extractor";

export type GeneratedDoc = {
  title: string;
  slug: string;
  sourcePath: string;
  href: string;
  kind: "readme" | "markdown";
};

export type GeneratedCodePage = {
  title: string;
  slug: string;
  href: string;
  sourcePath: string;
  language: string;
  kind: "source" | "test" | "pipeline";
};

export type LandingInput = {
  entries: RootEntry[];
  outputs: string[];
  namespace: string;
  examples?: Record<string, SourceExample[]>;
  docs?: GeneratedDoc[];
  sources?: GeneratedCodePage[];
  tests?: GeneratedCodePage[];
  pipelines?: GeneratedCodePage[];
};

export type MarkdownPageInput = {
  title: string;
  sourcePath: string;
  markdown: string;
  navItems: GeneratedDoc[];
};

export type CodePageInput = {
  title: string;
  sourcePath: string;
  code: string;
  language: string;
  navItems: GeneratedCodePage[];
  kind: GeneratedCodePage["kind"];
};

export type Heading = {
  id: string;
  level: number;
  text: string;
};

export type TableBlock = {
  headers: string[];
  aligns: Array<"left" | "center" | "right">;
  rows: string[][];
};
