// Something most readers skip (try it, the shared test cases): a native <details> between rules,
// open on demand, no box around it. Works without JavaScript.
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

export function Disclosure({ id, title, children }: { id?: string; title: ReactNode; children: ReactNode }) {
  return (
    <details id={id} className="group not-prose border-t last:border-b [&[open]>summary>svg]:rotate-90">
      <summary className="flex cursor-pointer list-none items-center gap-2 py-3 text-sm font-medium select-none hover:text-fd-primary [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="size-4 shrink-0 text-fd-muted-foreground transition-transform" />
        {title}
      </summary>
      <div className="pb-5 ps-6">{children}</div>
    </details>
  );
}
