import { GuidePage, guideParams, guideTitle } from '@/components/pages/guide';
import { pageMetadata } from '@/lib/meta';

type Props = { params: Promise<{ lib: string; slug: string }> };

export const dynamicParams = false;
export const generateStaticParams = guideParams;
export async function generateMetadata({ params }: Props) {
  const { lib, slug } = await params;
  const { title, description } = guideTitle('pt-BR', lib, slug);
  return pageMetadata('pt-BR', `/guides/${lib}/${slug}/`, title, description);
}

export default async function Page({ params }: Props) {
  const { lib, slug } = await params;
  return <GuidePage locale="pt-BR" lib={lib} slug={slug} />;
}
