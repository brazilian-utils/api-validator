// The frame of every documentation page: the site header (logo, sections, search, theme,
// language) above the sidebar and the page.
import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import type { ReactNode } from 'react';
import { baseOptions, headerProps } from '@/lib/layout';
import { DocsHeader } from '@/components/site-header.client';
import { pageTree } from '@/lib/tree';
import type { Locale } from '@/lib/i18n';

export function DocsShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const base = baseOptions(locale);
  return (
    <DocsLayout
      {...base}
      tree={pageTree(locale)}
      tabMode="navbar"
      // The site's own header, the same as the home page's (site-header.client.tsx).
      nav={{ ...base.nav, mode: 'top', component: <DocsHeader {...headerProps(locale)} /> }}
      // No prefetch of the ~50 sidebar links: a static host pays for each one.
      sidebar={{ prefetch: false }}
    >
      {children}
    </DocsLayout>
  );
}
