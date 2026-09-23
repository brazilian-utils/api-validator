// A note in the flow of the page: an icon, an optional title, the text. A tinted surface and no
// colored side stripe (the stripe is the stock callout of generated docs).
import { AlertTriangle, Info, Lightbulb, OctagonAlert } from 'lucide-react';
import type { ReactNode } from 'react';

const KIND = {
  info: { Icon: Info, tone: 'bg-fd-primary/8 text-fd-primary' },
  idea: { Icon: Lightbulb, tone: 'bg-fd-primary/8 text-fd-primary' },
  warn: { Icon: AlertTriangle, tone: 'bg-warn/12 text-warn' },
  warning: { Icon: AlertTriangle, tone: 'bg-warn/12 text-warn' },
  error: { Icon: OctagonAlert, tone: 'bg-fail/10 text-fail' },
} as const;

export function Note({ type = 'info', title, children }: { type?: keyof typeof KIND; title?: ReactNode; children: ReactNode }) {
  const { Icon, tone } = KIND[type] ?? KIND.info;
  return (
    <div role="note" className={`not-prose my-5 flex gap-3 rounded-xl px-4 py-3.5 text-sm ${tone.split(' ')[0]}`}>
      <Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${tone.split(' ')[1]}`} />
      <div className="min-w-0 text-fd-foreground [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded [&_code]:bg-fd-background/70 [&_code]:px-1 [&_p]:m-0 [&_p+p]:mt-2">
        {title && <p className="mb-1 font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}
