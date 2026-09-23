import { DocsShell } from '@/components/docs-shell';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DocsShell locale="pt-BR">{children}</DocsShell>;
}
