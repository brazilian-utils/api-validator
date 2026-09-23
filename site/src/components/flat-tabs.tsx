// Tabs in the flow of the page: a row of labels over a rule, the panel below, no box around it.
// Built on Fumadocs' unstyled primitive, which keeps a group in sync across the page and site
// (groupId) and remembers the choice (persist). On a phone the labels wrap to a second row rather
// than scroll out of sight. `compact` is the lighter second level under a row of line tabs (the
// variants of a guide example), so two levels never look the same.
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'fumadocs-ui/components/ui/tabs';
import type { ReactNode } from 'react';

export interface FlatTabItem {
  value: string;
  label: ReactNode;
  content: ReactNode;
}

const LIST = {
  // The rule under the labels is a shadow, not a border the labels overlap: a row that scrolls
  // sideways then has nothing to scroll up and down, so it shows a scrollbar only when the labels
  // do not fit.
  line: 'not-prose flex flex-wrap gap-x-1 shadow-[inset_0_-1px_0_var(--color-fd-border)] sm:flex-nowrap sm:overflow-x-auto sm:overflow-y-hidden',
  compact: 'not-prose flex flex-wrap gap-1',
};
const TRIGGER = {
  line: 'inline-flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-2.5 pt-1 pb-2 text-sm font-medium whitespace-nowrap text-fd-muted-foreground transition-colors hover:text-fd-foreground data-[state=active]:border-fd-primary data-[state=active]:text-fd-foreground',
  compact: 'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap text-fd-muted-foreground transition-colors hover:text-fd-foreground data-[state=active]:bg-fd-accent data-[state=active]:text-fd-foreground',
};

export function FlatTabs({
  items,
  groupId,
  persist,
  label,
  className = '',
  variant = 'line',
  keepMounted,
}: {
  items: FlatTabItem[];
  groupId?: string;
  persist?: boolean;
  label?: string;
  className?: string;
  variant?: 'line' | 'compact';
  /** Keep every panel on the page, hidden when not chosen, so a live demo in one never reloads. */
  keepMounted?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <Tabs groupId={groupId} persist={persist} defaultValue={items[0].value} className={`${variant === 'compact' ? 'my-3' : 'my-6'} ${className}`}>
      <TabsList aria-label={label} className={LIST[variant]}>
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value} className={TRIGGER[variant]}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {items.map((item) => (
        <TabsContent key={item.value} value={item.value} forceMount={keepMounted || undefined} className={`${variant === 'compact' ? 'pt-2' : 'pt-4'} outline-none data-[state=inactive]:hidden [&>:first-child]:mt-0 [&>:last-child]:mb-0`}>
          {item.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
