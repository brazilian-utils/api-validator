import { MdxPage, mdxMetadata } from '@/components/pages/mdx-page';

export const metadata = mdxMetadata('en', ['getting-started']);

export default function Page() {
  return <MdxPage locale="en" slugs={['getting-started']} />;
}
