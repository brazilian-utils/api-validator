'use client';
// A library's live demo (an HTML page it ships, copied to public/lib-assets/<lib>/). Loads when
// shown and takes the height the demo reports with
// `parent.postMessage({ type: 'example-height', height }, origin)`. Until that first message the
// frame is covered by a loading line (until it loads, at the latest), so a demo never shows up
// as an empty box.
import { ExternalLink, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function LiveDemo({ src, title, text }: { src: string; title?: string; text: { demo: string; demoOf: string; open: string; loading: string } }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(160);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.data?.type !== 'example-height' || event.source !== frame.current?.contentWindow) return;
      setHeight(Math.max(80, Number(event.data.height) || 0));
      setReady(true);
    };
    addEventListener('message', onMessage);
    return () => removeEventListener('message', onMessage);
  }, []);
  const caption = title ? text.demoOf.replace('{title}', title) : text.demo;
  return (
    <figure className="not-prose my-4">
      <figcaption className="mb-2 flex items-center gap-2 text-xs text-fd-muted-foreground">
        {caption}
        <a href={src} target="_blank" rel="noopener" className="ms-auto inline-flex items-center gap-1 hover:text-fd-foreground">
          {text.open}
          {title && <span className="sr-only"> ({title})</span>}
          <ExternalLink aria-hidden className="size-3" />
        </a>
      </figcaption>
      <div className="relative">
        <iframe
          ref={frame}
          src={src}
          title={caption}
          loading="lazy"
          style={{ height }}
          // The page loaded (it may have posted its height before this component hydrated, or be a
          // demo that never posts): take its height when it is same-origin and drop the overlay.
          onLoad={() => {
            try {
              const h = frame.current?.contentDocument?.body?.scrollHeight;
              if (h) setHeight(Math.max(80, h));
            } catch {}
            setReady(true);
          }}
          className="block w-full rounded-lg bg-white ring-1 ring-fd-border"
        />
        {!ready && (
          <p role="status" className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg border bg-fd-card text-sm text-fd-muted-foreground">
            <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
            {text.loading}
          </p>
        )}
      </div>
    </figure>
  );
}
