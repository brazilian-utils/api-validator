# Design

The site documents seven libraries that validate, format and generate Brazilian identifiers: CPF,
CNPJ, CEP, license plates, boletos and more. Readers are developers. They come to one page with one
question: how do I call this in my language, and does my library do it right?

## Stack

Next.js (static export) with Fumadocs, the documentation framework behind many current developer
docs. Fumadocs brings the parts readers already know from those sites: search (⌘K), a sidebar per
section, a table of contents that follows the scroll, code blocks with a copy button, synced tabs,
type tables, accordions and callouts. The site keeps all of it and adds only what the data needs.

## Layout

One header on every page (`site-header.client.tsx`), laid out like vuejs.org: the logo and the
search on the left; the sections of the site (Utilities, Libraries, Guides, Contributing, About),
then theme and language, then GitHub on the right. The bar spans the window in the header's own
paper tone; its content sits in the site's column. The home page and the documentation share that
column (`--site-width`, 80rem): the docs' sidebar, page and table of contents sit inside the same
edges as the home page's sections, so nothing moves from one to the other. The same footer closes
both. The sidebar lists only the pages of the current section; utility categories start closed.

```
┌ [dog BRAZILIAN UTILS] [ Search ⌘K ]     Utilities Libraries Guides Contributing About │ ☀/☾ 文A │ GitHub ┐
├──────────────┬──────────────────────────────────────────────┬──────────────────┤
│ Getting      │ CPF                                          │ On this page     │
│ started      │ Cadastro de Pessoas Físicas, …               │   Validate       │
│ ▾ Personal   │ [Contract] [Edit]                            │   Format         │
│   CPF        │ JS ✓ complete  Py ◐ no Parse …   one row     │   …              │
│   CNH …      │                                              │   Specification  │
│ ▸ Companies  │ Validate  cpf.isValid                        │   Official       │
│ ▸ …          │ ┌ cpf.isValid(cpf: string): boolean ─────┐   │   sources        │
│              │ ✓ JavaScript ✓ Python …                      │                  │
│              │ JS  Py  Go  Ruby  Rust  .NET  Erlang (tabs)  │                  │
│              │ ─ ▸ Try it ─ ▸ Shared test cases ─           │                  │
│              │ ← Previous page                  Next page → │                  │
└──────────────┴──────────────────────────────────────────────┴──────────────────┘
```

The home page: a two-line headline with the numbers in its sentence, and the document specimen: type
a number and the JavaScript library masks it as you type (the same way its "Document field" guide
does), says which document it is, shows it with the check digits highlighted, valid or not (and
which check digits a wrong number should have), and names the same function in every language. It
starts on a CPF that is well formed but fails, so the page never shows a number that could be
someone's; "Generate a valid one" asks the library for one. Every check on the site is the
libraries' own code. Then the same first call in each language as tabs (install command and a real
usage example), the four steps that keep the libraries the same, and every utility by category
with how many libraries have it.

## Tokens

Color: [Flexoki](https://stephango.com/flexoki), an ink-on-paper palette. Warm paper
(`#fffcf0`), a darker paper for the header, the hero and cards (`#f2f0e5`), ink text, a cyan
accent (`#1c6c66` light, `#3aa99f` dark). The dark theme is Flexoki's black (`#100f0f`).

The brand colors (github.com/brazilian-utils/brand: green `#009c3b`, yellow `#ffdf00`, blue
`#3e4095`) stay where they mean something: the yellow behind check digits, and the three stripes
at the bottom of the link preview image.

State is an icon first and a color second: ✓ all good (green), ◐ some (amber), ✕ a case fails
(red), ! signature differs (amber), ○ not implemented (muted), - not planned or not run.

Type: Geist Sans for text, Geist Mono for code and document numbers (self-hosted, no CDN). The
wordmark is the brand logo itself (github.com/brazilian-utils/brand). Headings are set as on the
home page: a page title at 2.25rem with tight tracking, clearly above its sections.

Shape: controls (inputs, buttons, kbd) 6px; containers (code blocks, notes, the specimen, the
demo frame) 12px; chips and the search pill fully round. No drop shadows: a border draws an edge.
One focus style everywhere: a 2px outline in the ring color, 2px away.

## Rules

The site follows [Impeccable](https://impeccable.style) (github.com/pbakaus/impeccable) and
[Taste Skill](https://www.tasteskill.dev) (github.com/Leonxlnx/taste-skill). Design read, as
Taste Skill asks for it: developer documentation for engineers in seven languages, in a calm
technical language, on Fumadocs with the Flexoki palette and Geist. Dials: variance 4, motion 3,
density 5. Impeccable mode: Read (the home page leans Persuade).

1. Every text meets WCAG 2.1 AA in both themes, code included (Shiki's high-contrast themes).
   `npm run a11y` checks it on every page type, light and dark, desktop and phone.
2. No card inside a card. Tabs are a row of labels over a rule, with the panel below and no box
   around it (`flat-tabs.tsx`); a second level of tabs (the variants of a guide example) is
   `compact`, small labels with no rule, so two levels never look alike. On a phone the labels
   wrap instead of scrolling out of sight. "Try it" and the test cases are native `<details>`
   between rules (`disclosure.tsx`). A code block is the only surface in a tab; the files of a
   guide example are the code block's own title bar (`file` tabs), a third look for a third level.
   Lists of pages or people (guides of a utility, the team) are rows between rules, not cards.
3. Notes are a tinted surface with an icon (`note.tsx`), never a colored side stripe.
4. No eyebrow labels, no hero metrics, no section numbers, no decorative dots or icons that repeat
   on every row, no progress bars or rings with tracks, no gradient text, no em-dashes, no layout
   animated (a live demo keeps its reserved height and only fades in). Numbers appear in sentences, where they mean
   something ("every one runs the same 814 test cases").
5. Running text stops at 52ch (about 72 characters in Geist); tables and code keep the column.
6. The parts the browser draws are themed: selection, caret, scrollbars, focus ring, link
   underline offset, tabular figures.
7. The page loads what it shows. Search, the full reference library and the demos load on use.
8. Both languages everywhere, from the same data.

`npm run design` runs Impeccable's detector (61 rules) on every page type, desktop and phone, and
CI fails on any finding. Exceptions, each on purpose:

- `cream-palette`: the warm paper is Flexoki's, the palette the maintainers chose for the site.
  Impeccable's own rule is that a pinned palette wins over a saturated-pattern warning.
- Lucide icons stay (Taste Skill prefers Phosphor or Tabler): Fumadocs draws its own interface
  with Lucide, and one stroke family across the page matters more than the family.

## Tried and dropped

- Starlight with its own themes (default, Nova, Rapide, Black, Galaxy, Flexoki, Next): the
  sidebar stayed one long list, and the theme could not separate the header from the page.
- One sidebar for the whole site: about 60 entries at once. Replaced by the sections in the
  header.
- Pills with borders for the status of each library under a function in the first design: noise
  at 7 libraries × 5 functions per page. Now small chips with an icon and the library name.
