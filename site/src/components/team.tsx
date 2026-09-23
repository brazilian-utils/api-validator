// The About > Team page's people: the lead, the partner organizations and who works on each
// library (src/content/team.json), with each library's full list of contributors on GitHub.
import Link from '@/components/link';
import { LangIcon } from '@/components/lang-icon';
import { loadLibs } from '@/lib/data';
import { type Locale, pick, prefixOf } from '@/lib/i18n';
import team from '@/content/team.json';

type Text = { en: string; 'pt-BR': string };
type Person = { name: string; login?: string; role?: Text; url?: string; since?: number };

const L = (locale: Locale, en: string, pt: string) => (locale === 'en' ? en : pt);

function Avatar({ person, size }: { person: Person; size: number }) {
  if (person.login) {
    // eslint-disable-next-line @next/next/no-img-element -- a static export has no image optimizer; GitHub serves the size asked for
    return <img src={`https://github.com/${person.login}.png?size=${size * 2}`} alt="" width={size} height={size} loading="lazy" className="shrink-0 rounded-full bg-fd-muted" />;
  }
  const initials = person.name
    .split(' ')
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
  return (
    <span aria-hidden style={{ width: size, height: size }} className="inline-flex shrink-0 items-center justify-center rounded-full bg-fd-muted text-xs font-medium text-fd-muted-foreground">
      {initials}
    </span>
  );
}

function Card({ person, locale }: { person: Person; locale: Locale }) {
  const href = person.url ?? (person.login ? `https://github.com/${person.login}` : undefined);
  return (
    <li className="flex items-start gap-4 rounded-xl border bg-fd-card p-4">
      <Avatar person={person} size={56} />
      <div className="min-w-0">
        <p className="font-medium">{href ? <a href={href}>{person.name}</a> : person.name}</p>
        {person.login && <p className="text-sm text-fd-muted-foreground">@{person.login}</p>}
        {person.role && <p className="mt-1.5 text-sm text-fd-muted-foreground">{pick(person.role, locale)}</p>}
        {person.since && <p className="mt-1 text-xs text-fd-muted-foreground">{L(locale, `Since ${person.since}`, `Desde ${person.since}`)}</p>}
      </div>
    </li>
  );
}

export function Team({ locale = 'en', part }: { locale?: Locale; part: 'lead' | 'partners' | 'libraries' }) {
  if (part !== 'libraries') {
    return (
      <ul className="not-prose my-6 grid gap-3 sm:grid-cols-2">
        {(team[part] as Person[]).map((p) => (
          <Card key={p.name} person={p} locale={locale} />
        ))}
      </ul>
    );
  }
  const libs = new Map(loadLibs().map((l: any) => [l.id, l]));
  return (
    <ul className="not-prose my-6 flex flex-col divide-y border-y">
      {team.libraries.map((entry) => {
        const lib: any = libs.get(entry.lib);
        if (!lib) return null;
        const note = 'note' in entry ? (entry.note as Text) : undefined;
        return (
          <li key={entry.lib} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:gap-6">
            <Link href={`${prefixOf(locale)}/libs/${lib.id}/`} className="inline-flex w-32 shrink-0 items-center gap-2 font-medium hover:underline">
              <LangIcon lib={lib.id} className="size-4" />
              {lib.label}
            </Link>
            <div className="min-w-0 flex-1">
              <ul className="flex flex-wrap gap-x-5 gap-y-2">
                {(entry.people as Person[]).map((p) => (
                  <li key={p.name} className="inline-flex items-center gap-2 text-sm">
                    <Avatar person={p} size={28} />
                    {p.login ? <a href={`https://github.com/${p.login}`} className="hover:underline">{p.name}</a> : p.name}
                  </li>
                ))}
              </ul>
              {note && <p className="mt-2 text-sm text-fd-muted-foreground">{pick(note, locale)}</p>}
              <a href={`https://github.com/${lib.repo}/graphs/contributors`} className="mt-1 inline-block text-sm text-fd-muted-foreground underline underline-offset-4 hover:text-fd-foreground">
                {L(locale, 'Everyone who contributed', 'Todas as pessoas que contribuíram')}
              </a>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
