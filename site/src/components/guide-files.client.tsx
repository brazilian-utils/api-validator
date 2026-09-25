'use client';
// The files of a guide example: the code block's title bar holds one tab per file. The code is
// highlighted at build time and fetched as JSON (api/guide-code/…) the first time the example is
// in view, so a page with sixty files does not carry all of them; the file the page opens on is
// in the page itself (`inline`), so it shows with the page, JavaScript or not.
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { FlatTabs } from '@/components/flat-tabs';
import type { CodeHtml, GuideFile } from '@/lib/code-html';

type Loaded = Record<string, CodeHtml>;

const THEMES = 'shiki shiki-themes github-light-high-contrast github-dark-high-contrast';

/** `--shiki-light:#0e1116;--shiki-dark:#f0f3f6` as a style object. */
function styleOf(text: string): CSSProperties {
  const style: Record<string, string> = {};
  for (const part of text.split(';')) {
    const i = part.indexOf(':');
    if (i > 0) style[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return style as CSSProperties;
}

function Code({ code, title, text }: { code?: CodeHtml | null; title?: string; text: { loading: string; failed: string; retry: string } }) {
  return (
    <CodeBlock title={title} className={THEMES} style={code ? styleOf(code.style) : undefined} allowCopy={!!code}>
      {code ? (
        <Pre>
          <code dangerouslySetInnerHTML={{ __html: code.html }} />
        </Pre>
      ) : (
        <p role="status" className="flex h-32 items-center justify-center text-fd-muted-foreground">
          {code === null ? text.failed : text.loading}
        </p>
      )}
    </CodeBlock>
  );
}

export function GuideFiles({ url, files, inline, text }: { url: string; files: GuideFile[]; inline?: CodeHtml; text: { loading: string; failed: string; retry: string } }) {
  const root = useRef<HTMLDivElement>(null);
  // undefined: not fetched yet; null: the fetch failed.
  const [loaded, setLoaded] = useState<Loaded | null | undefined>(inline ? { [files[0].name]: inline } : undefined);
  const [attempt, setAttempt] = useState(0);
  const complete = !!loaded && files.every((f) => f.name in loaded);

  // Fetched once the example is in view: a hidden tab never is, so it costs nothing until chosen.
  useEffect(() => {
    if (complete || !root.current) return;
    const el = root.current;
    let cancelled = false;
    const load = () =>
      fetch(url)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
        .then((json: Loaded) => !cancelled && setLoaded(json))
        .catch(() => !cancelled && setLoaded(null));
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      void load();
    });
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [url, complete, attempt]);

  const retry = loaded === null && (
    <p className="mt-2 text-sm text-fd-muted-foreground">
      <button type="button" onClick={() => setAttempt((n) => n + 1)} className="underline underline-offset-4 hover:text-fd-foreground">
        {text.retry}
      </button>
    </p>
  );

  if (files.length === 1) {
    return (
      <div ref={root}>
        <Code code={loaded && files[0].name in loaded ? loaded[files[0].name] : loaded === null ? null : undefined} title={files[0].name} text={text} />
        {retry}
      </div>
    );
  }
  return (
    <div ref={root}>
      <FlatTabs variant="file" items={files.map((f) => ({ value: f.name, label: f.name, content: <Code code={loaded && f.name in loaded ? loaded[f.name] : loaded === null ? null : undefined} text={text} /> }))} />
      {retry}
    </div>
  );
}
