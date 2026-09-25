'use client';
// The previous and next pages at the end of a documentation page: two plain links between rules,
// each on its own side, in place of Fumadocs' boxed pager.
import Link from '@/components/link';
import type { FooterProps } from 'fumadocs-ui/layouts/notebook/page/slots/footer';
import { useFooterItems } from 'fumadocs-ui/utils/use-footer-items';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { translator } from '@/lib/i18n';

const clean = (url: string) => url.replace(/\/$/, '');

export function DocsPager({ items }: FooterProps) {
  const list = useFooterItems();
  const base = process.env.NEXT_PUBLIC_BASE ?? '';
  const path = clean(usePathname()).replace(new RegExp(`^${base}`), '');
  const idx = list.findIndex((item) => clean(item.url) === path);
  const previous = items?.previous ?? (idx > 0 ? list[idx - 1] : undefined);
  const next = items?.next ?? (idx >= 0 ? list[idx + 1] : undefined);
  if (!previous && !next) return null;
  const t = translator(path === '/pt-br' || path.startsWith('/pt-br/') ? 'pt-BR' : 'en');
  return (
    <nav aria-label={t('pager.label')} className="not-prose mt-4 flex items-start justify-between gap-6 border-t pt-5 text-sm">
      {previous ? (
        <Link href={previous.url} className="group inline-flex items-center gap-2 font-medium text-fd-muted-foreground hover:text-fd-foreground">
          <ArrowLeft aria-hidden className="size-4 shrink-0 transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none" />
          {previous.name}
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={next.url} className="group inline-flex items-center gap-2 text-end font-medium text-fd-muted-foreground hover:text-fd-foreground">
          {next.name}
          <ArrowRight aria-hidden className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </Link>
      )}
    </nav>
  );
}
