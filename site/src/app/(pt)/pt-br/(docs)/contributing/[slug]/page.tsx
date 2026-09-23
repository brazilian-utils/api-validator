import { MdxPage, mdxMetadata } from '@/components/pages/mdx-page';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => ['specs', 'usage-files', 'new-language'].map((slug) => ({ slug }));
export const generateMetadata = async ({ params }: Props) => mdxMetadata('pt-BR', ['contributing', (await params).slug]);

export default async function Page({ params }: Props) {
  return <MdxPage locale="pt-BR" slugs={['contributing', (await params).slug]} />;
}
