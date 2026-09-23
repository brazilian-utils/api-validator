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

The Fumadocs "notebook" layout: a full-width header with its own background and a rule under it,
so the frame reads apart from the page. The header holds the logo, the search, the language, the
theme and GitHub, and a second row with the four sections of the site as tabs: Utilities,
Libraries, Guides, Contributing. The sidebar lists only the pages of the current section; utility
categories start closed.

```
┌ [dog] Brazilian Utils        [ Search            ⌘K ]           GitHub  文A  ☀/☾ ┐
│ Utilities   Libraries   Guides   Contributing                                    │
├──────────────┬──────────────────────────────────────────────┬──────────────────┤
│ Getting      │ CPF                                          │ On this page     │
│ started      │ Cadastro de Pessoas Físicas, …               │   Validate       │
│ ▾ Personal   │ [Contract] [Edit]                            │   Format         │
│   CPF        │ JS ◐ 4/5  Py ◐ 4/5  Go ◐ 3/5 …  one row      │   …              │
│   CNH …      │                                              │   Specification  │
│ ▸ Companies  │                                              │   Official       │
│ ▸ …          │ Validate  cpf.isValid                        │   sources        │
│              │ ┌ cpf.isValid(cpf: string): boolean ─────┐   │                  │
│              │ ✓ JavaScript ✓ Python …                      │                  │
│              │ description · ⚠ pending decision · (params)  │                  │
│              │ JS  Py  Go  Ruby  Rust  .NET  Erlang (tabs)  │                  │
│              │ ─ ▸ Try it ─ ▸ Shared test cases ─           │                  │
└──────────────┴──────────────────────────────────────────────┴──────────────────┘
```

The home page: a two-line headline with the numbers in its sentence, and next to it the JavaScript
library's own "Document field" guide, live (a field that masks and validates as you type, in React,
Angular, Vue or plain JavaScript). Every example on the site comes from the libraries; the site
writes none of its own. Then the same first call in each language as tabs (install command and a
real usage example), the four steps that keep the libraries the same, and every utility by
category with how many libraries have it.

## Tokens

Color: [Flexoki](https://stephango.com/flexoki), an ink-on-paper palette. Warm paper
(`#fffcf0`), a darker paper for the header, the hero and cards (`#f2f0e5`), ink text, a cyan
accent (`#1c6c66` light, `#3aa99f` dark). The dark theme is Flexoki's black (`#100f0f`).

The brand colors (github.com/brazilian-utils/brand: green `#009c3b`, yellow `#ffdf00`, blue
`#3e4095`) stay where they mean something: the three stripes at the bottom of the link preview
image.

State is an icon first and a color second: ✓ all good (green), ◐ some (amber), ✕ a case fails
(red), ! signature differs (amber), ○ not implemented (muted), - not planned or not run.

Type: Geist Sans for text, Geist Mono for code and document numbers (self-hosted, no CDN). Samba,
the brand face, only for the wordmark in the header.

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
   between rules (`disclosure.tsx`). A code block is the only surface in a tab.
3. Notes are a tinted surface with an icon (`note.tsx`), never a colored side stripe.
4. No eyebrow labels, no hero metrics, no section numbers, no decorative dots, no progress bars
   with tracks, no gradient text, no em-dashes. Numbers appear in sentences, where they mean
   something ("every one runs the same 814 test cases").
5. Running text stops at 62ch (about 78 characters in Geist); tables and code keep the column.
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
