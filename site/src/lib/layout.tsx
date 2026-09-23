import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Image from 'next/image';
import logo from '@/assets/logo.png';
import { siGithub } from 'simple-icons';
import { type Locale, prefixOf } from './i18n';

/** The brand logo, the dog and the wordmark (header, 404 page), from brazilian-utils/brand. */
export function SiteMark({ className = 'h-11' }: { className?: string }) {
  return <Image src={logo} alt="Brazilian Utils" height={96} className={`w-auto ${className}`} priority />;
}

export function baseOptions(locale: Locale): BaseLayoutProps {
  return {
    nav: {
      title: <SiteMark />,
      url: `${prefixOf(locale)}/`,
    },
    // An icon link with a name (Fumadocs' githubUrl draws an unnamed role="img" svg).
    links: [
      {
        type: 'icon',
        label: 'GitHub',
        text: 'GitHub',
        url: 'https://github.com/brazilian-utils',
        external: true,
        icon: (
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d={siGithub.path} />
          </svg>
        ),
      },
    ],
    i18n: true,
  };
}
