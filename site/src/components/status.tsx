// Status marks, icon first and text for screen readers: the same everywhere on the site.
import { AlertTriangle, CheckCircle2, Circle, Contrast, MinusCircle, XCircle } from 'lucide-react';

const ICON = {
  ok: [CheckCircle2, 'text-ok'],
  full: [CheckCircle2, 'text-ok'],
  partial: [Contrast, 'text-warn'],
  failing: [XCircle, 'text-fail'],
  signature: [AlertTriangle, 'text-warn'],
  missing: [Circle, 'text-fd-muted-foreground'],
  none: [Circle, 'text-fd-muted-foreground'],
  waived: [MinusCircle, 'text-fd-muted-foreground'],
} as const;

export type Status = keyof typeof ICON;

export function StatusIcon({ status, label, className = 'size-4' }: { status: Status; label?: string; className?: string }) {
  const [Icon, color] = ICON[status] ?? ICON.missing;
  const icon = <Icon aria-hidden="true" className={`${className} ${color} shrink-0`} />;
  // Named as an image rather than with visually hidden text: it stays inside scrolling tables.
  return label ? (
    <span role="img" aria-label={label} className="inline-flex shrink-0">
      {icon}
    </span>
  ) : (
    icon
  );
}
