'use client';
// A library's live demo (an HTML page it ships, copied to public/lib-assets/<lib>/). Loads when
// shown and takes the height the demo reports with
// `parent.postMessage({ type: 'example-height', height }, origin)`.
import { ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function LiveDemo({ src, title, text }: { src: string; title?: string; text: { demo: string; demoOf: string; open: string } }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(160);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.data?.type !== 'example-height' || event.source !== frame.current?.contentWindow) return;
      setHeight(Math.max(80, Number(event.data.height) || 0));
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
      <iframe ref={frame} src={src} title={caption} loading="lazy" style={{ height }} className="block w-full rounded-lg bg-white" />
    </figure>
  );
}
