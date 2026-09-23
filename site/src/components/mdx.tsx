// Components the hand-written MDX pages can use, on top of Fumadocs' defaults.
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Note } from '@/components/note';
import { File, Files, Folder } from 'fumadocs-ui/components/files';
import type { MDXComponents } from 'mdx/types';
import type { ReactNode } from 'react';

/** A numbered sequence: wraps a Markdown ordered list. */
function Steps({ children }: { children: ReactNode }) {
  return <div className="[&>ol]:fd-steps [&>ol]:list-none [&>ol>li]:fd-step [&>ol>li]:ps-2">{children}</div>;
}

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return { ...defaultMdxComponents, Callout: Note, Files, Folder, File, Steps, ...components };
}
