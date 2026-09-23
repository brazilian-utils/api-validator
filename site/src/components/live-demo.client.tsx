'use client';
// A library's live demo (an HTML page it ships, copied to public/lib-assets/<lib>/), in a frame
// that looks like the page around it. The demo is same-origin, so once it loads the page hands it
// its palette and fonts and a stylesheet for the plain controls the demos use (label, input,
// select, output, the message under a field, button), and keeps its theme in step. The frame
// takes the demo's height, measured here or reported by the demo with
// `parent.postMessage({ type: 'example-height', height }, origin)`, and starts at the last height
// a demo had, so switching between examples does not make the page jump.
import { ExternalLink, LoaderCircle } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const TOKENS = ['background', 'foreground', 'card', 'muted-foreground', 'border', 'primary', 'primary-foreground', 'ring']
  .map((t) => `--color-fd-${t}`)
  .concat('--color-fail', '--color-ok', '--font-geist-sans', '--font-geist-mono', '--font-sans', '--font-mono');

// Addressed by element, as the demos carry no classes; later in the cascade than the demo's own.
const CSS = `
:root { color-scheme: var(--scheme); }
html, body { margin: 0; min-height: 0; height: auto; overflow: hidden; background: transparent; }
body {
  box-sizing: border-box; padding: 20px; color: var(--color-fd-foreground);
  font: 14px/1.5 var(--font-sans); -webkit-font-smoothing: antialiased;
}
*, *::before, *::after { box-sizing: border-box; }
label { font-weight: 500; font-size: 13px; color: var(--color-fd-foreground); }
input, select {
  font: 15px/1.4 var(--font-mono); padding: 7px 10px; color: var(--color-fd-foreground);
  background: var(--color-fd-background); border: 1px solid var(--color-fd-border); border-radius: 8px;
  transition: border-color .15s, box-shadow .15s;
}
select { font-family: var(--font-sans); font-size: 14px; }
input::placeholder { color: var(--color-fd-muted-foreground); opacity: .7; }
input:focus, select:focus {
  outline: none; border-color: var(--color-fd-ring);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-fd-ring) 25%, transparent);
}
input:disabled, select:disabled { opacity: .55; }
input[aria-invalid="true"] { border-color: var(--color-fail); }
p, output { margin: 0; font-size: 13px; color: var(--color-fd-muted-foreground); }
input[aria-invalid="true"] + p, p[role="alert"]:not(:empty) { color: var(--color-fail); }
output:not(:empty) { color: var(--color-fd-primary); }
button {
  font: 500 13px/1 var(--font-sans); padding: 9px 14px; border: 0; border-radius: 8px; cursor: pointer;
  color: var(--color-fd-primary-foreground); background: var(--color-fd-primary); transition: opacity .15s;
}
button:hover { opacity: .9; }
button:focus-visible { outline: 2px solid var(--color-fd-ring); outline-offset: 2px; }
@media (max-width: 480px) {
  body, form { grid-template-columns: minmax(0, 1fr) !important; }
  body > *, form > * { grid-column: 1 !important; justify-self: stretch !important; }
  label { justify-self: start !important; margin-top: 4px; }
  button { justify-self: start !important; }
}
`;

/** The height the last demo had: the best guess for the next one, which is usually alike. */
let lastHeight = 0;
const KEY = 'live-demo-height:';
const stored = (src: string) => {
  try {
    return Number(localStorage.getItem(KEY + src)) || 0;
  } catch {
    return 0;
  }
};

export function LiveDemo({ src, title, text }: { src: string; title?: string; text: { demo: string; demoOf: string; open: string; loading: string } }) {
  const frame = useRef<HTMLIFrameElement>(null);
  // Unknown until the demo reports it: the frame starts at the height a demo had before (h-40 without one).
  const [height, setHeight] = useState<number>();
  const [ready, setReady] = useState(false);

  const take = (h: number) => {
    const next = Math.max(64, Math.ceil(h));
    lastHeight = next;
    setHeight(next);
    try {
      localStorage.setItem(KEY + src, String(next));
    } catch {}
  };

  // Before the first paint: the height this demo had last time, or the last demo's, written to the
  // frame directly (the server cannot know it, and React leaves an unset height alone).
  useLayoutEffect(() => {
    const h = stored(src) || lastHeight;
    if (h && frame.current) frame.current.style.height = `${h}px`;
  }, [src]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'example-height' || event.source !== frame.current?.contentWindow) return;
      take(Number(event.data.height) || 0);
    };
    addEventListener('message', onMessage);
    return () => removeEventListener('message', onMessage);
  });

  // The page's palette, fonts and theme, handed to the demo, again whenever the theme changes.
  const dress = () => {
    const doc = frame.current?.contentDocument;
    if (!doc?.head || !doc.body) return false;
    const root = getComputedStyle(document.documentElement);
    for (const token of TOKENS) doc.documentElement.style.setProperty(token, root.getPropertyValue(token));
    doc.documentElement.style.setProperty('--scheme', root.colorScheme || 'light');
    if (!doc.getElementById('site-demo-style')) {
      const fonts = [...document.styleSheets].flatMap((sheet) => {
        try {
          // A font's url is relative to its stylesheet, which the demo does not share.
          const base = sheet.href ?? location.href;
          return [...sheet.cssRules]
            .filter((rule) => rule instanceof CSSFontFaceRule)
            .map((rule) => rule.cssText.replace(/url\("([^"]+)"\)/g, (_, url) => `url("${new URL(url, base).href}")`));
        } catch {
          return [];
        }
      });
      const style = doc.createElement('style');
      style.id = 'site-demo-style';
      style.textContent = fonts.join('\n') + CSS;
      doc.head.append(style);
      // A framework demo mounts after its code compiles: until it shows something, the frame keeps
      // its reserved height and stays covered, so it does not shrink to nothing and grow back.
      const measure = () => {
        if (!doc.body.innerText.trim()) return;
        take(doc.body.scrollHeight);
        setReady(true);
      };
      new (doc.defaultView as typeof window).ResizeObserver(measure).observe(doc.body);
      measure();
    }
    return true;
  };

  useEffect(() => {
    const observer = new MutationObserver(() => dress());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme'],
    });
    return () => observer.disconnect();
  });

  const caption = title ? text.demoOf.replace('{title}', title) : text.demo;
  return (
    <figure className="not-prose my-4 overflow-hidden rounded-xl border bg-fd-card">
      <figcaption className="flex items-center gap-2 border-b px-4 py-2 text-xs text-fd-muted-foreground">
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
          // A same-origin demo gets the page's look before it shows; one from elsewhere shows as it is.
          onLoad={() => {
            let dressed = false;
            try {
              dressed = dress();
            } catch {}
            // A demo from elsewhere cannot be read: it shows once loaded. One that never renders
            // shows after a while, whatever it has.
            if (!dressed) setReady(true);
            else setTimeout(() => setReady(true), 10_000);
          }}
          // A height that changes (the reserved one to the real one) eases instead of jumping.
          className={`block h-40 w-full transition-[height,opacity] duration-200 ease-out motion-reduce:transition-none ${ready ? 'opacity-100' : 'opacity-0'}`}
        />
        {!ready && (
          <p role="status" className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-fd-muted-foreground">
            <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
            {text.loading}
          </p>
        )}
      </div>
    </figure>
  );
}
