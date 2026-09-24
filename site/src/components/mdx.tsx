// Components the hand-written MDX pages can use, on top of Fumadocs' defaults.
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Note } from '@/components/note';
import { File, Files, Folder } from 'fumadocs-ui/components/files';
import type { MDXComponents } from 'mdx/types';
import type { ReactNode } from 'react';
import { FlatTabs } from '@/components/flat-tabs';
import { LangIcon } from '@/components/lang-icon';
import { libNames, loadLibs } from '@/lib/data';
import { Team } from '@/components/team';
import { InstallOptions } from '@/components/install-options';
import type { Locale } from '@/lib/i18n';

/** A numbered sequence: wraps a Markdown ordered list. */
function Steps({ children }: { children: ReactNode }) {
  return <div className="[&>ol]:fd-steps [&>ol]:list-none [&>ol>li]:fd-step [&>ol>li]:ps-2">{children}</div>;
}

/** The install commands of each library, in the site's language tabs (the reader's choice sticks);
 *  a library with several channels (npm, JSR, a CDN) shows one compact tab per channel. */
function InstallTabs({ label = 'Library', locale }: { label?: string; locale: Locale }) {
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
        content: <InstallOptions options={lib.installs} locale={locale} />,
      }))}
    />
  );
}

export function getMDXComponents(locale: Locale = 'en', components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Callout: Note,
    Files,
    Folder,
    File,
    Steps,
    InstallTabs: (props: { label?: string }) => <InstallTabs {...props} locale={locale} />,
    Team,
    /** The libraries by name, in a sentence: "JavaScript, Python, Go, … and Erlang". */
    LibNames: () => <>{libNames(locale)}</>,
    ...components,
  };
}
