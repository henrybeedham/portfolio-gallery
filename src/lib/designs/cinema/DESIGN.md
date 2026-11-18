# Design Spec — “Cinema”

Immersive, image-first, edge to edge. The photographs fill the screen; type sits over them like a
title card. This file is the source of truth for the Cinema design (`data-design="cinema"`).

**For AI agents:** treat everything here as a requirement. Use the tokens and patterns as written.
If something you need isn't covered, extend the system in its spirit and say so.

---

## 1. Character

- **Photos are the page.** Heroes, cover bands and grids run edge to edge with hairline (3px) gaps
  or none. Text is laid over images, not placed beside them.
- **Title cards.** Headings are a tall condensed face, set large and uppercase. Body and UI are a
  clean, slightly rounded sans.
- **Floating chrome.** Navigation and tools are translucent glass pills that hover above the
  photographs (the scrolled header, the album dock, the selection bar).
- **Theme first.** Every colour is a theme token. Light, dark and green all work, as do per-album
  themes. Scrims are made from `--bg`, so text over images is always `--text`.
- **Slow motion.** Long cross-fades, slow image zooms on hover, a gentle Ken Burns on the home hero
  only. Nothing bounces. Reduced motion turns it all off.

---

## 2. Colour

Colours come only from the theme tokens (`--bg`, `--bg-elevated`, `--surface`, `--surface-strong`,
`--text`, `--text-muted`, `--text-subtle`, `--border`, `--border-strong`, `--header-bg`,
`--overlay`, `--lightbox-bg`, `--placeholder`, `--accent`, `--accent-text`, optional `--highlight`,
`--danger/-soft`, `--success/-soft`, `--warning/-soft`, `--viz-*`, `--stage-*`). Never write a hex
value in a component. Tints are `color-mix(in srgb, var(--x) N%, transparent)`.

Derived tokens (defined once in `design.css`):

| Token            | Value                                   | Use                                  |
| ---------------- | --------------------------------------- | ------------------------------------ |
| `--emphasis`     | `var(--highlight, var(--text))`         | Solid buttons, focus rings, active   |
| `--scrim-strong` | `--bg` at 92%                           | Bottom of scrims under overlaid text |
| `--scrim-soft`   | `--bg` at 55%                           | Top-of-image scrim under the header  |
| `--glass`        | `--bg-elevated` at 72%                  | Floating pills (with 14–20px blur)   |
| `--glass-border` | `--text` at 12%                         | Edge of glass pills                  |
| `--shadow-float` | `0 18px 50px` of `--lightbox-bg` at 28% | Floating layers only                 |

**The lightbox** is always dark (`--lightbox-bg` in every theme), so its chrome uses one fixed light
colour, declared once inside `Lightbox.svelte` as `--chrome`. This is the only literal colour.

**Highlight rule.** Where the design uses ink for emphasis, write `var(--emphasis)`. Light and dark
stay monochrome; green picks up its gold automatically.

---

## 3. Typography

```css
--font-display:
	'Oswald Variable', Oswald, 'Arial Narrow', sans-serif; /* @fontsource-variable/oswald */
--font-sans:
	'Manrope Variable', Manrope, ui-sans-serif, system-ui, sans-serif; /* @fontsource-variable/manrope */
--font-serif: var(--font-display); /* shared pages that still ask for the serif */
```

- **Body:** 15px Manrope, line-height 1.6.
- **h1–h3:** Oswald, weight 500, **uppercase**, line-height ~0.9–1, `text-wrap: balance`.
- **h4:** Manrope 700.

| Role                     | Size                            | Notes                               |
| ------------------------ | ------------------------------- | ----------------------------------- |
| Home hero                | `clamp(3rem, 8.2vw, 8.6rem)`    | Centred, low over the image, lh .88 |
| Album title (cover band) | `clamp(3.2rem, 11vw, 10rem)`    | Bottom-left over the cover          |
| /galleries title         | `clamp(3.6rem, 14vw, 12rem)`    |                                     |
| Section title (h2)       | `clamp(2.6rem, 7vw, 6rem)`      | Eyebrow above                       |
| Admin page title         | `clamp(2.8rem, 6vw, 5.2rem)`    | `.ui-head h1`                       |
| Panel title              | `1.65rem`                       | `.ui-panel-head h2`                 |
| Cover tile title         | `clamp(1.5rem, 8.5cqi, 4.6rem)` | Container-query sized to the tile   |
| Figures (money, stats)   | Oswald 400, 2–3.6rem            | `.figure`, tabular lining numerals  |

- **Eyebrow / credit (`.eyebrow`):** Oswald 500, 0.82rem, uppercase, 0.08em tracking, colour
  `var(--highlight, var(--text-muted))`. Use it above titles and for metadata over images.
- **UI labels** (form labels, table headers, chips, nav, buttons) are **sentence or Title Case
  Manrope 600**, never tracked uppercase. Button labels are Title Case in the source.

---

## 4. Layout and spacing

```css
--gutter: clamp(1rem, 4vw, 3rem);
--max-width: 1560px;
--header-height: 72px;
--radius: 6px;
--radius-sm: 4px;
--pill: 999px;
--tile-gap: 3px;
--ease: cubic-bezier(0.22, 0.61, 0.36, 1);
--ease-slow: cubic-bezier(0.16, 1, 0.3, 1);
```

- **Full bleed by default** for imagery: hero, filmstrip, cover mosaics, album cover band and
  photo grid ignore `.container`. Text sections use `.container`.
- **Cover mosaic** (`CoverMosaic.svelte`): 12-column grid of overlaid cover tiles, 3px gaps,
  repeating blocks (8×2 + 4×2; three 4×1; 4×2 + two 8×1; two 6×1) so it is varied but has no
  holes. Two columns on tablets, one column of 5:4 / 4:5 tiles on phones.
- **Photo grid:** 2 → 3 (720) → 4 (1100) → 5 (1700) columns, 3px gaps, edge to edge. Masonry uses
  the same gaps and breakpoints.
- Use `svh` for full-height sections. Every screen works at 360px with no horizontal scroll.

---

## 5. Components

### Buttons — pills

`border-radius: 999px`, min-height 44px (`.btn-sm` 36px), Manrope 600 0.86rem, no uppercase.

| Variant       | Rest                                      | Hover                         |
| ------------- | ----------------------------------------- | ----------------------------- |
| `.btn`        | outline, `--text` at 38%                  | 8% `--text` fill, full border |
| `.btn-solid`  | `--emphasis` fill, `--bg` text            | slightly lighter fill         |
| `.btn-accent` | `--accent` / `--accent-text`              | slightly lighter fill         |
| `.btn-quiet`  | 5% `--text` fill, no border               | 11% fill                      |
| `.btn-glass`  | `--glass` + blur, for buttons over photos | `--bg-elevated`               |
| `.btn-danger` | danger text, 55% danger border            | `--danger-soft` fill          |

Icon buttons (`.ui-icon-btn`) are 36px circles that gain a soft fill on hover.

### Header

Transparent over the hero; after 40px of scroll it becomes a **floating glass pill** inset from the
edges. Site title in Oswald uppercase; links are Manrope pills. Below 640px the links fold into a
full-screen menu of huge Oswald links that fade up in turn.

### Hero (home)

Full viewport. Image with a slow fade-in then a 32s Ken Burns (alternate), scrims from `--bg`
(top, bottom and a soft vignette). Title centred low, then description, then a solid “View Work”
and a glass “All Galleries”. A thin animated scroll cue sits at the bottom.

### Filmstrip (home featured collection)

Horizontally scrolling row of photos at a fixed height (`clamp(240px, 64svh, 640px)`), natural
aspect ratios, 3px gaps, `scroll-snap-type: x mandatory`, ending in a “See all” card. Underneath:
a progress hairline in `--emphasis` and round prev/next buttons.

### Cover tiles (`AlbumCard.svelte`)

The cover fills the tile; a bottom scrim (`--scrim-strong` → transparent at 62%) carries an
eyebrow (count · year) and the title. Hover: the image zooms to 1.05 over 1.8s and the text lifts
4px. Locked albums show a glass lock disc top-right.

### Album page

- **Cover band:** the album's background photo (or its first photo), 88svh, title bottom-left,
  meta eyebrow above, “View Photos” link below. The top bar is transparent over it and becomes a
  glass pill, showing the album title, once you scroll past.
- **Dock:** a floating glass pill toolbar, sticky to the bottom of the viewport: tag chips, sort,
  Select, Download All. It settles above the footer at the end. Selection mode swaps it for the
  selection bar (same glass pill).
- **Grid:** edge to edge, 3px gaps. Hovering a tile gently dims its neighbours. Selected tiles get
  a 4px inset `--accent` ring and shrink slightly.

### Lightbox — theatre

Fixed, `--lightbox-bg` with blur. Top bar: Oswald counter (`3 / 48`) and file name; a translucent
pill download button and a round close. The photo fills the stage (`object-fit: contain`) and
cross-fades in. Round glass prev/next. **Filmstrip of thumbnails** along the bottom (58px, 44px on
phones), current one outlined and kept centred; hidden on very short screens.

### Forms

Inputs: 44px, `--bg-elevated`, 1px `--border`, 6px radius. Focus: border `--emphasis` plus a 3px
18% `--emphasis` halo. Labels are Manrope 600 0.8rem `--text-muted`. Alerts have a 6px radius and a
40% currentColor border. The password gate uses a single pill containing the input and button.

### Chips and badges

Chips are pills with a 1px `--border` and Manrope 600; active = `--accent` fill. Badges are soft
pills tinted from their own colour (`color-mix(currentColor 11%)`), no border.

### Admin

- **Shell:** a 76px icon rail (`--bg-elevated`, right hairline) that widens to 248px over the
  content on hover or keyboard focus, revealing labels; it never reflows the page. The active item
  has a 14% `--emphasis` fill and a 3px `--emphasis` tab on the rail's edge. A monogram tile tops
  the rail. Below 960px the rail becomes a labelled drawer behind a sticky glass bar.
- **Page head:** eyebrow + huge Oswald title, actions on the right.
- **Cards and panels:** 6px radius, `--bg-elevated`, 1px `--border`, no shadow.
- **Stats:** separate 6px cards with Oswald figures. The dashboard instead uses a **ticker**: four
  big figures between top and bottom hairlines, divided by vertical rules.
- **Dashboard:** ticker → “Recently added” reel of overlaid cover tiles → board (needs attention
  with stage-tinted rows, coming up with date tiles, gallery activity).
- **Galleries list:** the grid view becomes cover tiles with overlaid titles and badges; the table
  view gets wider thumbnails.
- **Tables:** Manrope 600 0.76rem headers in `--text-subtle`, 0.8rem cell padding, hover rows with
  60% `--surface`.

### Overlays

Dialogs and the command palette: `--bg-elevated`, 6px radius (palette 10px), `--shadow-float`, on
a backdrop of 45% `--lightbox-bg` with a 4px blur. Toasts are solid `--text` with `--bg` text and a
16px radius. Floating layers are the only place shadows appear.

---

## 6. Motion

- Entrances: `fade-up` (18px, 1.1s, `--ease-slow`) and `fade-in` (1.2s), staggered 0.08–0.16s.
- Images fade in over 1s when loaded; hover zooms take 1.6–1.8s.
- Ken Burns on the home hero only.
- `prefers-reduced-motion` reduces all animation and transition to near zero.

---

## 7. Do / don't

- **Do** lay titles over images with a `--bg` scrim; **don't** put a title in a box beside a photo.
- **Do** run imagery edge to edge with 3px gaps; **don't** add card padding around photographs.
- **Do** use pills for buttons, chips and floating tools; **don't** use square buttons.
- **Do** use Oswald uppercase for titles and credits; **don't** use tracked uppercase Manrope for
  UI labels.
- **Don't** add shadows to cards, or hex colours anywhere outside the lightbox chrome.

---

## 8. Where things live

Everything is in `src/lib/designs/cinema/`:

| File                 | What it is                                                                                                                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`           | Loads the fonts (`@fontsource-variable/oswald`, `@fontsource-variable/manrope`) and both stylesheets.                                                                                              |
| `design.css`         | Tokens and the global system (type, buttons, forms, prose, motion), all nested under `:root[data-design='cinema']`. Keyframes are named `cinema-*`.                                                |
| `admin.css`          | The `ui-*` admin blocks plus restyles of shared admin components and pages (dialogs, toasts, palette, toggles, photo manager, settings, galleries list…), under the same scope.                    |
| Slots                | `SiteHeader`, `SiteFooter`, `Home`, `Galleries`, `AlbumCard`, `AlbumView`, `PhotoGallery`, `Lightbox`, `PasswordGate`, `ExpiredNotice`, `ErrorPage`, `AdminShell`, `AdminDashboard`, `AdminLogin`. |
| `CoverMosaic.svelte` | Private helper: the 12-column cover mosaic used by `Home` and `Galleries`.                                                                                                                         |

Rules for changes:

- Never write unscoped CSS. Editorial's `app.css` and `admin-ui.css` still load first, so restate
  any property they set that Cinema doesn't want (e.g. `text-transform: none` on buttons).
- Scoped `.input`/`.select`/`.btn` rules outrank component-level tweaks of them; when a shared
  component resizes a control locally, restate it in `admin.css` (“local control sizes”).
- Pages that aren't slots (jobs, invoices, analytics, settings, albums admin…) are restyled from
  `admin.css` with structural selectors specific enough not to touch other pages.
- Other slots are imported through the dispatchers (`#lib/components/…`) so Cinema's own versions
  are used.
