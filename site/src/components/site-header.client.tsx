'use client';
// The one header of the site, the same on the home page and in the documentation: the logo, the
// sections of the documentation, search, theme, language and GitHub, in one row that never
// changes height or place between pages. On a phone, the sections move into a menu: the
// sidebar drawer in the documentation (it has a section switcher), a short list on the home page.
import Link from '@/components/link';
import { useHomeLayout } from 'fumadocs-ui/layouts/home';
import { useNotebookLayout } from 'fumadocs-ui/layouts/notebook';
import { Popover, PopoverContent, PopoverTrigger } from 'fumadocs-ui/components/ui/popover';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { usePathname } from 'next/navigation';
import { Languages, Menu, Sidebar } from 'lucide-react';
import type { ReactNode } from 'react';

export interface Section {
  title: string;
  url: string;
  /** Paths (after the language prefix) that belong to the section. */
  match: string[];
}

interface HeaderProps {
  sections: Section[];
  /** The logo, linking home. */
  title: ReactNode;
  homeUrl: string;
  /** Path prefix of the language (`/pt-br`), to match the sections. */
  prefix: string;
  github: { url: string; label: string; icon: ReactNode };
  menuLabel: string;
  /** Accessible name of the section links. */
  sectionsLabel: string;
  /** "Skip to content", the first thing the keyboard reaches. */
  skipLabel: string;
}

type Slots = ReturnType<typeof useHomeLayout>['slots'];

function HeaderRow({ sections, sectionsLabel, skipLabel, title, homeUrl, prefix, github, slots, menu, className, main }: HeaderProps & { slots: Slots; menu: ReactNode; className: string; main: string }) {
  const base = (process.env.NEXT_PUBLIC_BASE ?? '') + prefix;
  const pathname = usePathname().replace(/\/$/, '');
  const path = pathname.startsWith(base) ? pathname.slice(base.length) || '/' : pathname;
  const active = sections.findIndex((s) => s.match.some((m) => path === m.replace(/\/$/, '') || path.startsWith(m)));
  // Laid out like vuejs.org: the logo with search beside it; the sections, then the settings and
  // GitHub, on the right, each group set off by a thin divider.
  const divider = <span aria-hidden className="mx-3 h-6 w-px bg-fd-border max-md:hidden" />;
  // The bar spans the window; its content sits in the site's column, with the page's edges.
  return (
    <header className={`site-header z-40 ${className}`}>
      {/* Keyboard users go past the header in one step (WCAG 2.4.1); the link shows only when focused.
          Positioned inside the bar (never a line of its own, which would change the bar's height). */}
      <a href={`#${main}`} className="absolute top-0 left-0 z-50 size-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)] focus:top-2 focus:left-2 focus:size-auto focus:rounded-md focus:bg-fd-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:[clip-path:none]">
        {skipLabel}
      </a>
      <div className="mx-auto flex h-14 w-full max-w-(--site-width) items-center gap-2 px-4 sm:px-6">
        <Link href={homeUrl} className="inline-flex shrink-0 items-center">
          {title}
        </Link>
        {slots.searchTrigger && <slots.searchTrigger.full hideIfDisabled className="ms-4 w-full max-w-56 rounded-full ps-2.5 max-md:hidden" />}
        <div className="flex flex-1 items-center justify-end gap-1">
          <nav aria-label={sectionsLabel} className="flex items-center gap-6 max-lg:hidden">
            {sections.map((s, i) => (
              <Link
                key={s.url}
                href={s.url}
                aria-current={i === active ? 'page' : undefined}
                className="text-sm font-medium text-fd-muted-foreground transition-colors hover:text-fd-foreground aria-[current=page]:text-fd-primary"
              >
                {s.title}
              </Link>
            ))}
          </nav>
          <span aria-hidden className="mx-3 h-6 w-px bg-fd-border max-lg:hidden" />
          {slots.searchTrigger && <slots.searchTrigger.sm hideIfDisabled className="p-2 md:hidden" />}
          <div className="flex items-center gap-1.5 max-md:hidden">
            {slots.themeSwitch && <slots.themeSwitch />}
            {slots.languageSelect && (
              <slots.languageSelect.root>
                <Languages className="size-4.5 text-fd-muted-foreground" />
              </slots.languageSelect.root>
            )}
          </div>
          {divider}
          <a
            href={github.url}
            aria-label={github.label}
            target="_blank"
            rel="noopener"
            className={buttonVariants({ size: 'icon-sm', variant: 'ghost', className: 'text-fd-muted-foreground max-md:hidden' })}
          >
            {github.icon}
          </a>
          {menu}
        </div>
      </div>
    </header>
  );
}

/** In the documentation: the grid's header row, full width (its content does not size the grid's
 * columns); the menu opens the sidebar drawer. */
export function DocsHeader(props: HeaderProps) {
  const { slots } = useNotebookLayout();
  const Trigger = slots.sidebar?.trigger;
  return (
    <HeaderRow
      {...props}
      slots={slots}
      main="nd-page"
      className="sticky top-(--fd-docs-row-1) [grid-area:header] [grid-column:1/-1]! [contain:inline-size] layout:[--fd-header-height:--spacing(14)]"
      menu={
        Trigger && (
          <Trigger aria-label={props.menuLabel} className={buttonVariants({ variant: 'ghost', size: 'icon-sm', className: '-me-1.5 p-2 text-fd-muted-foreground lg:hidden' })}>
            <Sidebar />
          </Trigger>
        )
      }
    />
  );
}

/** On the home page: the same row; the menu is a list of the sections, theme and language. */
export function HomeHeader(props: HeaderProps) {
  const { slots } = useHomeLayout();
  return (
    <HeaderRow
      {...props}
      slots={slots}
      main="nd-home-layout"
      className="sticky top-0"
      menu={
        <Popover>
          <PopoverTrigger aria-label={props.menuLabel} className={buttonVariants({ variant: 'ghost', size: 'icon-sm', className: '-me-1.5 p-2 text-fd-muted-foreground lg:hidden' })}>
            <Menu />
          </PopoverTrigger>
          <PopoverContent align="end" className="flex w-56 flex-col gap-1 bg-fd-popover p-2 backdrop-blur-none">
            {props.sections.map((s) => (
              <Link key={s.url} href={s.url} className="rounded-md px-2 py-1.5 text-sm font-medium hover:bg-fd-accent">
                {s.title}
              </Link>
            ))}
            <div className="mt-1 flex items-center gap-1.5 border-t px-1 pt-2 md:hidden">
              {slots.themeSwitch && <slots.themeSwitch />}
              {slots.languageSelect && (
                <slots.languageSelect.root>
                  <Languages className="size-4.5 text-fd-muted-foreground" />
                </slots.languageSelect.root>
              )}
              <a
                href={props.github.url}
                aria-label={props.github.label}
                target="_blank"
                rel="noopener"
                className={buttonVariants({ size: 'icon-sm', variant: 'ghost', className: 'ms-auto text-fd-muted-foreground' })}
              >
                {props.github.icon}
              </a>
            </div>
          </PopoverContent>
        </Popover>
      }
    />
  );
}
