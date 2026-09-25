import localFont from 'next/font/local';
import Script from 'next/script';
import type { ReactNode } from 'react';
import { Provider } from './provider';
import { LangIconDefs } from './lang-icon';
import { StatusIconDefs } from './status';
import type { Locale } from '@/lib/i18n';
import '@/app/global.css';

const base = process.env.NEXT_PUBLIC_BASE ?? '';

// Geist, cut down to the Latin letters, accents and marks the site uses (src/assets/fonts, made
// by scripts/subset-fonts.sh from the geist package's variable fonts: half the bytes). The sans
// face sets the page's text, so it is preloaded; the mono face sets code, which is rarely the
// first thing painted, so it loads when a page first uses it and does not sit in front of the
// first paint.
const GeistSans = localFont({
  src: '../assets/fonts/geist-sans.woff2',
  variable: '--font-geist-sans',
  weight: '100 900',
  display: 'swap',
});
const GeistMono = localFont({
  src: '../assets/fonts/geist-mono.woff2',
  variable: '--font-geist-mono',
  weight: '100 900',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Roboto Mono', 'Menlo', 'Monaco', 'Liberation Mono', 'DejaVu Sans Mono', 'Courier New', 'monospace'],
});

// First visit on an English page whose reader's browser prefers Portuguese: go to the same page
// under /pt-br/ once, and remember it. An explicit choice in the language menu ("bu:lang") always
// wins. Crawlers do not run scripts, so the English pages stay indexable.
const detectLanguage = `(function(){try{var K='bu:lang',b=${JSON.stringify(base)},pt=b+'/pt-br';if(localStorage.getItem(K))return;var ls=navigator.languages||[navigator.language||''],w=false;for(var i=0;i<ls.length;i++){var l=String(ls[i]);if(/^pt\\b/i.test(l)){w=true;break}if(/^en\\b/i.test(l))break}if(!w)return;var p=location.pathname;if(p===pt||p.indexOf(pt+'/')===0)return;localStorage.setItem(K,'pt-br');location.replace(pt+(b&&p.indexOf(b)===0?p.slice(b.length):p)+location.search+location.hash)}catch(e){}})();`;

export function Html({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <html lang={locale} className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen font-sans antialiased">
        {locale === 'en' && (
          // The rule dates from pages/: in the App Router a beforeInteractive script belongs in the
          // root layout, which this is.
          // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
          <Script id="detect-language" strategy="beforeInteractive">
            {detectLanguage}
          </Script>
        )}
        <LangIconDefs />
        <StatusIconDefs />
        <Provider locale={locale}>{children}</Provider>
      </body>
    </html>
  );
}
