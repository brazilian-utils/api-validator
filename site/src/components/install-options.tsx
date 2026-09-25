// How to install a library, from its config in libs/: one code block, or one tab per channel
// (npm, JSR for Deno, a CDN…) when the library has several, each with its note. And where it runs.
import { FlatTabs } from '@/components/flat-tabs';
import { type Locale, pick, translator } from '@/lib/i18n';
import { Markdown } from '@/lib/markdown';

type Text = string | { en: string; 'pt-BR': string };
export interface InstallOption {
  label: string;
  lang: string;
  code: string;
  note?: Text;
}
export interface Runtime {
  name: Text;
  supported: Text;
  tested?: Text;
}

const text = (v: Text | undefined, locale: Locale) => (typeof v === 'string' ? v : v ? pick(v, locale) : '');

function Option({ option, locale }: { option: InstallOption; locale: Locale }) {
  return (
    <>
      <Markdown source={'```' + option.lang + '\n' + option.code + '\n```'} />
      {option.note && (
        <div className="-mt-2 mb-4 text-sm text-fd-muted-foreground [&_p]:m-0">
          <Markdown source={text(option.note, locale)} />
        </div>
      )}
    </>
  );
}

export function InstallOptions({ options, locale, label }: { options: InstallOption[]; locale: Locale; label?: string }) {
  if (options.length === 1) return <Option option={options[0]} locale={locale} />;
  return (
    <FlatTabs
      groupId="install"
      persist
      variant="compact"
      label={label}
      className="[&_figure]:mt-0"
      items={options.map((o) => ({ value: o.label, label: o.label, content: <Option option={o} locale={locale} /> }))}
    />
  );
}

/** Where the library runs, as its README states it: runtime, supported range, what CI tests. */
export function Runtimes({ runtimes, locale }: { runtimes: Runtime[]; locale: Locale }) {
  if (!runtimes.length) return null;
  const t = translator(locale);
  const tested = runtimes.some((r) => r.tested);
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">{t('libs.runtime')}</th>
          <th scope="col">{t('libs.supported')}</th>
          {tested && <th scope="col">{t('libs.testedInCi')}</th>}
        </tr>
      </thead>
      <tbody>
        {runtimes.map((r, i) => (
          <tr key={i}>
            <td>{text(r.name, locale)}</td>
            <td>
              <code>{text(r.supported, locale)}</code>
            </td>
            {tested && <td>{text(r.tested, locale)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
