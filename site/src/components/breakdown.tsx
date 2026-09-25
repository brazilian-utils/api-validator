// A short answer ("no Generate", "3 missing") that opens, on hover or click, what is behind it:
// every function (or library) with its state. Used wherever the site sums up coverage, so a
// count never stands alone.
//
// The button is plain markup, with no code of its own to hydrate: the parity matrix alone has a
// few hundred of them. The page's one popover (BreakdownHost, breakdown.client.tsx) listens for
// the pointer and the keyboard on every button, fetches the page's lists (`src`, one JSON per
// page, made at build time) the first time one is asked for, and opens on the button that asked.
import type { ReactNode } from 'react';

export function Breakdown({
  children,
  src,
  id,
  label,
  className = '',
}: {
  children: ReactNode;
  /** The page's JSON of lists (breakdownUrl). */
  src: string;
  /** This summary's key in that JSON. */
  id: string;
  /** The trigger's accessible name, when its visible words alone do not say what it sums up. */
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={false}
      data-state="closed"
      data-breakdown={id}
      data-breakdown-src={src}
      className={`inline-flex min-h-6 cursor-pointer self-start items-center gap-1.5 rounded-md text-start transition-colors hover:text-fd-foreground data-[state=open]:text-fd-foreground ${className}`}
    >
      {children}
    </button>
  );
}
