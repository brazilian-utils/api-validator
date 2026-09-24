'use client';
// A short answer ("no Generate", "3 missing") that opens, on hover or click, what is behind it:
// every function (or library) with its state. Used wherever the site sums up coverage, so a
// count never stands alone.
//
// One popover serves the whole page. The parity matrix alone has a few hundred of these
// answers, and a popover each would cost a few hundred Radix popovers to hydrate on a phone. So
// each answer is a plain button that hands its words to the page's one popover (BreakdownHost,
// mounted once in the provider), and the popover anchors itself to whichever button asked.
import Link from '@/components/link';
import { Popover, PopoverContent } from 'fumadocs-ui/components/ui/popover';
import { Anchor as PopoverAnchor, Arrow as PopoverArrow } from '@radix-ui/react-popover';
import { ArrowRight } from 'lucide-react';
import { createContext, useContext, useId, useRef, useState, type ReactNode } from 'react';
import { StatusIcon, type Status } from './status';

export interface BreakdownItem {
  label: string;
  status: Status;
  /** One line under the name: what the function does (or a library's summary). */
  note: string;
}

interface Data {
  /** The trigger's own id: the one the popover is open on is drawn as open. */
  id: string;
  /** Heading of the list: what the breakdown is about. */
  title: string;
  items: BreakdownItem[];
  href?: string;
  hrefText?: string;
}

interface Host {
  /** The pointer came onto (or left) a trigger: open after a moment, close after a moment. */
  hover: (el: HTMLElement, data: Data, next: boolean) => void;
  /** A click, a tap or the keyboard on a trigger: open and keep open, or close what it opened. */
  click: (el: HTMLElement, data: Data) => void;
  /** The id of the trigger the popover is open on, if any. */
  activeId: string | null;
}

const HostContext = createContext<Host>({ hover: () => {}, click: () => {}, activeId: null });

/** The page's one popover, mounted once above every Breakdown. */
export function BreakdownHost({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Opened by a click (or a tap, or the keyboard): it stays open when the pointer leaves.
  const [pinned, setPinned] = useState(false);
  // The same, read by the focus handlers, which run after the state has already been cleared.
  const pinnedRef = useRef(false);
  // The trigger the popover anchors to: a plain box, set by the event that opens it, so Radix
  // reads the element and nothing reads it while rendering.
  const [anchorRef] = useState<{ current: HTMLElement | null }>(() => ({ current: null }));
  // Whether the popover is closing because of a click or a tab somewhere else: then focus stays
  // where the reader put it instead of returning to the trigger.
  const interactedOutside = useRef(false);
  const [data, setData] = useState<Data | null>(null);
  const titleId = useId();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = (el: HTMLElement, next: Data) => {
    anchorRef.current = el;
    setData(next);
    setOpen(true);
  };
  // Hover opens it after a moment and leaving closes it, unless a click pinned it.
  const hover = (el: HTMLElement, next: Data, entering: boolean) => {
    clearTimeout(timer.current);
    if (pinned) return;
    timer.current = setTimeout(() => (entering ? show(el, next) : setOpen(false)), entering ? 150 : 200);
  };
  const stay = (entering: boolean) => {
    clearTimeout(timer.current);
    if (pinned || entering) return;
    timer.current = setTimeout(() => setOpen(false), 200);
  };
  const change = (next: boolean) => {
    setOpen(next);
    if (!next) setPinned(false);
  };
  // A click after hovering keeps open what the hover showed; a second click closes it.
  const click = (el: HTMLElement, next: Data) => {
    clearTimeout(timer.current);
    if (open && pinned && anchorRef.current === el) change(false);
    else {
      pinnedRef.current = true;
      show(el, next);
      setPinned(true);
    }
  };

  return (
    <HostContext.Provider value={{ hover, click, activeId: open && data ? data.id : null }}>
      {children}
      <Popover open={open} onOpenChange={change}>
        <PopoverAnchor virtualRef={anchorRef} />
        {data && (
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
              {data.title}
            </p>
            <ul className="flex flex-col gap-1.5">
              {data.items.map((item) => (
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
            {data.href && (
              <Link href={data.href} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-fd-primary hover:underline">
                {data.hrefText} <ArrowRight aria-hidden className="size-3" />
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
    </HostContext.Provider>
  );
}

export function Breakdown({
  children,
  title,
  items,
  label,
  href,
  hrefText,
  className = '',
}: {
  children: ReactNode;
  /** Heading of the list: what the breakdown is about. */
  title: string;
  items: BreakdownItem[];
  /** The trigger's accessible name, when its visible words alone do not say what it sums up. */
  label?: string;
  href?: string;
  hrefText?: string;
  className?: string;
}) {
  const host = useContext(HostContext);
  const id = useId();
  const ref = useRef<HTMLButtonElement>(null);
  const data: Data = { id, title, items, href, hrefText };
  const open = host.activeId === id;
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      data-state={open ? 'open' : 'closed'}
      onClick={(event) => {
        event.preventDefault();
        if (ref.current) host.click(ref.current, data);
      }}
      onMouseEnter={() => ref.current && host.hover(ref.current, data, true)}
      onMouseLeave={() => ref.current && host.hover(ref.current, data, false)}
      className={`inline-flex min-h-6 cursor-pointer self-start items-center gap-1.5 rounded-md text-start transition-colors hover:text-fd-foreground data-[state=open]:text-fd-foreground ${className}`}
    >
      {children}
    </button>
  );
}
