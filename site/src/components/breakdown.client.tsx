'use client';
// The page's one popover for its coverage summaries (breakdown.tsx): mounted once in the provider,
// it listens on the document for the pointer and the keyboard on any summary button, fetches the
// page's lists (one JSON per page, made at build time) the first time one is asked for, and opens
// anchored to the button that asked. One popover, not one per summary: the parity matrix alone
// has a few hundred, and a popover each would be a few hundred Radix popovers to hydrate on a phone.
import Link from '@/components/link';
import { Popover, PopoverContent } from 'fumadocs-ui/components/ui/popover';
import { Anchor as PopoverAnchor, Arrow as PopoverArrow } from '@radix-ui/react-popover';
import { ArrowRight } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import type { BreakdownDetail } from '@/lib/breakdown-data';
import { StatusIcon } from './status';

type Lists = Record<string, BreakdownDetail>;
const lists = new Map<string, Promise<Lists>>();
const fetchLists = (src: string) => {
  let p = lists.get(src);
  if (!p) {
    p = fetch(src).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))));
    p.catch(() => lists.delete(src));
    lists.set(src, p);
  }
  return p;
};

const triggerOf = (target: EventTarget | null) => (target instanceof Element ? target.closest<HTMLButtonElement>('button[data-breakdown]') : null);

export function BreakdownHost({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Opened by a click (or a tap, or the keyboard): it stays open when the pointer leaves.
  const [pinned, setPinned] = useState(false);
  const pinnedRef = useRef(false);
  // The trigger the popover anchors to: a plain box, set by the event that opens it, so Radix
  // reads the element and nothing reads it while rendering.
  const [anchorRef] = useState<{ current: HTMLElement | null }>(() => ({ current: null }));
  const [active, setActive] = useState<HTMLElement | null>(null);
  // Whether the popover is closing because of a click or a tab somewhere else: then focus stays
  // where the reader put it instead of returning to the trigger.
  const interactedOutside = useRef(false);
  const [detail, setDetail] = useState<BreakdownDetail | null>(null);
  const titleId = useId();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // What the last event asked for, so a slow fetch cannot open a list the pointer has left.
  const wanted = useRef<HTMLElement | null>(null);

  // Mirrors the host's state and the pinned flag for the document listeners, which are bound once.
  const state = useRef({ open, pinned });
  useEffect(() => {
    state.current = { open, pinned };
  });

  useEffect(() => {
    const show = async (el: HTMLButtonElement, pin: boolean) => {
      wanted.current = el;
      const src = el.dataset.breakdownSrc;
      const key = el.dataset.breakdown;
      if (!src || !key) return;
      let list: Lists;
      try {
        list = await fetchLists(src);
      } catch {
        return;
      }
      const next = list[key];
      if (!next || wanted.current !== el) return;
      anchorRef.current = el;
      if (pin) pinnedRef.current = true;
      setDetail(next);
      setActive(el);
      setOpen(true);
      if (pin) setPinned(true);
    };
    const onOver = (event: MouseEvent) => {
      const el = triggerOf(event.target);
      if (!el || el.contains(event.relatedTarget as Node | null)) return;
      clearTimeout(timer.current);
      if (state.current.pinned) return;
      void fetchLists(el.dataset.breakdownSrc ?? '').catch(() => {});
      timer.current = setTimeout(() => void show(el, false), 150);
    };
    const onOut = (event: MouseEvent) => {
      const el = triggerOf(event.target);
      if (!el || el.contains(event.relatedTarget as Node | null)) return;
      clearTimeout(timer.current);
      wanted.current = null;
      if (state.current.pinned) return;
      timer.current = setTimeout(() => setOpen(false), 200);
    };
    const onClick = (event: MouseEvent) => {
      const el = triggerOf(event.target);
      if (!el) return;
      event.preventDefault();
      clearTimeout(timer.current);
      // A click after hovering keeps open what the hover showed; a second click closes it.
      if (state.current.open && state.current.pinned && anchorRef.current === el) {
        setOpen(false);
        setPinned(false);
      } else void show(el, true);
    };
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('click', onClick);
      clearTimeout(timer.current);
    };
  }, [anchorRef]);

  // The button the popover is open on says so (its color, and aria-expanded for a screen reader).
  useEffect(() => {
    if (!active) return;
    active.setAttribute('aria-expanded', open ? 'true' : 'false');
    active.setAttribute('data-state', open ? 'open' : 'closed');
    return () => {
      active.setAttribute('aria-expanded', 'false');
      active.setAttribute('data-state', 'closed');
    };
  }, [active, open]);

  const stay = (entering: boolean) => {
    clearTimeout(timer.current);
    if (pinned || entering) return;
    timer.current = setTimeout(() => setOpen(false), 200);
  };
  const change = (next: boolean) => {
    setOpen(next);
    if (!next) setPinned(false);
  };

  return (
    <>
      {children}
      <Popover open={open} onOpenChange={change}>
        <PopoverAnchor virtualRef={anchorRef} />
        {detail && (
          <PopoverContent
            align="start"
            aria-labelledby={titleId}
            onMouseEnter={() => stay(true)}
            onMouseLeave={() => stay(false)}
            // Opened by the pointer, it takes no focus (and gives none back on closing): focus moved
            // by script carries the keyboard's focus ring with it, so a hover would draw outlines.
            // Opened by a click or the keyboard, Radix moves focus in, so Tab reaches the link, and
            // on closing focus returns to the trigger, which had it.
            onOpenAutoFocus={(event) => {
              if (!pinnedRef.current) event.preventDefault();
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (pinnedRef.current && !interactedOutside.current) anchorRef.current?.focus();
              pinnedRef.current = false;
              interactedOutside.current = false;
            }}
            // The trigger is not "outside" (it is not Radix's own trigger, so Radix cannot tell): a
            // click on it toggles the popover, as the button says, instead of dismissing it first.
            onInteractOutside={(event) => {
              const target = event.target as Node | null;
              if (target && anchorRef.current?.contains(target)) event.preventDefault();
              else interactedOutside.current = true;
            }}
            arrowPadding={12}
            className="w-72 overflow-visible bg-fd-popover p-3 text-sm backdrop-blur-none outline-none"
          >
            <p id={titleId} className="mb-2 font-medium">
              {detail.title}
            </p>
            <ul className="flex flex-col gap-1.5">
              {detail.items.map((item) => (
                <li key={item.label} className="flex items-start gap-2">
                  <StatusIcon status={item.status} className="mt-0.5 size-4 shrink-0" />
                  <span>
                    {item.label}
                    <span className="block text-xs text-fd-muted-foreground">
                      {/* The contract's summaries mark code with backticks. */}
                      {item.note.split(/`([^`]+)`/).map((part, i) => (i % 2 ? <code key={i} className="font-mono text-fd-foreground">{part}</code> : part))}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {detail.href && (
              <Link href={detail.href} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-fd-primary hover:underline">
                {detail.hrefText} <ArrowRight aria-hidden className="size-3" />
              </Link>
            )}
            {/* Points at the words it describes: a corner of the popover's own paper, turned 45°, so
                its two edges continue the popover's border and its base covers it. Radix lays the
                arrow out in its own box (flipped whole when the popover opens below its trigger), so
                the corner is drawn pointing down, base up, and the box turns it. */}
            <PopoverArrow asChild>
              <span
                aria-hidden
                className="block size-3 -translate-y-[calc(50%+1px)] rotate-45 border-r border-b border-fd-border bg-fd-popover [clip-path:polygon(100%_0,100%_100%,0_100%)]"
              />
            </PopoverArrow>
          </PopoverContent>
        )}
      </Popover>
    </>
  );
}
