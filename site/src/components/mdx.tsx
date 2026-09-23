// Components the hand-written MDX pages can use, on top of Fumadocs' defaults.
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Note } from '@/components/note';
import { File, Files, Folder } from 'fumadocs-ui/components/files';
import type { MDXComponents } from 'mdx/types';
import type { ReactNode } from 'react';
import { FlatTabs } from '@/components/flat-tabs';
import { LangIcon } from '@/components/lang-icon';
import { loadLibs } from '@/lib/data';
import { Markdown } from '@/lib/markdown';

/** A numbered sequence: wraps a Markdown ordered list. */
function Steps({ children }: { children: ReactNode }) {
  return <div className="[&>ol]:fd-steps [&>ol]:list-none [&>ol>li]:fd-step [&>ol>li]:ps-2">{children}</div>;
}

/** The install command of each library, in the site's language tabs (the reader's choice sticks). */
function InstallTabs({ label = 'Library' }: { label?: string }) {
  return (
    <FlatTabs
      groupId="lang"
      persist
      label={label}
      items={loadLibs().map((lib: any) => ({
        value: lib.id,
        label: (
          <>
            <LangIcon lib={lib.id} className="size-3.5" />
            {lib.label}
          </>
        ),
        content: <Markdown source={'```sh\n' + lib.install + '\n```'} />,
      }))}
    />
  );
}

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return { ...defaultMdxComponents, Callout: Note, Files, Folder, File, Steps, InstallTabs, ...components };
}
