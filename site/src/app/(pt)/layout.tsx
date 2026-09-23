import { Html } from '@/components/html';
import { rootMetadata } from '@/lib/meta';

export const metadata = rootMetadata('pt-BR');
export { viewport } from '@/lib/meta';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <Html locale="pt-BR">{children}</Html>;
}
