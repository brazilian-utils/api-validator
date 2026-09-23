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
}

type Slots = ReturnType<typeof useHomeLayout>['slots'];

function HeaderRow({ sections, title, homeUrl, prefix, github, slots, menu, className }: HeaderProps & { slots: Slots; menu: ReactNode; className: string }) {
  const base = (process.env.NEXT_PUBLIC_BASE ?? '') + prefix;
  const pathname = usePathname().replace(/\/$/, '');
  const path = pathname.startsWith(base) ? pathname.slice(base.length) || '/' : pathname;
  const active = sections.findIndex((s) => s.match.some((m) => path === m.replace(/\/$/, '') || path.startsWith(m)));
  return (
    <header className={`site-header z-40 flex h-14 items-center gap-2 px-4 md:px-6 ${className}`}>
      <Link href={homeUrl} className="me-4 inline-flex shrink-0 items-center">
        {title}
      </Link>
      <nav aria-label="Sections" className="flex items-center gap-6 max-lg:hidden">
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
      <div className="flex flex-1 items-center justify-end gap-1.5">
        {slots.searchTrigger && <slots.searchTrigger.full hideIfDisabled className="w-full max-w-60 rounded-full ps-2.5 max-md:hidden" />}
        {slots.searchTrigger && <slots.searchTrigger.sm hideIfDisabled className="p-2 md:hidden" />}
        <div className="flex items-center gap-1.5 max-md:hidden">
          {slots.themeSwitch && <slots.themeSwitch />}
          {slots.languageSelect && (
            <slots.languageSelect.root>
              <Languages className="size-4.5 text-fd-muted-foreground" />
            </slots.languageSelect.root>
          )}
          <a href={github.url} aria-label={github.label} target="_blank" rel="noopener" className={buttonVariants({ size: 'icon-sm', variant: 'ghost', className: 'text-fd-muted-foreground' })}>
            {github.icon}
          </a>
        </div>
        {menu}
      </div>
    </header>
  );
}

/** In the documentation: the grid's header row, full width; the menu opens the sidebar drawer. */
export function DocsHeader(props: HeaderProps) {
  const { slots } = useNotebookLayout();
  const Trigger = slots.sidebar?.trigger;
  return (
    <HeaderRow
      {...props}
      slots={slots}
      className="sticky top-(--fd-docs-row-1) [grid-area:header] [grid-column:1/-1] layout:[--fd-header-height:--spacing(14)]"
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
              <a href={props.github.url} aria-label={props.github.label} target="_blank" rel="noopener" className={buttonVariants({ size: 'icon-sm', variant: 'ghost', className: 'ms-auto text-fd-muted-foreground' })}>
                {props.github.icon}
              </a>
            </div>
          </PopoverContent>
        </Popover>
      }
    />
  );
}
