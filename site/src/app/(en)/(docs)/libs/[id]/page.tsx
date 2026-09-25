import { LibPage, libDescription, libTitle } from '@/components/pages/lib';
import { loadLibs } from '@/lib/data';
import { pageMetadata } from '@/lib/meta';

type Props = { params: Promise<{ id: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => loadLibs().map((l: any) => ({ id: l.id }));
export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const lib = loadLibs().find((l: any) => l.id === id);
  return pageMetadata('en', `/libs/${id}/`, libTitle('en', lib.label), libDescription('en', lib.label));
}

export default async function Page({ params }: Props) {
  return <LibPage locale="en" id={(await params).id} />;
}
