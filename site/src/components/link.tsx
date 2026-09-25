// next/link without prefetch: on a static host each prefetch is a request, and pages here list
// dozens to hundreds of links (sidebar, parity matrix, utility lists).
import NextLink from 'next/link';
import type { ComponentProps } from 'react';

export default function Link(props: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={false} {...props} />;
}
