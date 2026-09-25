import { GuidePage, guideParams, guideTitle } from '@/components/pages/guide';
import { pageMetadata } from '@/lib/meta';

type Props = { params: Promise<{ lib: string; slug: string }> };

export const dynamicParams = false;
export const generateStaticParams = guideParams;
export async function generateMetadata({ params }: Props) {
  const { lib, slug } = await params;
  const { title, description } = guideTitle('en', lib, slug);
  return pageMetadata('en', `/guides/${lib}/${slug}/`, title, description);
}

export default async function Page({ params }: Props) {
  const { lib, slug } = await params;
  return <GuidePage locale="en" lib={lib} slug={slug} />;
}
