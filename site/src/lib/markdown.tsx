// Markdown from the contract and the libraries (usage files, spec prose), rendered at build time
// with the same code blocks as the rest of the site (Shiki, copy button).
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import { rehypeCode } from 'fumadocs-core/mdx-plugins/rehype-code';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import defaultMdxComponents from 'fumadocs-ui/mdx';

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeCode, {
  // High-contrast variants: every token meets AA on the code block background.
  themes: { light: 'github-light-high-contrast', dark: 'github-dark-high-contrast' },
});

/** Removes a YAML front matter block. */
export const stripFrontMatter = (text: string) => text.replace(/^---\n[\s\S]*?\n---\n?/, '');

export async function Markdown({ source, components }: { source: string; components?: Record<string, unknown> }) {
  const tree = await processor.run(processor.parse(stripFrontMatter(source)));
  return toJsxRuntime(tree as never, {
    Fragment,
    jsx: jsx as never,
    jsxs: jsxs as never,
    components: { ...defaultMdxComponents, ...components } as never,
  });
}
