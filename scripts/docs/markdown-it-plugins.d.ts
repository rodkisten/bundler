declare module "markdown-it-anchor" {
  import type MarkdownIt from "markdown-it";

  type AnchorOptions = Record<string, unknown>;
  type AnchorPlugin = ((md: MarkdownIt, options?: AnchorOptions) => void) & {
    permalink: {
      linkAfterHeader(options?: AnchorOptions): unknown;
      linkInsideHeader(options?: AnchorOptions): unknown;
    };
  };

  const plugin: AnchorPlugin;
  export default plugin;
}

declare module "markdown-it-task-lists" {
  import type MarkdownIt from "markdown-it";

  type TaskListOptions = {
    enabled?: boolean;
    label?: boolean;
    labelAfter?: boolean;
  };

  const plugin: (md: MarkdownIt, options?: TaskListOptions) => void;
  export default plugin;
}

declare module "markdown-it-emoji" {
  import type MarkdownIt from "markdown-it";

  export const full: (md: MarkdownIt) => void;
  export const light: (md: MarkdownIt) => void;
  export const bare: (md: MarkdownIt) => void;
}
