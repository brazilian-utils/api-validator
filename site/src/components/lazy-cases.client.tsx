'use client';
// The disclosure of a function's shared test cases: the same <details> as Disclosure, whose table
// arrives (api/cases/…, JSON made at build time) the first time it is opened. Without JavaScript
// it opens on a link to the JSON suite instead.
import { ChevronRight } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { LangIcon } from '@/components/lang-icon';
import { StatusIcon } from '@/components/status';
import type { CasesData } from '@/lib/cases-data';

function Table({ data }: { data: CasesData }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th scope="col" className="px-2 py-1.5 text-start font-medium">{data.input}</th>
            <th scope="col" className="px-2 py-1.5 text-start font-medium">{data.expected}</th>
            {data.libs.map((lib) => (
              <th key={lib.id} scope="col" className="w-8 px-2 py-1.5 text-center font-medium" title={lib.label}>
                <span role="img" aria-label={lib.label} className="inline-flex justify-center"><LangIcon lib={lib.id} /></span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.id} className="border-b">
              <td className="px-2 py-1.5 text-start align-top">
                <code className="whitespace-nowrap">{row.args}</code>
                {row.note && <div className="mt-1 min-w-40 text-xs text-fd-muted-foreground">{row.note}</div>}
              </td>
              <td className="px-2 py-1.5 text-start align-top"><code className="whitespace-nowrap">{row.expected}</code></td>
              {row.results.map(([status, label], i) => (
                <td key={data.libs[i].id} className="w-8 px-2 py-1.5 text-center align-top">
                  <span className="inline-flex justify-center" title={label}><StatusIcon status={status} label={label} /></span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LazyCases({ id, url, title, text, fallback }: { id: string; url: string; title: ReactNode; text: { loading: string; failed: string; retry: string }; fallback: ReactNode }) {
  // undefined: not fetched yet; null: the fetch failed.
  const [data, setData] = useState<CasesData | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const load = () => {
    setLoading(true);
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((json: CasesData) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };
  return (
    <details
      id={id}
      className="group not-prose border-t last:border-b [&[open]>summary>svg]:rotate-90"
      onToggle={(event) => {
        if (event.currentTarget.open && data === undefined && !loading) load();
      }}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 py-3 text-sm font-medium select-none hover:text-fd-primary [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="size-4 shrink-0 text-fd-muted-foreground transition-transform motion-reduce:transition-none" />
        {title}
      </summary>
      <div className="pb-5 ps-6">
        {data ? (
          <Table data={data} />
        ) : data === null ? (
          <p role="status" className="text-sm text-fd-muted-foreground">
            {text.failed}{' '}
            <button type="button" onClick={load} className="underline underline-offset-4 hover:text-fd-foreground">
              {text.retry}
            </button>
          </p>
        ) : loading ? (
          <p role="status" className="text-sm text-fd-muted-foreground">
            {text.loading}
          </p>
        ) : (
          fallback
        )}
      </div>
    </details>
  );
}
