import { UtilPage } from '@/components/pages/util';
import { utilMetadata, utilParams } from '@/lib/meta';

export const dynamicParams = false;
export const generateStaticParams = utilParams;
export const generateMetadata = async ({ params }: { params: Promise<{ id: string }> }) => utilMetadata('en', (await params).id);

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <UtilPage locale="en" id={(await params).id} />;
}
