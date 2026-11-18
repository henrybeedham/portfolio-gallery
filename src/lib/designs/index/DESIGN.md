# Design Spec — “Index”

A Swiss / International Typographic Style design for the gallery. Precise grotesk type, a visible
12-column grid, hairline rules, flush-left text and numbered everything. The photographs are the
content; the interface is a catalogue of them.

**For AI agents:** everything here is a requirement while `data-design="index"`. All CSS lives in
this folder and is scoped to `:root[data-design='index']`; colours come only from the theme tokens
(see the root `DESIGN.md` for the token table), so the design works in every theme, including
per-album themes.

---

## 1. Character

- **Grid first.** Every layout snaps to 12 columns. The grid is sometimes shown outright (faint
  column guides behind the home hero).
- **Type does the work.** Huge, tight grotesk headlines; small mono metadata. No serif anywhere.
- **Rules, not boxes.** A 1px `--text` rule opens a section; `--border` hairlines separate rows.
  Panels and cards have no fill, no border box and no shadow.
- **Numbered.** Sections are `01 — Featured`, `02 — Index`; list items, tabs and photos carry
  numbers (`01`, `012`). Admin panel headings are numbered automatically with a CSS counter.
- **Flush left, ragged right.** Nothing is centred except icons in buttons.
- **Crisp motion.** 150–250ms, `cubic-bezier(0.2, 0, 0, 1)`. Hover inverts or underlines — never
  zooms, lifts or casts shadows.

---

## 2. Tokens (non-colour)

```css
--font-sans: 'Inter Tight Variable', …; /* everything */
--font-serif: var(--font-sans); /* shared pages that ask for the serif */
--font-mono: 'JetBrains Mono Variable', …; /* metadata, counts, dates, numbers, labels */
--cols: 12;
--gutter: clamp(1rem, 3vw, 2.5rem);
--col-gap: clamp(0.75rem, 1.6vw, 1.5rem);
--max-width: 1600px;
--header-height: 56px;
--rule: 1px solid var(--text);
--hairline: 1px solid var(--border);
--ease: cubic-bezier(0.2, 0, 0, 1);
--fast: 150ms;
--base: 200ms;
--slow: 250ms;
--ink: var(--highlight, var(--text)); /* emphasis: gold in the green theme */
--admin-top: 90px; /* height of the sticky admin bar */
```

Fonts are self-hosted: `@fontsource-variable/inter-tight`, `@fontsource-variable/jetbrains-mono`.

---

## 3. Typography

| Role               | Face / weight       | Size                             | Tracking / leading |
| ------------------ | ------------------- | -------------------------------- | ------------------ |
| Home hero          | grotesk 650         | `clamp(2.6rem, 10.4vw, 11.5rem)` | −0.055em / 0.86    |
| Galleries title    | grotesk 650         | `clamp(3.25rem, 13vw, 13rem)`    | −0.06em / 0.84     |
| Album title        | grotesk 650         | `clamp(2.5rem, 8.5vw, 9rem)`     | −0.055em / 0.88    |
| Section title (h2) | grotesk 600         | `clamp(2rem, 4.6vw, 4.25rem)`    | −0.045em / 0.92    |
| Admin page title   | grotesk 650         | `clamp(2.4rem, 6vw, 5rem)`       | −0.05em / 0.9      |
| Panel title        | grotesk 600         | `clamp(1.35rem, 2.2vw, 1.75rem)` | −0.035em           |
| Index row title    | grotesk 550         | `clamp(1.15rem, 2.2vw, 1.75rem)` | −0.03em            |
| Lead / description | grotesk 450         | `clamp(1.1rem, 1.5vw, 1.35rem)`  | −0.015em / 1.3     |
| Body               | grotesk 400         | 15px                             | 1.5                |
| Mono label         | mono 450, uppercase | 0.68–0.72rem                     | 0.02em             |
| Stat figure        | mono 500            | `clamp(1.5rem, 2.4vw, 2.1rem)`   | −0.04em, tabular   |

Big headlines get `margin-left: -0.04em` so the heavy capitals sit optically on the grid line.
Every number is mono with `tabular-nums`. Dates are `15.10.2026`; counts are padded (`012 img`).

---

## 4. Layout patterns

- **`.grid-12`** — 12 columns with `--col-gap`; children span all 12 unless they place themselves.
- **`.sec-head`** — the numbered section head: strong rule, `.sec-no` in cols 1–2, `h2` in 3–9,
  `.sec-aside` (count or link) right-aligned in 10–12. Stacks below 720px.
- **Home** — a mono meta row on a rule (`00 · Index · 6 galleries · View Work ↓`), the hero headline
  across all 12 columns over faint column guides, then the description + button in cols 1–4 and the
  hero photo in a 3:2 cell in cols 5–12 with a `Fig. 00` caption. Featured: `01 — Featured`, the
  description sticky in cols 1–3, the photos in 4–12. Then `02 — Index` and `03 — About`.
- **The index** (`AlbumIndex.svelte`) — a ruled table: No. · Title · Date · Count · ↗. Hovering or
  focusing a row inverts it and shows its cover in a sticky 4:5 cell in cols 9–12 (`Fig. 02`).
  Below 960px each row carries its own square thumbnail.
- **Galleries** — giant title, `01 — List` (the index), `02 — Contact sheet` (a compact square-cover
  grid, 2 → 4 → 6 columns, numbered captions).
- **Album** — sticky 48px top bar (back · title · count). Title on a rule across the grid. Left
  column (cols 1–3, sticky): facts list (Date, Photos, Expiry), Download All / Select to Download,
  tag filter and sort. Photos in cols 4–12.
- **Photo grid** — columns follow the container (container queries: 2 → 3 → 4 → 5). Square tiles
  (or natural ratio in masonry) with a mono caption: `012  IMG_0024.jpg`. Hover draws a 2px ink
  frame inside the photo and inverts the number.
- **Gates** (password, expired, error, admin login) — flush left and bottom-aligned: a rule, a mono
  label, a huge headline, then the form (input and button joined in one row).
- **Admin shell** — two-row sticky bar: `ADMIN` tag + site title with Search / public site / sign
  out on the right, then numbered mono tabs (`01 Dashboard … 08 Settings`) that scroll sideways on
  phones. The active tab is inverted.
- **Dashboard** — on the grid: money strip (flat, ruled, mono figures; hover inverts), Needs
  attention (cols 1–7) beside Coming up (cols 8–12, mono date blocks), then Gallery activity full
  width with its week strip, ranked list and recent covers side by side.

---

## 5. Components

- **Buttons** — square, 1px, mono uppercase 0.72rem, min-height 44px (36px small). Hover inverts to
  `--ink` fill. `.btn-solid` is filled ink; `.btn-accent` uses `--accent`; `.btn-quiet` has a
  `--border-strong` outline.
- **Links** — mono uppercase; an underline appears on hover.
- **Inputs** — `--bg-elevated`, 1px `--border-strong`, square. Focus thickens the border to 2px of
  `--ink` (inset shadow), no outline.
- **Chips** — mono, joined edge to edge (`margin-right: -1px`); active uses `--accent`.
- **Tables** — header row in mono on a strong rule; first/last cells flush with the section edge;
  figures in mono tabular numerals.
- **Badges** — mono uppercase, 1px border, semantic `-soft` fill.
- **Panels** — no box: strong top rule, auto-numbered heading (`01`, `02` …), hairline under it.
- **Stat strips** — flat cells separated by hairlines between a strong top rule and a hairline
  bottom; linked cells invert on hover.
- **Charts** — mono axis text; square swatches and bar ends; 1.5px mitred lines; tooltips with a
  `--text` border and no shadow.
- **Lightbox** — fixed light-on-dark chrome (the one exception to theme colours): an inverted mono
  counter, square 48px prev/next boxes that invert on hover, no shadow under the photo.
- **Selection bar** — `--bg` with a `--text` border and a flat offset shadow.
- **Focus** — `2px solid var(--ink)`, offset 2px.

---

## 6. Motion

| Interaction                       | Duration                                        |
| --------------------------------- | ----------------------------------------------- |
| Hover invert / underline / border | 150ms                                           |
| Header rule, toggles              | 200ms                                           |
| Image fade-in                     | 250ms (opacity only)                            |
| Headline / rule / image wipe-in   | 400–600ms `index-wipe` (clip-path left → right) |
| Entrance rise                     | 250ms, 6px, staggered ~40–60ms                  |
| Route progress bar                | 1.2s in 12 steps — one per column               |

`prefers-reduced-motion` collapses all of it (handled globally in `app.css`).

---

## 7. Do / Don’t

| Do                                                | Don’t                                             |
| ------------------------------------------------- | ------------------------------------------------- |
| Snap to 12 columns; show the grid when it helps   | Centre layouts or float things off-grid           |
| Grotesk 550–650, negative tracking, tight leading | Serif, italics, weight-400 display type           |
| Mono for every number, date, count and label      | Tracked-out uppercase sans labels                 |
| Number sections and items (`01 —`, `012`)         | Decorative icons standing in for labels           |
| Rules and hairlines                               | Filled cards, rounded corners, shadows on content |
| Hover = invert or underline                       | Hover = zoom, lift or glow                        |
| `var(--ink)` for emphasis                         | Hex colours in components                         |

---

## 8. Files

- `index.ts` — loads the fonts, `design.css` and `admin.css`.
- `design.css` — tokens, base elements, utilities, buttons, forms, plus overrides for the shared
  Lightbox, PasswordGate, ExpiredNotice and ErrorPage (which use the Editorial markup).
- `admin.css` — overrides for the shared admin pages, components and charts, and the dashboard grid.
- Slots: `SiteHeader`, `SiteFooter`, `Home`, `Galleries`, `AlbumCard`, `AlbumView`,
  `PhotoGallery`, `AdminShell`.
- Helpers: `AlbumIndex.svelte` (the ruled index with hover preview), `format.ts` (numeric dates,
  padded numbers).
