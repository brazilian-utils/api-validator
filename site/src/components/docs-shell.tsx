// The frame of every documentation page: a full-width header (logo, section tabs, search,
// language, theme) above the sidebar and the page.
import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import type { ReactNode } from 'react';
import { baseOptions } from '@/lib/layout';
import { pageTree } from '@/lib/tree';
import type { Locale } from '@/lib/i18n';

export function DocsShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const base = baseOptions(locale);
  return (
    <DocsLayout
      {...base}
      tree={pageTree(locale)}
      tabMode="navbar"
      nav={{ ...base.nav, mode: 'top' }}
      // No prefetch of the ~50 sidebar links: a static host pays for each one.
      sidebar={{ prefetch: false }}
    >
      {children}
    </DocsLayout>
  );
}
