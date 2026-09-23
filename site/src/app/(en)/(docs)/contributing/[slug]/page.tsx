import { MdxPage, mdxMetadata } from '@/components/pages/mdx-page';
import { folderPages } from '@/lib/source';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => folderPages('en', 'contributing').map(({ slug }) => ({ slug }));
export const generateMetadata = async ({ params }: Props) => mdxMetadata('en', ['contributing', (await params).slug]);

export default async function Page({ params }: Props) {
  return <MdxPage locale="en" slugs={['contributing', (await params).slug]} />;
}
