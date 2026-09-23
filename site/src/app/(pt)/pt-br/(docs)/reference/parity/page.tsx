import { ParityPage, parityText } from '@/components/pages/parity';
import { pageMetadata } from '@/lib/meta';

const { title, description } = parityText('pt-BR');
export const metadata = pageMetadata('pt-BR', '/reference/parity/', title, description);

export default function Page() {
  return <ParityPage locale="pt-BR" />;
}
