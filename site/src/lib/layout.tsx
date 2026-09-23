import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Image from 'next/image';
import icon from '@/assets/icon.png';
import { siGithub } from 'simple-icons';
import { type Locale, prefixOf } from './i18n';

/** The logo and the wordmark (header, 404 page). */
export function SiteMark() {
  return (
    <>
      <Image src={icon} alt="" width={28} height={28} priority />
      <span className="font-samba text-lg tracking-wide">Brazilian Utils</span>
    </>
  );
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
