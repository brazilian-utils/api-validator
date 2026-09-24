'use client';
// A short answer ("no Generate", "3 missing") that opens, on hover or click, what is behind it:
// every function (or library) with its state. Used wherever the site sums up coverage, so a
// count never stands alone.
import Link from '@/components/link';
import { Popover, PopoverContent, PopoverTrigger } from 'fumadocs-ui/components/ui/popover';
import { Arrow as PopoverArrow } from '@radix-ui/react-popover';
import { ArrowRight } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';
import { StatusIcon, type Status } from './status';

export interface BreakdownItem {
  label: string;
  status: Status;
  /** One line under the name: what the function does (or a library's summary). */
  note: string;
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
  /** The trigger's accessible name: the summary in words. */
  label: string;
  href?: string;
  hrefText?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // Opened by a click (or a tap, or the keyboard): it stays open when the pointer leaves.
  const [pinned, setPinned] = useState(false);
  const titleId = useId();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Hover opens it after a moment and leaving closes it, unless a click pinned it.
  const hover = (next: boolean) => {
    clearTimeout(timer.current);
    if (pinned) return;
    timer.current = setTimeout(() => setOpen(next), next ? 150 : 200);
  };
  const change = (next: boolean) => {
    setOpen(next);
    if (!next) setPinned(false);
  };
  return (
    <Popover open={open} onOpenChange={change}>
      <PopoverTrigger
        aria-label={label}
        // A click after hovering keeps open what the hover showed; a second click closes it.
        onClick={(event) => {
          event.preventDefault();
          clearTimeout(timer.current);
          if (open && pinned) change(false);
          else {
            setOpen(true);
            setPinned(true);
          }
        }}
        onMouseEnter={() => hover(true)}
        onMouseLeave={() => hover(false)}
        className={`inline-flex min-h-6 cursor-pointer self-start items-center gap-1.5 rounded-md text-start transition-colors hover:text-fd-foreground data-[state=open]:text-fd-foreground ${className}`}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-labelledby={titleId}
        onMouseEnter={() => hover(true)}
        onMouseLeave={() => hover(false)}
        arrowPadding={12}
        className="w-72 overflow-visible bg-fd-popover p-3 text-sm backdrop-blur-none outline-none"
      >
        <p id={titleId} className="mb-2 font-medium">
          {title}
        </p>
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
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
        {href && (
          <Link href={href} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-fd-primary hover:underline">
            {hrefText} <ArrowRight aria-hidden className="size-3" />
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
    </Popover>
  );
}
