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
│ Getting      │ Personal documents                           │ On this page     │
│ started      │ CPF                                          │   Validate       │
│ ▾ Personal   │ Cadastro de Pessoas Físicas, …               │   Format         │
│   CPF        │ [Contract] [Edit]                            │   …              │
│   CNH …      │ [JS 4/5][Py 4/5][Go 3/5] …  one card a lib   │   Specification  │
│ ▸ Companies  │                                              │   Official       │
│ ▸ …          │ Validate  cpf.isValid                        │   sources        │
│              │ ┌ cpf.isValid(cpf: string): boolean ─────┐   │                  │
│              │ ✓ JavaScript ✓ Python …                      │                  │
│              │ description · ⚠ pending decision · params    │                  │
│              │ [JS][Py][Go][Ruby][Rust][.NET][Erlang] tabs  │                  │
│              │ ▸ Try it   ▸ Shared test cases               │                  │
└──────────────┴──────────────────────────────────────────────┴──────────────────┘
```

The home page is a product page: a headline, the document specimen (type a number, see it
formatted with the check digits highlighted, valid or not, and the same function in every
language), the project in numbers, one card per library with its install command and coverage,
the four steps that keep the libraries the same, and every utility by category.

## Tokens

Color: [Flexoki](https://stephango.com/flexoki), an ink-on-paper palette. Warm paper
(`#fffcf0`), a darker paper for the header, the hero and cards (`#f2f0e5`), ink text, a cyan
accent (`#1c6c66` light, `#3aa99f` dark). The dark theme is Flexoki's black (`#100f0f`).

The brand colors (github.com/brazilian-utils/brand: green `#009c3b`, yellow `#ffdf00`, blue
`#3e4095`) stay where they mean something: the yellow behind check digits, and the three stripes
at the bottom of the link preview image.

State is an icon first and a color second: ✓ all good (green), ◐ some (amber), ✕ a case fails
(red), ! signature differs (amber), ○ not implemented (muted), – not planned or not run.

Type: Geist Sans for text, Geist Mono for code and document numbers (self-hosted, no CDN). Samba,
the brand face, only for the wordmark in the header.

## Rules

1. Every text meets WCAG 2.1 AA in both themes, code included (Shiki's high-contrast themes on
   the paper background). `npm run a11y` checks it on every page type, light and dark, desktop
   and phone.
2. Structure encodes information: tables for things with columns, tabs for alternatives (one
   library, one framework), accordions for what most readers skip (try it, test cases).
3. The page loads what it shows. Search, the full reference library and the demos load on use.
4. Both languages everywhere, from the same data.

## Tried and dropped

- Starlight with its own themes (default, Nova, Rapide, Black, Galaxy, Flexoki, Next): the
  sidebar stayed one long list, and the theme could not separate the header from the page.
- One sidebar for the whole site: about 60 entries at once. Replaced by the sections in the
  header.
- Pills with borders for the status of each library under a function in the first design: noise
  at 7 libraries × 5 functions per page. Now small chips with an icon and the library name.
