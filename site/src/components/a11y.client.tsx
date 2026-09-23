'use client';
// Fixes to Fumadocs' markup that axe (WCAG 2.1 AA and best practices) asks for, applied as the
// page renders and as tabs and accordions open:
//  - scrolling code blocks: each region gets its own name ("Code 1", "Code 2"…);
//  - the table of contents (and its phone header) is a named navigation landmark;
//  - a scrolling table or box with nothing focusable inside becomes reachable by keyboard.
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function A11yFixes({ code, toc, scroll }: { code: string; toc: string; scroll: string }) {
  const pathname = usePathname();
  useEffect(() => {
    let frame = 0;
    const fix = () => {
      frame = 0;
      // "Code (tsx), Validate" : the file title or language, then the section it sits in.
      const used = new Map<string, number>();
      const headings = [...document.querySelectorAll('#nd-page :is(h2, h3)')];
      document.querySelectorAll('figure [role="region"]').forEach((el) => {
        const figure = el.closest('figure');
        const title = figure?.querySelector('figcaption')?.textContent?.trim();
        const lang = figure?.querySelector('pre > code')?.getAttribute('data-language') ?? figure?.className.match(/language-(\w+)/)?.[1];
        const section = headings.filter((h) => h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING).pop()?.textContent?.trim();
        let name = [title || (lang ? `${code} (${lang})` : code), section].filter(Boolean).join(', ');
        const n = (used.get(name) ?? 0) + 1;
        used.set(name, n);
        if (n > 1) name += ` (${n})`;
        if (el.getAttribute('aria-label') !== name) el.setAttribute('aria-label', name);
      });
      const tocBox = document.getElementById('nd-toc');
      if (tocBox && tocBox.getAttribute('role') !== 'navigation') {
        tocBox.setAttribute('role', 'navigation');
        tocBox.setAttribute('aria-label', toc);
      }
      // The phone's "On this page" bar is a <header> too: its box becomes the named navigation,
      // the header itself no second banner.
      document.querySelectorAll('header:not(#nd-subnav):not(#nd-nav)').forEach((el) => {
        const box = el.parentElement;
        if (!box || box.getAttribute('role') === 'navigation') return;
        el.setAttribute('role', 'presentation');
        box.setAttribute('role', 'navigation');
        box.setAttribute('aria-label', toc);
      });
      document.querySelectorAll<HTMLElement>('#nd-page .overflow-x-auto, #nd-page .overflow-auto, #nd-page figure, main .overflow-x-auto').forEach((el) => {
        if (el.hasAttribute('tabindex') || el.scrollWidth <= el.clientWidth + 1 || el.querySelector('a, button, input, [tabindex]')) return;
        el.tabIndex = 0;
        el.setAttribute('role', 'region');
        el.setAttribute('aria-label', scroll);
      });
    };
    const schedule = () => (frame ||= requestAnimationFrame(fix));
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [pathname, code, toc, scroll]);
  return null;
}
