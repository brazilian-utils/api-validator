import { ParityPage, parityText } from '@/components/pages/parity';
import { pageMetadata } from '@/lib/meta';

const { title, description } = parityText('en');
export const metadata = pageMetadata('en', '/reference/parity/', title, description);

export default function Page() {
  return <ParityPage locale="en" />;
}
