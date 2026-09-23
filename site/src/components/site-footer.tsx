// The site's footer, the same under the home page and under every documentation page.
import Link from '@/components/link';
import { type Locale, prefixOf } from '@/lib/i18n';

const L = (locale: Locale, en: string, pt: string) => (locale === 'en' ? en : pt);

export function SiteFooter({ locale }: { locale: Locale }) {
  const p = prefixOf(locale);
  return (
    <footer className="band band-top">
      <div className="mx-auto flex w-full max-w-(--site-width) flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-fd-muted-foreground sm:px-6">
        <p>Brazilian Utils</p>
        <nav aria-label={L(locale, 'Footer', 'Rodapé')} className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href={`${p}/reference/parity/`} className="hover:text-fd-foreground">{L(locale, 'Parity matrix', 'Matriz de paridade')}</Link>
          <Link href={`${p}/contributing/specs/`} className="hover:text-fd-foreground">{L(locale, 'Contributing', 'Como contribuir')}</Link>
          <Link href={`${p}/about/faq/`} className="hover:text-fd-foreground">{L(locale, 'About', 'Sobre')}</Link>
          <a href="https://github.com/brazilian-utils" className="hover:text-fd-foreground">GitHub</a>
        </nav>
      </div>
    </footer>
  );
}
