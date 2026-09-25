// Status marks, icon first and text for screen readers: the same everywhere on the site.
import { AlertTriangle, CheckCircle2, Circle, CircleDot, MinusCircle, XCircle } from 'lucide-react';

const ICON = {
  ok: [CheckCircle2, 'text-ok'],
  full: [CheckCircle2, 'text-ok'],
  partial: [CircleDot, 'text-warn'],
  failing: [XCircle, 'text-fail'],
  signature: [AlertTriangle, 'text-warn'],
  missing: [Circle, 'text-fd-muted-foreground'],
  none: [Circle, 'text-fd-muted-foreground'],
  waived: [MinusCircle, 'text-fd-muted-foreground'],
} as const;

export type Status = keyof typeof ICON;

/** The marks' outlines, once per page (the root layout); a page with hundreds of marks carries
 *  hundreds of <use> references instead of hundreds of drawings. */
export function StatusIconDefs() {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute">
      <defs>
        {(Object.keys(ICON) as Status[]).map((status) => {
          const [Icon] = ICON[status];
          return (
            <symbol key={status} id={`status-${status}`} viewBox="0 0 24 24">
              <Icon />
            </symbol>
          );
        })}
      </defs>
    </svg>
  );
}

export function StatusIcon({ status, label, className = 'size-4' }: { status: Status; label?: string; className?: string }) {
  const color = (ICON[status] ?? ICON.missing)[1];
  const icon = (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`${className} ${color} shrink-0`}>
      <use href={`#status-${status in ICON ? status : 'missing'}`} />
    </svg>
  );
  // Named as an image rather than with visually hidden text: it stays inside scrolling tables.
  return label ? (
    <span role="img" aria-label={label} className="inline-flex shrink-0">
      {icon}
    </span>
  ) : (
    icon
  );
}
