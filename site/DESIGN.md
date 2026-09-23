# Design plan

The site documents seven libraries that validate, format and generate Brazilian identifiers: CPF,
CNPJ, CEP, license plates, boletos and more. Readers are developers. They come to one page with one
question: how do I call this in my language, and does my library do it right?

## Subject

The material of the subject is the **masked number**: `529.982.247-25`, `11.222.333/0001-81`,
`01310-100`, `BRA2E19`. Digits carry the value, separators carry the format, and the last digits
are the **check digits** that make a number valid or not. The design takes its one bold element
from that material.

## Tokens

Color (brand palette from github.com/brazilian-utils/brand, tuned for contrast):

| Name        | Light     | Dark      | Role |
|-------------|-----------|-----------|------|
| paper       | `#ffffff` | `#16172e` | page background (dark is a night version of the brand blue, not grey) |
| ink         | `#1d1f3d` | `#e9eaf6` | text: brand blue darkened, instead of a neutral black |
| green       | `#00692a` | `#4ad17f` | accent: links in the sidebar, "implemented", focus ring (AA on paper) |
| brand green | `#009c3b` | `#009c3b` | large marks only: the header stripe, filled status marks (not text) |
| blue        | `#3e4095` | `#b9bbf5` | links in running text |
| highlighter | `#ffdf00` | `#ffdf00` | brand yellow, only behind check digits (ink text on it) |

Type:

- **Samba** (brand face) for the site name and page titles only.
- **Atkinson Hyperlegible Next** for all text. Made by the Braille Institute so that `0/O`,
  `1/l/I` and `5/S` never look alike. That matters on a site about document numbers.
- **Atkinson Hyperlegible Mono** for code and identifiers, for the same reason.
- Scale: 1.2 ratio, body 1rem/1.6, line length below 75 characters.

## Layout

Starlight's three columns stay (sidebar, content, table of contents): readers know them.

Home page, left aligned:

```
[dog] Brazilian Utils                                    (title, Samba)
One spec for Brazilian documents. Seven libraries follow it.

 ┌ Type a document ─────────────────────────────────────┐
 │ 529.982.247-25                                       │   the specimen: live, formats as you
 └──────────────────────────────────────────────────────┘   type, check digits highlighted
 CPF, valid. Check digits 25.
 JavaScript isValidCpf   Python is_valid_cpf   Go cpf.IsValid ...

Libraries         table: language, package, install, contract coverage, status page
How it works      numbered list (it is a sequence): contract → issues → site
```

Utility page: summary, then one plain line per library ("JavaScript: 4 of 5 operations"), then
the spec, then one section per operation.

## Principles

1. One bold element: the check-digit highlighter. It appears in the home specimen, and nowhere as
   decoration.
2. Structure encodes information: tables for things with columns, lists for sequences, no card
   grids, no all-caps labels, no middle-dot meta strings, no arrows appended to links.
3. Status is text first (✓ implemented, ✕ failing, – missing), color second.
4. Every text and control meets WCAG 2.1 AA in both themes; visible focus; reduced motion.

## Review against the defaults

- First draft kept the Starlight splash hero with the big dog on the right and a four-card grid
  under it. That is the template every Starlight site ships with. Replaced by the specimen: the
  reader does the thing the libraries do in the first second on the page.
- First draft used brand green for links. `#009c3b` on white is 3.6:1 and fails AA. Links in text
  use the brand blue (8.9:1), the green is darkened to `#00692a` where it carries text.
- Considered a cream paper background: that is a generated-page default. White stays, with the
  ink drawn from the brand blue.

## Notes from the first pass

What was measured, so the next pass starts from numbers:

- Accessibility (axe-core 4.10, WCAG 2.1 A and AA plus best practices, 13 pages, light and dark, every
  `<details>` open): 328 failing elements before, 0 after. The audit script and the keyboard walk
  live outside the repo. Run them again after any change to colors or components.
- The keyboard reaches every control on the home page, with a visible focus ring on each one. The
  specimen and the try-it box work without a mouse.
- JavaScript on the home page: 6 KB. The specimen imports each function from its own entry point
  (`@brazilian-utils/brazilian-utils/format-cpf`). A plain import of the package pulls in 605 KB,
  because Vite shares one chunk with the try-it box, which loads the whole package when it opens.
- Contrast pairs used for text are all 5.8:1 or more. The brand green `#009c3b` (3.6:1 on white)
  only draws marks and the header stripe.

Tried and dropped:

- Pills with borders for the status of each library under a function: noise at 7 libraries × 5
  functions per page. Plain marks with the library name read faster.
- A giant mascot in the hero: the brand already shows it in the header. The specimen took its place.
