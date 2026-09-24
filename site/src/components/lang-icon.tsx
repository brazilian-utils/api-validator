// The language's logo, in its brand color (Simple Icons). Decorative: the name is always next to it.
// Each logo's outline is on the page once, as a <symbol> (LangIconDefs, in the root layout), and
// every icon points at it: a page that names the libraries a hundred times carries one copy.
import { siDotnet, siErlang, siGo, siJavascript, siPython, siRuby, siRust } from 'simple-icons';

const ICONS: Record<string, { path: string; hex: string }> = {
  javascript: siJavascript,
  python: siPython,
  go: siGo,
  ruby: siRuby,
  rust: siRust,
  dotnet: siDotnet,
  erlang: siErlang,
};

/** The outlines, once per page. */
export function LangIconDefs() {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute">
      <defs>
        {Object.entries(ICONS).map(([lib, icon]) => (
          <symbol key={lib} id={`lang-${lib}`} viewBox="0 0 24 24">
            <path d={icon.path} />
          </symbol>
        ))}
      </defs>
    </svg>
  );
}

export function LangIcon({ lib, className = 'size-4' }: { lib: string; className?: string }) {
  const icon = ICONS[lib];
  if (!icon) return null;
  // Rust's brand color is black: the text color, so it shows in the dark theme. The .NET purple and
  // the Erlang red are too dark on the dark paper: the text color there too.
  const color = icon.hex === '000000' ? 'currentColor' : `#${icon.hex}`;
  const dark = lib === 'dotnet' || lib === 'erlang' ? 'dark:fill-current' : '';
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${dark} ${className}`} fill={color}>
      <use href={`#lang-${lib}`} />
    </svg>
  );
}
