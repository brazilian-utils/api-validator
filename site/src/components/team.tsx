// The About > Team page's people (src/content/team.json), one card each, like the team pages of
// Vue and VitePress: the picture, the name, the role, where the person comes from, and GitHub.
import { type Locale, pick } from '@/lib/i18n';
import { siGithub } from 'simple-icons';
import { ArrowRight, Plus } from 'lucide-react';
import team from '@/content/team.json';

type Person = { name: string; login: string; role: { en: string; 'pt-BR': string }; cumbucadev?: boolean };

// Pictures GitHub serves at the size asked for: a static export has no image optimizer.
/* eslint-disable @next/next/no-img-element */
export function Team({ locale = 'en' }: { locale?: Locale }) {
  return (
    <ul className="not-prose my-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {(team.people as Person[]).map((p) => (
        <li key={p.login} className="flex flex-col items-center rounded-xl border bg-fd-card px-6 pt-8 pb-5 text-center">
          <img
            src={`https://github.com/${p.login}.png?size=192`}
            alt=""
            width={96}
            height={96}
            loading="lazy"
            className="size-24 rounded-full bg-fd-muted ring-1 ring-fd-border"
          />
          <p className="mt-4 text-lg font-semibold tracking-[-0.01em]">{p.name}</p>
          <p className="mt-0.5 text-sm text-fd-muted-foreground">{pick(p.role, locale)}</p>
          {p.cumbucadev && (
            <a href="https://github.com/cumbucadev" className="mt-3 inline-flex items-center gap-2 whitespace-nowrap rounded-full border bg-fd-background px-3 py-1 text-xs font-medium transition-colors hover:border-fd-primary hover:text-fd-primary">
              <img src="https://github.com/cumbucadev.png?size=40" alt="" width={16} height={16} loading="lazy" className="size-4 rounded-sm bg-fd-muted" />
              Cumbuca Dev
            </a>
          )}
          <a
            href={`https://github.com/${p.login}`}
            aria-label={`GitHub: ${p.name} (@${p.login})`}
            className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" className="size-4">
              <path d={siGithub.path} />
            </svg>
            @{p.login}
          </a>
        </li>
      ))}
      {/* The last card is an invitation: start contributing; the section below says how people join. */}
      <li>
        <a
          href={locale === 'en' ? '#join-the-team' : '#entre-para-o-time'}
          className="group flex h-full flex-col items-center rounded-xl border-2 border-dashed px-6 pt-8 pb-5 text-center transition-colors hover:border-fd-primary"
        >
          <span className="flex size-24 items-center justify-center rounded-full border-2 border-dashed text-fd-muted-foreground transition-colors group-hover:border-fd-primary group-hover:text-fd-primary">
            <Plus aria-hidden className="size-8" />
          </span>
          <span className="mt-4 text-lg font-semibold tracking-[-0.01em]">{locale === 'en' ? 'You?' : 'Você?'}</span>
          <span className="mt-0.5 text-sm text-fd-muted-foreground text-balance">
            {locale === 'en' ? 'Everyone here started with a first contribution. Yours could be next.' : 'Todo mundo aqui começou com uma primeira contribuição. A próxima pode ser a sua.'}
          </span>
          <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-medium text-fd-primary">
            {locale === 'en' ? 'How to take part' : 'Como participar'}
            <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </span>
        </a>
      </li>
    </ul>
  );
}
