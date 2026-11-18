# Design Spec — “Monograph”

A classical fine-art photobook, or a museum catalogue. Pages are centred and symmetrical, set in
Garamond with true italics and real small capitals. Photographs are presented as mounted prints on
mat board, numbered as plates and captioned like wall labels. The admin reads like a studio ledger.

This file documents the `monograph` design (`src/lib/designs/monograph/`). Everything here is scoped
to `<html data-design="monograph">`; colours still come only from the active theme.

---

## 1. Character

- **Centred and bookish.** Mastheads, titles, section heads and notices are centred. Left-aligned
  text is for reading columns, tables and forms.
- **Garamond, never sans display.** Display type is Cormorant Garamond at weight 400–500, with
  alternate italic lines. Text is EB Garamond. Labels are real small capitals, never tracked
  uppercase.
- **Prints, not tiles.** Every photograph sits on a mat: an elevated board with a hairline edge and
  a bevel line around the window. Captions sit beneath, like wall labels.
- **Numbered like a book.** Sections carry roman numerals (I, II, III), photos are “Plate IV”,
  galleries are “No. III”, and lists of galleries are tables of contents with leader dots.
- **Rules and ornaments.** Thin double rules (3px `double`) frame mastheads, ledgers and panel heads;
  a hairline broken by a small lozenge (`.ornament`) closes titles.
- **Slow fades only.** 0.6–1.6s opacity fades. No rises, no zooms, no slides.

---

## 2. Colour

Unchanged: only theme tokens (`--bg`, `--bg-elevated`, `--text`, `--border-strong`, …). The mat is
`--bg-elevated` on `--bg`, so it reads as ivory board in light, dark board in dark and green board
in green. Numerals, ornaments and the current-page underline use `var(--highlight, …)`, so the
green theme’s gold picks them up. Tints use `color-mix()`. The lightbox keeps its fixed ivory-on-dark
chrome, the one place with literal colours.

---

## 3. Typography

| Token            | Family                                 | Use                                             |
| ---------------- | -------------------------------------- | ----------------------------------------------- |
| `--font-display` | Cormorant Garamond Variable (+ italic) | h1–h4, numerals, stat figures, drop capitals    |
| `--font-serif`   | EB Garamond Variable (+ italic)        | Body, prose, tables, inputs, captions           |
| `--font-sc`      | Cormorant SC (500/600/700)             | Small-capital labels, buttons, nav, table heads |
| `--font-sans`    | Source Sans 3 Variable                 | Chart axes, key hints, video durations only     |

All self-hosted through `@fontsource` / `@fontsource-variable` (imported in `index.ts`).

- **Body:** 17px (1.0625rem), line-height 1.6, old-style figures. Admin ledgers use old-style
  tabular figures; big figures (stats, almanac dates, totals) use Cormorant’s lining figures.
- **Small capitals.** Cormorant SC draws lowercase letters as small capitals, so a Title Case label
  (“View Work”) renders as capitals and small capitals. Never set `text-transform: uppercase`. Size
  0.92–1.08rem, weight 600, tracking 0.05–0.08em (wider, 0.2em, for single-word kickers).
- **Headings:** Cormorant 400 (display) / 500 (panels), no negative tracking, `text-wrap: balance`.

| Role               | Size                                                                  |
| ------------------ | --------------------------------------------------------------------- |
| Masthead title     | `clamp(2.4rem, 7vw, 4.6rem)` home; `clamp(2rem, 5.2vw, 3.4rem)` inner |
| Frontispiece h1    | `clamp(2.5rem, 6.6vw, 5.4rem)`, alternate lines italic                |
| Album / page title | `clamp(2.7rem, 7.4vw, 5.8rem)`                                        |
| Section title (h2) | `clamp(2.2rem, 4.8vw, 3.6rem)`                                        |
| Admin page title   | `clamp(2.4rem, 5vw, 3.6rem)`                                          |
| Panel / page head  | 1.7–2.4rem                                                            |
| Lede (italic)      | `clamp(1.1rem, 1.6vw, 1.28rem)`, max 34rem, centred                   |

---

## 4. Building blocks (global classes in `design.css`)

- `.sc` — small-capital label. `.eyebrow` is the same at 1rem in `var(--highlight, --text-muted)`.
- `.section-title` — centred grid: `.numeral` (roman, tracked), eyebrow, h2, `.ornament`, `.lede`.
- `.ornament` — 13rem hairline with a central lozenge and two dots. Decorative (`aria-hidden`).
- `.double-rule` — `hr` with a 3px double top border in `--border-strong`.
- `.mat` / `.print` — mounted print. `.mat`: `--bg-elevated`, 1px `--border`, padding `--mat-pad`
  (`clamp(0.7rem, 5%, 2.25rem)`). `.print`: `--placeholder` and `--bevel` (a 3px board-coloured gap
  then a 1px line), the bevel cut around the window.
- `.wall-label` — centred caption: `.plate` (small caps, highlight), `.title` (italic), `.meta`
  (small caps, subtle).
- `.title-card > .frame` — a bordered card with an inner 3px double frame; used for the password
  gate, the expired notice and the admin sign-in.
- `.lede` — narrow centred italic paragraph.

### Buttons

Small-capital label, square. `.btn` has a **3px double border** (an engraved frame); `.btn-quiet`
and `.btn-sm` use a single hairline. Hover inverts to ink (or highlight) over 0.5s. `.link` is a
small-capital text action whose hairline underline fades in on hover.

### Forms

Inputs and selects are **ruled lines** (bottom border only), like a form to fill in; focus thickens
the rule to 2px in ink/highlight. Textareas keep a hairline frame. Labels are small caps; hints and
placeholders are italic.

---

## 5. Public pages

- **Masthead** (`SiteHeader`): centred title, a double rule, small-caps nav separated by middle dots,
  a hairline. Static, not sticky. Once it scrolls away a slim **running head** fades in (italic title
  centred, nav right), like a book’s running head. No hamburger: the three links fit at 360px.
- **Home**: a frontispiece — the hero image matted and centred, the headline beneath it like a
  title page, ornament, italic lede, “View Work”. Then numbered sections: I the featured collection
  as numbered plates; II a **table of contents** of galleries (numeral, title, leader dots, plate
  count) beside a sticky matted cover that follows the hovered entry (on phones each entry carries a
  small matted thumbnail instead); III About, justified, with a drop capital, and a centred
  correspondence block.
- **Galleries**: centred title page, a Contents list, then the collections as matted covers numbered
  “No. I, II…” with wall labels.
- **Album**: a running head bar, then a title page (site name kicker, title, ornament, date and count
  in small caps, narrow italic description, actions). A sticky index of tags in small caps with the
  sort “Order” select. Plates in a 2 → 3 column grid; in grid layout every print sits in the same
  square window so portraits and landscapes hang at one height. The end reads “Finis”.
- **Lightbox**: dark, with the print outlined by a faint bevel line and a caption beneath
  (“Plate IV”, italic title). Fades between photos; no slide.
- **Gate / expired / error**: `.title-card` with a lozenge icon, ornament and italic copy.

## 6. Admin

- **Shell** (`AdminShell`): a centred masthead (“The Studio Ledger” kicker, italic site title), public
  site link left, search and sign out right, double rule, then the eight sections as a small-caps
  index. Below 1024px the index becomes a menu button that opens a full-screen **Contents** page
  numbered I–VIII.
- **Page heads**: every admin page’s first header is centred, with its section’s roman numeral above
  (`--section-numeral`, set by the shell) and an ornament below the title.
- **Ledgers**: `ui-stats` is a strip between double rules with centred Cormorant figures;
  tables have small-caps heads over a double rule and hairline rows; filter chips are a small-caps
  index with the current entry underlined.
- **Dashboard** (`AdminDashboard`): a book **spread** — “Needs Attention” on the left page
  (numbered chapters, entries with leader dots to the amount) and “Coming Up” on the right as an
  almanac of large dates — divided by a gutter rule; then “Gallery Activity” as a centred section
  with three large figures, a most-visited contents list and matted thumbnails.
- Shared admin pages and components are restyled from `admin.css`, whose rules start with
  `:root[data-design='monograph']` so they outrank Svelte-scoped page styles.

## 7. Motion

| What                | How                                     |
| ------------------- | --------------------------------------- |
| Image load          | opacity 0.9s                            |
| Hero / headline     | opacity 1.2–1.6s, lines staggered 0.25s |
| Hover colour, rules | 0.4–0.6s                                |
| Running head, menus | opacity 0.4–0.7s                        |
| Lightbox change     | 0.6s cross-fade                         |

No transforms on hover, no zoom, no parallax. `prefers-reduced-motion` is honoured by app.css.

## 8. Do / Don’t

| Do                                            | Don’t                                         |
| --------------------------------------------- | --------------------------------------------- |
| Centre titles; number sections and plates     | Left-aligned hero slabs, full-bleed scrims    |
| Small capitals from Cormorant SC              | `text-transform: uppercase`, tracked sans     |
| Mat every photograph; caption it beneath      | Edge-to-edge tiles, hover zooms               |
| Double rules, hairlines, the lozenge ornament | Shadows on cards, rounded corners             |
| Italic for descriptions, notes and sub-lines  | Bold text for emphasis                        |
| Theme tokens and `color-mix()`                | Literal colours (outside the lightbox chrome) |

## 9. Implementation notes

- `design.css` is wrapped in `html:where([data-design='monograph'])` (tokens in `&:root`) so each
  rule beats the shared `app.css` rule it replaces but still yields to this design’s component styles.
- `admin.css` uses `:root[data-design='monograph']` for the extra weight needed on shared pages.
- Slots provided: SiteHeader, SiteFooter, Home, Galleries, AlbumCard, AlbumView, PhotoGallery,
  Lightbox, PasswordGate, ExpiredNotice, ErrorPage, AdminShell, AdminDashboard, AdminLogin. Private
  helpers: `ContentsList.svelte`, `format.ts` (`roman`, `photoTitle`).
