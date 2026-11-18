# Design Spec — "Contact Sheet"

An analogue-darkroom design system: the site reads like a lab's contact sheets, envelopes and
ledger. Photos stay the hero; the interface is the paperwork around them.

**For AI agents:** treat everything here as a requirement. Colours come only from theme tokens.
No rounded cards, soft shadows, gradients-as-decoration or zoom-on-hover.

## 0. Where it lives

Everything is in `src/lib/designs/contact-sheet/` and only applies when `<html data-design="contact-sheet">`.

- `index.ts` loads the fonts and the two stylesheets.
- `design.css` holds the tokens, base type, film primitives, buttons, forms and prose.
- `admin.css` holds the ledger (`ui-*` classes, charts), plus scoped overrides for shared admin pages and components that aren't slots.
- `helpers.ts` provides `formatStampDate` (“18.11.26”) and `frameNo` (“07”).
- Slots: SiteHeader, SiteFooter, Home, Galleries, AlbumCard, AlbumView, PhotoGallery, Lightbox, PasswordGate, ExpiredNotice, ErrorPage, AdminShell, AdminDashboard, AdminLogin. `Roll.svelte` is a private component: the numbered roll card used by Home and Galleries, which the `AlbumCard` slot wraps.

**Scoping rule.** Base rules use `html:where([data-design='contact-sheet']) <selector>`. That is one element more specific than `src/app.css` and `admin-ui.css`, but still less specific than a component's own scoped Svelte styles. Overrides of shared pages use the full `:root[data-design='contact-sheet'] …` prefix, which beats Svelte-scoped rules. Keyframes are prefixed `cs-`.

---

## 1. Character

- **Technical, not cute.** Mono labels, numbered everything (frames, rolls, sheets, tabs), plain
  sentences. Film details (sprockets, edge print, crop marks, stamps) are seasoning, never a
  substitute for clear UI.
- **Ruled, not boxed.** Structure comes from 2px ink rules (sections, panels, label boxes) and 1px
  hairlines inside them. Square corners everywhere. The only curves: spinner, registration mark,
  grease-pencil selection.
- **Condensed for voice, mono for function, sans for reading.** Big titles in condensed Plex Sans
  uppercase; labels, data, buttons and tables in Plex Mono; paragraphs in Plex Sans.
- **Mechanical motion.** Short linear transitions (120–240ms), stepped fades for entrances. No
  movement on entrance, no scale on hover, no bounce.

## 2. Colour

Only theme tokens (`--bg`, `--bg-elevated`, `--surface`, `--surface-strong`, `--text`,
`--text-muted`, `--text-subtle`, `--border`, `--border-strong`, `--accent`, `--accent-text`,
optional `--highlight`, the semantic `--danger/success/warning(-soft)`, `--viz-*`, `--stage-*`).
Derived design tokens (in `design.css`):

| Token          | Value                                              | Use                             |
| -------------- | -------------------------------------------------- | ------------------------------- |
| `--rule`       | `2px`                                              | Structural rule width           |
| `--rule-color` | `var(--text)`                                      | Ink rules                       |
| `--film`       | `color-mix(--surface-strong 55%, --border-strong)` | Film base around frames         |
| `--film-hole`  | `var(--bg)`                                        | Sprocket holes                  |
| `--edge-print` | `var(--highlight, var(--text-muted))`              | Edge numbers on the film rebate |
| `--grease`     | `var(--highlight, var(--accent))`                  | Selection marks (grease pencil) |

Highlight rule as before: emphasis is `var(--highlight, var(--text))`, so green turns gold.
Tints use `color-mix(in srgb, var(--x) N%, transparent)`.

## 3. Typography

```css
--font-mono:
	'IBM Plex Mono', ui-monospace, Menlo, monospace; /* @fontsource/ibm-plex-mono 400/500/600 */
--font-sans:
	'IBM Plex Sans Variable', system-ui, sans-serif; /* @fontsource-variable/ibm-plex-sans (wdth) */
--font-display: var(--font-sans);
--display-stretch: 78%; /* condensed via the width axis */
```

- **Body:** mono, 14px, line-height 1.6, tabular numerals.
- **Headings h1–h4:** display (Plex Sans at `font-stretch: 78%`), weight 600, uppercase,
  line-height ~0.9–1. Alternate hero lines drop to weight 300.
- **Prose** (`.prose`, descriptions, about text, dialog copy): Plex Sans, 1rem, line-height 1.7.
- **Labels** (`.eyebrow`, `.label`, table heads, buttons, chips, nav): mono, 0.62–0.74rem,
  uppercase, tracking 0.04–0.08em.
- **Readouts** (stat numbers): mono 500, 1.5–2.3rem, tracking −0.02em, slashed zero.
- **Big numbers** (sheet numbers, roll numbers, error code): display weight 300 in `--text-subtle`.

## 4. Film primitives (global classes)

| Class         | What                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| `.sprockets`  | A 12px band of sprocket holes on film base (CSS repeating gradient).                                     |
| `.edge`       | Edge print: 0.6rem mono uppercase in `--edge-print` (“12 ▸ 12A”, “ROLL 03”).                             |
| `.crop-marks` | Corner crop marks 7px outside the element (needs room around it).                                        |
| `.reg-mark`   | Registration target (ring + cross hairs), decorative, `aria-hidden`.                                     |
| `.stamp`      | Rubber stamp: 2px border, mono caps. `.warn/.danger/.ok` tones; `.tilt` (−3°) only on decorative stamps. |
| `.sheet-head` | Section head: 2px rule, big sheet number left, eyebrow + title right.                                    |

## 5. Components

- **Buttons:** square, 1px border, mono caps 0.74rem, min-height 44px (`.btn-sm` 34px). Hover is
  an inversion. Variants: default, `.btn-solid`, `.btn-accent`, `.btn-quiet`, `.btn-danger`.
- **Inputs:** mono, 1px `--border-strong`; focus = ink border plus a 2px highlight underline.
- **Chips:** square, mono caps, bracketed on public pages (`[ ALL ]`); active = accent fill.
- **Contact sheet (`PhotoGallery`):** grid rows are strips of film — frames edge to edge on the film
  base, sprockets above and below, frame number and “▸ 12A” under each. Masonry columns are vertical
  strips with holes down both sides. Selected frames get a grease-pencil loop and outline in
  `--grease`.
- **Roll card (`AlbumCard`):** cover in a film frame with crop marks and “ROLL 03” edge print, then a
  2px rule, title, roll number and a DATE / FRAMES / ACCESS mini-table. `variant="row"` for the
  galleries index (cover left, label right).
- **Lab envelope (album header):** 2px box with crop marks: “Lab envelope · No. 0007”, giant title,
  a ruled field row (Date, Frames, Order, Format), expiry as a tilted warning stamp.
- **Lightbox:** dark viewer; “FRAME 07 / 48” counter in display type, bordered square controls, a
  sprocket rebate along the bottom, fade-only transitions.
- **Admin shell:** masthead (brand + search/public site/log out) over a strip of numbered ledger
  tabs (“03 JOBS”); the open tab joins the page with an ink bar on top. Below 1100px the tabs move
  into a drawer and the 60px bar sticks.
- **Ledger (`admin-ui.css`):** `ui-stats` are readout strips with a 2px top rule; panels and cards
  are 1px `--border-strong` boxes with a 2px ink top rule; tables are mono with a 2px ink head
  rule; `ui-badge` is an upright stamp (1.5px border, mono caps).
- **Dashboard:** today’s date as a tilted stamp; numbered money readouts; attention lists with
  stage-coloured ledger margins and stamped counts; upcoming jobs as boxed date stamps; recently
  added galleries as a short film strip.

## 6. Layout

`--gutter: clamp(1rem, 4vw, 3rem)`, `--max-width: 1440px`, `--header-height: 64px`. Fluid clamps
for space. Breakpoints: 560, 640, 720, 900/960, 1000, 1100. Every screen works at 360px.

## Do / Don’t

- Do number things (frames, rolls, tabs, readouts) with two digits.
- Do keep body copy in Plex Sans and data in mono.
- Don’t rotate anything a person has to read in a list (badges stay upright).
- Don’t add shadows, rounded corners, blur, or zoom.
- Don’t hard-code colours; the lightbox chrome is the one exception.
