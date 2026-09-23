import { MdxPage, mdxMetadata } from '@/components/pages/mdx-page';
import { folderPages } from '@/lib/source';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => folderPages('pt-BR', 'contributing').map(({ slug }) => ({ slug }));
export const generateMetadata = async ({ params }: Props) => mdxMetadata('pt-BR', ['contributing', (await params).slug]);

export default async function Page({ params }: Props) {
  return <MdxPage locale="pt-BR" slugs={['contributing', (await params).slug]} />;
}
