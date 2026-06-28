import type { RootEntry } from "../config";
import type { SourceExample } from "../example-extractor";

export type PackageTheme = "broto" | "fabrica" | "fabrica-elements" | "cipo" | "index" | "benchmark" | "pipeline" | "docs" | "default";

export type GeneratedDoc = {
  title: string;
  slug: string;
  sourcePath: string;
  displayPath: string;
  href: string;
  kind: "readme" | "markdown";
  packageId: PackageTheme;
  description?: string;
};

export type GeneratedCodePage = {
  title: string;
  slug: string;
  href: string;
  sourcePath: string;
  displayPath: string;
  language: string;
  kind: "source" | "test" | "pipeline" | "benchmark";
  packageId: PackageTheme;
  description?: string;
};

export type BenchmarkSummary = {
  id: string;
  title: string;
  href: string;
  sourcePath: string;
  displayPath: string;
  packageId: PackageTheme;
  generatedAt?: string;
  geometricMeanPercent?: number;
  absoluteGeometricMeanPercent?: number;
  faster?: number;
  slower?: number;
  stable?: number;
  unstable?: number;
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
  benchmarks?: BenchmarkSummary[];
};

export type MarkdownPageInput = {
  title: string;
  sourcePath: string;
  displayPath: string;
  markdown: string;
  navItems: GeneratedDoc[];
  benchmarks?: BenchmarkSummary[];
  packageId?: PackageTheme;
  description?: string;
};

export type CodePageInput = {
  title: string;
  sourcePath: string;
  displayPath: string;
  code: string;
  language: string;
  navItems: GeneratedCodePage[];
  kind: GeneratedCodePage["kind"];
  benchmarks?: BenchmarkSummary[];
  packageId?: PackageTheme;
  description?: string;
};

export type Heading = {
  id: string;
  level: number;
  text: string;
};
