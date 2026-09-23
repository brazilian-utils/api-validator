// 404 for every path (GitHub Pages serves 404.html): both languages, links back into the site.
import Link from '@/components/link';
import { Html } from '@/components/html';

export const metadata = { title: 'Page not found · Brazilian Utils', robots: { index: false } };

export default function NotFound() {
  return (
    <Html locale="en">
      <main id="main" className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-4 px-6">
        <p className="font-mono text-sm text-fd-primary">404</p>
        <h1 className="text-3xl font-semibold tracking-tight">This page does not exist.</h1>
        <p className="text-fd-muted-foreground">The utility may have another name, or it is not in the contract yet.</p>
        <p lang="pt-BR" className="text-fd-muted-foreground">Esta página não existe. O utilitário pode ter outro nome, ou ainda não está no contrato.</p>
        <p className="flex flex-wrap gap-3 pt-2">
          <Link href="/" className="rounded-md bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground">Home</Link>
          <Link href="/reference/parity/" className="rounded-md border px-4 py-2 text-sm font-medium">Parity matrix</Link>
          <Link href="/pt-br/" lang="pt-BR" className="rounded-md border px-4 py-2 text-sm font-medium">Início (português)</Link>
        </p>
      </main>
    </Html>
  );
}
