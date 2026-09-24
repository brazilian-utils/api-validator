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
import { type Locale, prefixOf, translator } from '@/lib/i18n';
import Link from '@/components/link';

/** A numbered sequence: wraps a Markdown ordered list. */
function Steps({ children }: { children: ReactNode }) {
  return <div className="[&>ol]:fd-steps [&>ol]:list-none [&>ol>li]:fd-step [&>ol>li]:ps-2">{children}</div>;
}

/** The install commands of each library, in the site's language tabs (the reader's choice sticks);
 *  a library with several channels (npm, JSR, a CDN) shows one compact tab per channel. Under
 *  them, where the package and the code live, and the library's own page. */
function InstallTabs({ label = 'Library', locale }: { label?: string; locale: Locale }) {
  const t = translator(locale);
  const p = prefixOf(locale);
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
        content: (
          <>
            <InstallOptions options={lib.installs} locale={locale} />
            <p className="not-prose flex flex-wrap gap-x-5 gap-y-1 text-sm text-fd-muted-foreground">
              <span>
                {t('lib.package')}{' '}
                <a href={lib.registry} className="text-fd-foreground underline underline-offset-4">
                  {lib.package}
                </a>
              </span>
              <span>
                {t('lib.repository')}{' '}
                <a href={`https://github.com/${lib.repo}`} className="text-fd-foreground underline underline-offset-4">
                  github.com/{lib.repo}
                </a>
              </span>
              <Link href={`${p}/libs/${lib.id}/`} className="font-medium text-fd-foreground hover:underline">
                {t('install.libPage', { lib: lib.label })}
              </Link>
            </p>
          </>
        ),
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
