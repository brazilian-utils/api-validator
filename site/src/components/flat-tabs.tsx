// Tabs in the flow of the page: a row of labels over a rule, the panel below, no box around it.
// Built on Fumadocs' unstyled primitive, which keeps a group in sync across the page and site
// (groupId) and remembers the choice (persist).
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'fumadocs-ui/components/ui/tabs';
import type { ReactNode } from 'react';

export interface FlatTabItem {
  value: string;
  label: ReactNode;
  content: ReactNode;
}

export function FlatTabs({ items, groupId, persist, label, className = '' }: { items: FlatTabItem[]; groupId?: string; persist?: boolean; label?: string; className?: string }) {
  if (items.length === 0) return null;
  return (
    <Tabs groupId={groupId} persist={persist} defaultValue={items[0].value} className={`my-6 ${className}`}>
      <TabsList aria-label={label} className="not-prose flex gap-1 overflow-x-auto border-b">
        {items.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            className="-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-2.5 pt-1 pb-2 text-sm font-medium whitespace-nowrap text-fd-muted-foreground transition-colors hover:text-fd-foreground data-[state=active]:border-fd-primary data-[state=active]:text-fd-foreground"
          >
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {items.map((item) => (
        <TabsContent key={item.value} value={item.value} className="pt-4 outline-none [&>:first-child]:mt-0 [&>:last-child]:mb-0">
          {item.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
