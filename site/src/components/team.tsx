// The About > Team page's people (src/content/team.json): one row each, between rules.
import { type Locale, pick } from '@/lib/i18n';
import team from '@/content/team.json';

type Person = { name: string; login: string; role: { en: string; 'pt-BR': string }; cumbucadev?: boolean };

export function Team({ locale = 'en' }: { locale?: Locale }) {
  return (
    <ul className="not-prose my-6 divide-y border-y">
      {(team.people as Person[]).map((p) => (
        <li key={p.login} className="flex items-center gap-4 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- a static export has no image optimizer; GitHub serves the size asked for */}
          <img src={`https://github.com/${p.login}.png?size=112`} alt="" width={56} height={56} loading="lazy" className="shrink-0 rounded-full bg-fd-muted" />
          <div className="min-w-0">
            <p className="font-medium">
              <a href={`https://github.com/${p.login}`}>{p.name}</a>
            </p>
            <p className="text-sm text-fd-muted-foreground">
              {pick(p.role, locale)}
              {p.cumbucadev && ' · Cumbuca Dev'}
              {' · '}@{p.login}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
