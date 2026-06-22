import type { MDXComponents } from "mdx/types";

/**
 * Global MDX component map. Custom teaching components and diagrams are
 * registered here (Tasks 4–6) so tutorial authors can use them by name
 * without per-file imports. Base markdown elements inherit styling from the
 * `.prose-tutorial` wrapper in globals.css.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
  };
}
