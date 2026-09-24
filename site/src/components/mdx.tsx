// Components the hand-written MDX pages can use, on top of Fumadocs' defaults.
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Note } from '@/components/note';
import { File, Files, Folder } from 'fumadocs-ui/components/files';
import type { MDXComponents } from 'mdx/types';
import type { ReactNode } from 'react';
import { FlatTabs } from '@/components/flat-tabs';
import { LangIcon } from '@/components/lang-icon';
import { libNames, loadLibs } from '@/lib/data';
import { LangIcon as Icon } from '@/components/lang-icon';
import { Team } from '@/components/team';
import { InstallOptions } from '@/components/install-options';
import { type Locale, pick, prefixOf, translator } from '@/lib/i18n';
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

/** Where to contribute to each library: its repository, its own contributing guide when it has
 *  one (else its issues), and its page here. From libs/, so a new language lists itself. */
function LibsContributing({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const p = prefixOf(locale);
  return (
    <ul className="not-prose my-6 grid gap-3 sm:grid-cols-2">
      {loadLibs().map((lib: any) => {
        const guide = typeof lib.contributing === 'string' ? lib.contributing : lib.contributing ? pick(lib.contributing, locale) : undefined;
        return (
          <li key={lib.id} className="flex flex-col gap-1.5 rounded-xl border bg-fd-card px-4 py-3">
            <span className="inline-flex items-center gap-2 font-semibold">
              <Icon lib={lib.id} className="size-4" />
              {lib.label}
            </span>
            <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {guide ? (
                <a href={guide} className="underline underline-offset-4">
                  {t('contrib.guide')}
                </a>
              ) : (
                <a href={`https://github.com/${lib.repo}/issues`} className="underline underline-offset-4">
                  {t('contrib.issues')}
                </a>
              )}
              <a href={`https://github.com/${lib.repo}`} className="text-fd-muted-foreground hover:text-fd-foreground">
                github.com/{lib.repo}
              </a>
              <Link href={`${p}/libs/${lib.id}/`} className="text-fd-muted-foreground hover:text-fd-foreground">
                {t('contrib.gaps')}
              </Link>
            </span>
          </li>
        );
      })}
    </ul>
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
    LibsContributing: () => <LibsContributing locale={locale} />,
    ...components,
  };
}
