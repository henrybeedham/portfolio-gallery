# Design Spec — “Studio”

Soft, modern, friendly product design for a photographer's site and studio admin. Rounded
geometry, layered soft shadows, one geometric sans, pill controls and bento layouts. It should feel
like a well-made modern app: calm, tactile and quick.

**For AI agents:** treat everything here as a requirement. Use the tokens as written. If something
isn't covered, extend the system in its spirit and say so.

---

## 1. Character

- **Rounded, never sharp.** Every surface has a radius from the scale. Buttons, chips, filters,
  nav items and toasts are pills. Only full-bleed lightbox media keeps a modest radius.
- **Depth from soft light.** Cards float on layered shadows tinted from the theme's ink, plus a
  faint `--edge` hairline. No heavy borders, no ruled grids.
- **One friendly sans.** Plus Jakarta Sans for everything. Headings are bold (650–800) with tight
  negative tracking, in sentence case. No tracked uppercase labels except tiny status badges.
- **Bento layouts.** Pages are compositions of rounded tiles of mixed sizes, not long ruled lists.
- **Springy but calm motion.** Quick out-curves (200–300ms) with no overshoot. Hover may lift
  (`translateY(-2px)` + a stronger shadow).
- **Theme-driven colour.** Every colour comes from the theme tokens (light, dark, green and any
  uploaded theme). Emphasis uses `--ink` = `var(--highlight, var(--text))`, so green gets gold.

---

## 2. Where it lives

Everything is in `src/lib/designs/studio/`:

- `index.ts` loads Plus Jakarta Sans (`@fontsource-variable/plus-jakarta-sans`), `design.css` and
  `admin.css` on every page.
- `design.css`: tokens on `:root[data-design='studio']`, plus the base rules (type, buttons, forms,
  prose…) under `:where(:root[data-design='studio']) body`. That scope has class specificity
  0,1,1, so it beats Editorial's globals in `app.css` (0,1,0) but still loses to component-scoped
  styles (0,2,0), which keeps shared pages' local tweaks intact.
- `admin.css`: the `ui-*` building blocks under the same low scope, then an override block under
  `:root[data-design='studio']:is(:root, #studio) body` (ID-level specificity) that restyles the
  Svelte-scoped styles of shared, non-slot admin pages and components. Every override carries
  enough context (e.g. `.palette .result`, `form > section.card`, `li.tile:has(> .pick)`) to reach
  only its own component.
- Slot components: SiteHeader, SiteFooter, Home, Galleries, AlbumCard, AlbumView, PhotoGallery,
  Lightbox, PasswordGate, ExpiredNotice, ErrorPage, AdminShell, AdminDashboard, AdminLogin.

Nothing outside this folder changes for Studio, and nothing here applies to other designs.

## 3. Tokens

Colours are the theme tokens (`--bg`, `--bg-elevated`, `--surface`, `--surface-strong`, `--text`,
`--text-muted`, `--text-subtle`, `--border`, `--border-strong`, `--header-bg`, `--overlay`,
`--lightbox-bg`, `--placeholder`, `--accent`, `--accent-text`, `--highlight`, semantic
`--danger/-soft`, `--success/-soft`, `--warning/-soft`, `--viz-*`, `--stage-*`). Never hard-code a
hex value in a component; tint with `color-mix(in srgb, var(--x) N%, transparent)`.

Studio adds (on `:root[data-design='studio']`):

```css
--font-sans: 'Plus Jakarta Sans Variable', …, system-ui, sans-serif;
--font-display: var(--font-sans);   /* --font-serif is aliased to it too */

--radius-xs: 6px;    /* code, tiny marks */
--radius-sm: 10px;   /* inputs, menu rows */
--radius: 16px;      /* photo tiles, list rows, toasts' inner bits */
--radius-lg: 24px;   /* cards, stat cards, gallery tiles */
--radius-xl: 32px;   /* panels, hero and bento tiles, sidebar, dialogs */
--radius-pill: 999px;

--shadow-ink: var(--text);
--shadow-sm / --shadow / --shadow-lg   /* 2–3 layered color-mix(--shadow-ink 4–18%) shadows */
--edge: color-mix(in srgb, var(--border) 75%, transparent);   /* card hairline */
--ink: var(--highlight, var(--text));                          /* emphasis */
--ring: color-mix(in srgb, var(--ink) 22%, transparent);       /* focus halo */

--ease: cubic-bezier(0.22, 1, 0.36, 1);  /* out-quint: sprung feel, no overshoot */
--ease-soft: cubic-bezier(0.4, 0, 0.2, 1);
--dur: 240ms;  --dur-fast: 180ms;

--gutter: clamp(1rem, 4vw, 2.5rem);  --max-width: 1360px;
```

---

## 4. Typography

| Role               | Size                           | Weight  | Tracking                                             |
| ------------------ | ------------------------------ | ------- | ---------------------------------------------------- |
| Hero display       | `clamp(2.4rem, 6vw, 5.2rem)`   | 800     | −0.045em, lh 0.98; even lines in `--highlight`/muted |
| Page title         | `clamp(2.6rem, 7vw, 4.8rem)`   | 800     | −0.045em                                             |
| Album title        | `clamp(2rem, 5vw, 3.6rem)`     | 800     | −0.035em                                             |
| Section title (h2) | `clamp(1.9rem, 4vw, 3rem)`     | 800     | −0.035em                                             |
| Admin page title   | `clamp(1.8rem, 3.6vw, 2.5rem)` | 800     | −0.04em                                              |
| Panel title        | `1.15–1.2rem`                  | 750     | −0.025em                                             |
| Card title         | `0.95–1.02rem`                 | 650     | −0.015em                                             |
| Body               | 15px, lh 1.6                   | 400     |                                                      |
| Labels             | `0.82–0.85rem`                 | 600     | 0, sentence case                                     |
| Big numbers        | `1.75rem`                      | 800     | −0.035em, lining nums                                |
| Badges             | `0.68–0.74rem`                 | 650–700 | may be uppercase                                     |

- `.eyebrow` is a small sentence-case label (`--highlight` or muted).
- `.kicker` is the pill version (tinted `--ink` 10%) used above public section titles.

---

## 5. Components

**Buttons** (`.btn`): pill, min-height 44px (36px `.btn-sm`), 0.9rem/600, Title Case as written.
Driven by `--btn-bg/--btn-fg/--btn-border/--btn-shadow`.

| Variant       | Rest                         | Hover                         |
| ------------- | ---------------------------- | ----------------------------- |
| `.btn`        | `--surface` fill             | `--surface-strong`, lifts 1px |
| `.btn-solid`  | `--ink` fill, `--bg` text    | slightly lighter, `--shadow`  |
| `.btn-accent` | `--accent` / `--accent-text` | slightly lighter, `--shadow`  |
| `.btn-quiet`  | transparent, `--border` ring | `--surface` fill              |
| `.btn-danger` | `--danger-soft` / `--danger` | `--danger` fill, `--bg` text  |

Active press scales to 0.98. Disabled is 45% opacity.

**Inputs**: radius `--radius-sm`, `--bg-elevated`, 1px `--border`, soft inner shadow. Focus:
border `--ink` + 4px `--ring` halo (no outline). Search fields and the password gate are pills.

**Segmented control** (`.ui-chips`, `.segmented`, album tabs, gallery sort): a `--surface` track
with 4px padding; segments are pills; the active one lifts out on `--bg-elevated` with
`--shadow-sm`. Counts are small pills that turn `--ink` when active.

**Cards / panels** (`.ui-panel`, `.ui-card`, bento tiles): `--bg-elevated`, 1px `--edge`,
`--radius-xl`, `--shadow-sm`. Panel heads have an `--edge` rule beneath.

**Stat cards** (`.ui-stat`): separate rounded cards in an auto-fit grid, each with a 38px rounded
icon chip (`.ui-stat-icon`, tinted `--ink`; danger variant uses `--danger-soft`). Linked stats lift
on hover.

**Tables** (`.ui-table`): live inside a rounded panel; header row on a faint `--surface` tint,
sentence-case 0.78rem labels; `--edge` row rules; row hover `--surface` 60%. Job stages are a
rounded 4px pill stripe at the row's start (dashed for tentative).

**Badges** (`.ui-badge`, `.badge`): pills on `--surface`; `ok/warn/danger` use the `-soft` fill
with the semantic text colour.

**Toggle**: 42×24 pill track (`--surface-strong` → `--ink`), 18px round thumb with a small shadow.

**Checks** (`.ui-check`): 26px circles; on = `--success` fill.

**Photo tiles**: `--radius` corners, small gaps (`clamp(.4rem,.8vw,.65rem)`), hover lifts 2px with
`--shadow`; selected tiles shrink the image inside a 3px `--accent` inset ring with a round check.

**Album cards**: an 8px-padded rounded card holding a rounded cover, a frosted count pill on the
image, title + date below and a round arrow button that turns `--ink` and rotates on hover.

**Overlays**: dialogs and the command palette are `--radius-xl` cards with `--shadow-lg` over a
6px-blurred dark scrim. Toasts are centred-bottom pills (inverted ink). The lightbox keeps fixed
light-on-dark chrome: glass pill counter, glass round prev/next/close buttons, media with a
`--radius` corner and deep shadow.

---

## 6. Layouts

- **Site header**: a floating pill bar inset 12px from the top, with a round initial mark,
  the title and a pill nav group (active page lifts). Translucent `--header-bg` + blur once
  scrolled. ≤640px: a round menu button opening a rounded dropdown card.
- **Home**: a bento grid. Hero = large rounded image card (2/3 width, 2 rows) with the headline on
  a bottom scrim; an intro card (description + CTAs); a “Featured” peek tile. Featured photos are a
  mixed-size mosaic (first tile 2×2, a tall and a wide tile, plus a “+N more” ink tile). Recent
  galleries are mixed-size tiles (one 2×2) with frosted title labels and an “All galleries” card.
  About card + inverted ink contact card.
- **Galleries**: kicker + big title, a pill search field and a segmented sort (purely
  client-side), then a masonry of album cards.
- **Album**: floating pill top bar; a rounded header card with a cover thumbnail, meta pills,
  title, description and actions; a sticky frosted segmented tag filter + sort pill; rounded
  tiles; a floating pill selection bar.
- **Admin shell**: a floating rounded sidebar inset 12px from the window edges with a brand mark,
  a pill search button (⌘K), and pill nav items (active = `--ink` fill). Below 960px it becomes a
  floating drawer opened from a pill top bar.
- **Dashboard**: a greeting card (“Good afternoon”, date, a one-line summary, quick-action pills),
  icon stat cards, then a two-column board of rounded panels (needs-attention groups on stage-tinted
  rounded trays, coming-up date chips, activity mini-cards).

Breakpoints in use: 480, 520, 560, 640, 720, 760, 900, 960, 1100. Every screen works at 360px.

---

## 7. Motion

| Interaction           | Duration                               |
| --------------------- | -------------------------------------- |
| Colour / fill hovers  | 180–240ms                              |
| Lifts, pills, toggles | 240ms `--ease`                         |
| Image fade-in         | 500ms (`--ease-soft`)                  |
| Entrances (`fade-up`) | 600–700ms, 12px rise, staggered ~0.08s |
| Hero image            | 1s fade + 1.03 → 1 scale               |

Reduced motion: transitions and animations drop to 0.01ms. No overshoot, parallax or spins (except
the spinner).

---

## 8. Do / Don't

| Do                                                         | Don't                                        |
| ---------------------------------------------------------- | -------------------------------------------- |
| Radii from the scale; pills for controls                   | Square corners, ad-hoc radii                 |
| Soft layered shadows from `--shadow-*`                     | Hard black drop shadows, thick borders       |
| Plus Jakarta Sans, bold sentence-case headings             | Serif display type, tracked uppercase labels |
| Segmented controls for filters                             | Rows of outlined chips                       |
| `--ink` for emphasis so themes with a highlight pick it up | Hex colours or blue links                    |
| Hover lift of 1–2px with a stronger shadow                 | Bouncy overshoot, big scale jumps            |
