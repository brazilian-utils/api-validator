import { MdxPage, mdxMetadata } from '@/components/pages/mdx-page';

export const metadata = mdxMetadata('pt-BR', ['getting-started']);

export default function Page() {
  return <MdxPage locale="pt-BR" slugs={['getting-started']} />;
}
