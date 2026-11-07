# Design Spec — "Editorial Paper"

A portable design system extracted from my photography gallery. Hand this file to any AI or developer building one of my projects so the result looks and feels like it belongs to the same family.

**For AI agents:** treat everything here as a requirement unless the project brief says otherwise. Use the tokens and patterns as written. Do not swap in your default look (rounded cards, drop shadows everywhere, blue primary buttons, gradient blobs, emoji icons). If something you need isn't covered, extend the system in its spirit and say so.

---

## 1. Character

Quiet, editorial and print-inspired, like a well-made photo book or a gallery wall label. The content (photos, words, data) is the hero; the interface stays out of the way.

- **Warm, not white.** Backgrounds are paper and ink, never pure `#fff` on `#000`.
- **Square and hairline.** `border-radius: 0` everywhere (spinners and avatars are the only circles). Structure comes from 1px borders and space, not shadows or fills.
- **Serif for voice, sans for function.** Headings are a high-contrast serif at weight 400. UI labels are small, uppercase sans with wide letter-spacing.
- **Generous space.** Big fluid section padding, narrow text measures and a lot of air.
- **Slow and soft motion.** Long eased fades and gentle scales. Nothing bounces.
- **Monochrome first.** The "accent" is the text colour itself, except in themes that define a highlight (see the green theme).

---

## 2. Colour tokens

Always reference colours through CSS custom properties. Never hard-code a hex value in a component (the lightbox's fixed dark chrome is the one exception). Three themes are switched by `data-theme` on `<html>`.

| Token             | Light (default) | Dark                      | Green                     | Use                                        |
| ----------------- | --------------- | ------------------------- | ------------------------- | ------------------------------------------ |
| `--bg`            | `#f6f1e8`       | `#141311`                 | `#14261c`                 | Page background                            |
| `--bg-elevated`   | `#fbf8f2`       | `#1b1a17`                 | `#182c21`                 | Cards, panels, inputs, sidebar             |
| `--surface`       | `#efe8dc`       | `#22201c`                 | `#1c3226`                 | Hover fills, active nav, code background   |
| `--surface-strong`| `#e6ddce`       | `#2b2924`                 | `#233b2e`                 | Stronger fills                             |
| `--text`          | `#26231f`       | `#ece5d9`                 | `#efe8d6`                 | Primary text, also the default "ink" accent |
| `--text-muted`    | `#6d655a`       | `#a99f90`                 | `#b3b29b`                 | Body copy, labels, secondary               |
| `--text-subtle`   | `#9b9284`       | `#7a7266`                 | `#828b76`                 | Hints, metadata, table headers             |
| `--border`        | `#ddd4c5`       | `#33302a`                 | `#2a4334`                 | Default hairlines                          |
| `--border-strong` | `#c3b8a6`       | `#4a453c`                 | `#4d5f45`                 | Hovered inputs, quiet buttons, badges      |
| `--header-bg`     | `rgba(246,241,232,.78)` | `rgba(20,19,17,.76)` | `rgba(20,38,28,.76)` | Translucent sticky bars (with blur)        |
| `--overlay`       | `rgba(246,241,232,.82)` | `rgba(20,19,17,.84)` | `rgba(20,38,28,.84)` | Scrims over content                        |
| `--lightbox-bg`   | `rgba(18,17,15,.94)`    | (inherits)           | `rgba(10,20,14,.95)` | Full-screen media viewer                   |
| `--placeholder`   | `#e8e0d3`       | `#26241f`                 | `#1e3428`                 | Image loading / empty media                |
| `--accent`        | `#26231f`       | `#ece5d9`                 | `#e2c068`                 | Selected state, chips, solid accent button |
| `--accent-text`   | `#ffffff`       | `#141311`                 | `#14261c`                 | Text on `--accent`                         |
| `--highlight`     | *(unset)*       | *(unset)*                 | `#e2c068` (antique gold)  | Optional theme highlight, see below        |
| `--danger` / `-soft`  | `#9d3b2b` / 8%  | `#e08470` / 10%       | `#e39a83` / 10%           | Errors, destructive actions                |
| `--success` / `-soft` | `#3e6a4a` / 10% | `#8cc29b` / 10%       | `#a8d0a6` / 10%           | Confirmation                               |
| `--warning` / `-soft` | `#8f6a1d` / 10% | `#e0b860` / 10%       | `#e2c178` / 10%           | Expiry, drafts, caution                    |

**The highlight rule.** Some themes define `--highlight`. Wherever the design would use "ink" as an emphasis colour (solid buttons, button hover fills, eyebrows, focus rings, text selection), write `var(--highlight, var(--text))` (or `var(--highlight, var(--text-muted))` for eyebrows). Light and dark stay monochrome, and green picks up gold automatically.

**Per-item accent.** A section can override `--accent` inline (for example, an album's chosen colour). Compute `--accent-text` from luminance: if relative luminance > 0.45 use `#1f1d1a`, otherwise `#ffffff`.

**Soft tints.** Mix colours with `color-mix(in srgb, var(--x) N%, transparent)` instead of inventing new rgba values.

---

## 3. Typography

```css
--font-serif: 'Playfair Display Variable', 'Playfair Display', Georgia, 'Times New Roman', serif;
--font-sans: 'Inter Variable', Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
```

Self-host both fonts (e.g. `@fontsource-variable/inter`, `@fontsource-variable/playfair-display`) and don't load them from Google at runtime.

**Base:** `body` is 15px, line-height 1.65, sans, antialiased, `text-rendering: optimizeLegibility`.

**Headings (h1–h4):** serif, **weight 400** (never bold), line-height 1.1, letter-spacing −0.01em, margin 0. Large display headings tighten to −0.02em and line-height ~1.02.

| Role                 | Size                                   | Notes                                           |
| -------------------- | -------------------------------------- | ----------------------------------------------- |
| Hero display         | `clamp(2.75rem, 7.4vw, 6.4rem)`        | `max-width: 14ch`; alternate lines in *italic* |
| Page title           | `clamp(2.6rem, 7vw, 5.5rem)`           | `max-width: 18ch`                               |
| Section title (h2)   | `clamp(2.1rem, 4.6vw, 3.6rem)`         | Preceded by an eyebrow                          |
| Admin page title     | `clamp(2.2rem, 4vw, 3rem)`             |                                                 |
| Panel / dialog title | `1.5rem`                               |                                                 |
| Card title (h3)      | `clamp(1.15rem, 1.8vw, 1.4rem)`        |                                                 |
| Lead paragraph       | serif, `clamp(1.3rem, 2.2vw, 1.7rem)`, lh 1.45 | First paragraph of an "about" block      |
| Body / prose         | `1rem`, lh 1.75, `--text-muted`, `max-width: 62–68ch` |                          |
| Big stat number      | serif, `2.2rem`, lh 1                  | `font-variant-numeric: tabular-nums` for numbers |

**Small-caps label system.** This is the signature UI voice: sans, weight 500, uppercase, wide tracking.

| Class / role        | Size      | Tracking |
| ------------------- | --------- | -------- |
| `.eyebrow`          | `0.7rem`  | `0.2em`  — colour `var(--highlight, var(--text-muted))` |
| Nav links           | `0.7rem`  | `0.22em` |
| Buttons             | `0.72rem` | `0.18em` |
| Small buttons/chips | `0.66rem` | `0.14–0.15em` |
| Form labels         | `0.68rem` | `0.16em` — `--text-muted` |
| Table headers       | `0.64rem` | `0.16em` — `--text-subtle` |

Every section heading follows the same pattern: **eyebrow above, serif title below** (≈0.75rem gap).

---

## 4. Layout and spacing

```css
--gutter: clamp(1rem, 4vw, 3rem);
--max-width: 1440px;
--header-height: 76px;
```

- `.container`: full width, `max-width: var(--max-width)`, centred, `padding-inline: var(--gutter)`.
- **Fluid everything.** Use `clamp()` for section padding, gaps and type, not stacks of breakpoints.
  - Section top padding: `clamp(4.5rem, 10vw, 8.5rem)`. Larger closing sections go up to `clamp(5rem, 12vw, 10rem)`.
  - Section head → content: `clamp(2rem, 4vw, 3.5rem)`.
  - Footer top margin: `clamp(4rem, 10vw, 8rem)`.
- **Section head:** on ≥900px, a two-column grid (title left, description right, `align-items: end`, gap 4rem). Single column below.
- **Two-column editorial split:** `5fr / 7fr` on ≥900px (label/title left, body right).
- **Card grids:** `grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr))`, gap `clamp(1.5rem,3vw,2.5rem) clamp(1rem,2.5vw,2rem)`.
- **Photo/media grids are tight:** gap `clamp(0.25rem, 0.5vw, 0.4rem)`, with 2 → 3 (≥720px) → 4 (≥1100px) columns, square tiles. Masonry is the alternative.
- **Breakpoints in use:** 560, 640 (mobile nav), 720, 900 (two-column layouts), 960 (admin sidebar), 1100.
- Use `svh` for full-height sections (`min-height: min(92svh, 980px)` for heroes).
- Set `scroll-margin-top: var(--header-height)` on anchor targets.

---

## 5. Components

### Buttons

Square, 1px border, uppercase tracked label, optional 14px icon with a 0.6rem gap. Each variant is driven by three local variables so it can be restyled cleanly:

```css
.btn { --btn-bg: transparent; --btn-fg: var(--text); --btn-border: var(--text);
  display:inline-flex; align-items:center; justify-content:center; gap:.6rem;
  min-height:46px; padding:.75rem 1.6rem; border:1px solid var(--btn-border); border-radius:0;
  background:var(--btn-bg); color:var(--btn-fg);
  font:500 .72rem/1 var(--font-sans); letter-spacing:.18em; text-transform:uppercase;
  white-space:nowrap; cursor:pointer; transition: background-color .25s var(--ease), color .25s var(--ease), border-color .25s var(--ease), opacity .25s var(--ease); }
```

| Variant       | Rest                                     | Hover                                   |
| ------------- | ---------------------------------------- | --------------------------------------- |
| `.btn` (outline, default) | transparent, ink border       | fills with ink (`--highlight` fallback `--text`), text becomes `--bg` |
| `.btn-solid`  | filled ink                               | inverts to outline                      |
| `.btn-accent` | filled `--accent` / `--accent-text`      | inverts to outline with accent border   |
| `.btn-quiet`  | `--border-strong` border                 | `--surface` fill, ink border            |
| `.btn-danger` | danger text and border                   | danger fill, white text                 |
| `.btn-sm`     | min-height 36px, `.5rem 1rem`, 0.66rem   |                                         |
| `.btn-icon`   | 36×36, no padding                        |                                         |
| Disabled      | opacity 0.45, `not-allowed`              | no hover change                         |

Hover is an **inversion** (outline ↔ solid). Never use a darker shade, a lift or a shadow.

**Text link (`.link`):** the same uppercase label style, `--text-muted`, which turns `--text` on hover. Use it for "Back", "Sign out" and secondary actions.

**Icon button (tables, toolbars):** 34×34, transparent border that shows `--border-strong` on hover (`--danger` for destructive actions).

### Navigation header

- Height `--header-height`. Serif site title on the left, uppercase tracked links on the right.
- **Overlay mode** (over a hero): fixed and transparent; turns solid after 40px of scroll.
- **Solid state:** `background: var(--header-bg)`, `backdrop-filter: blur(16px) saturate(1.2)`, bottom border `color-mix(in srgb, var(--border) 70%, transparent)`. Transitions run 0.45s.
- **Link hover:** a 1px underline 6px below the text that scales in from the left and out to the right (`transform-origin` swap, 0.35s).
- **≤640px:** links collapse to a 40×40 menu button (Lucide `Menu`/`X`, stroke 1.5). The menu opens as a stacked list with `--border` top rules and 1rem row padding, fading in over 180ms.

### Hero

Full-bleed image (`object-fit: cover`), content anchored bottom-left. A legibility scrim made of two gradients of `--bg`: one sweeping at 100deg from the left (92% → 72% → 10% → 0), and one rising from the bottom (100% → 70% at 14% → 0 at 45%). The image enters with fade + `scale(1.04 → 1)` over 1.6s. Title lines stagger in with `fade-up` (0.1s + 0.12s × i), followed by the description (0.45s) and CTA (0.6s). Even-numbered title lines are italic.

### Cards

- **Media card:** a cover with `aspect-ratio: 4/5` (or the natural ratio in masonry) on a `--placeholder` background. Below it, a row with the serif title on the left and an eyebrow meta ("24 images") on the right, aligned on the baseline, 1rem above.
- **Hover:** the image scales to 1.04 with `brightness(1.05)`, and the title fades to opacity 0.7.
- **Empty cover:** `--placeholder` crossed by a 1px diagonal `--border` line, with a centred Lucide icon at stroke 1.
- **Status badge on media:** 30×30 square, `--header-bg` with an 8px blur, inset 12px top-right (e.g. a lock icon).
- **Panel (admin/content box):** `--bg-elevated`, 1px `--border`, no radius, no shadow. Header row with 1.25rem 1.5rem padding and a bottom border.
- **Stat strip:** a grid with `gap: 1px` on a `--border` background, so the cells look ruled. Each cell is `--bg-elevated` with an eyebrow label and a big serif number.

### Forms

- `.field` is a grid with a 0.45rem gap: label (small caps), control, `.hint` (0.8rem, `--text-subtle`).
- Inputs, textareas and selects: min-height 44px, padding `.65rem .85rem`, `--bg-elevated`, 1px `--border`, radius 0, 0.95rem. Hover border becomes `--border-strong`. Focus: **no outline**, border becomes `--text`.
- Textarea min-height 120px, vertical resize only.
- Select: `appearance: none` with a CSS-gradient chevron in `--text-muted` (no SVG or icon font).
- **Toggle switch:** a square 36×20 track and a 12×12 square thumb. Off: `--surface` track, `--text-subtle` thumb. On: `--text` track, `--bg` thumb, slid 16px. Label (0.92rem) and description (0.8rem, subtle) sit to the right.
- **Alerts:** 1px `currentColor` border on a `-soft` background (`.alert-error`, `.alert-success`), 0.88rem.
- **Chips / filter pills:** square, 1px `--border-strong`, small caps 0.66rem. Hover border becomes `--text`. Active state: `--accent` fill.
- **Badges:** 1px `--border-strong`, 0.68rem, slight tracking. `ok` and `warn` variants use the semantic colour for text and a 50% mix of it for the border.
- **Dropzone:** 1px *dashed* `--border-strong` on `--bg-elevated`. While dragging the border becomes `--text` and the fill `--surface`.

### Tables

Full width, collapsed borders, 0.88rem. Headers use small caps in `--text-subtle`. Cells have 0.85rem 1rem padding and a `--border` bottom rule (none on the last row). Row hover uses `color-mix(--surface 55%)`. Numbers use `tabular-nums`. Primary cells use a serif title with a subtle secondary line under it. Wrap the table in `overflow-x: auto`.

### Overlays

- **Dialog:** a `rgba(20,18,15,.45)` backdrop with a 4px blur. The box is `min(100%, 420px)` with 1.75rem padding, `--bg-elevated`, 1px border and `box-shadow: 0 30px 80px rgba(0,0,0,.25)`. Serif title, muted body text and right-aligned buttons. (Floating layers are the only place shadows appear.)
- **Toast:** fixed bottom-right, `min(380px, 100vw - 2rem)`, inverted (`--text` background, `--bg` text), 0.86rem, shadow `0 14px 40px rgba(0,0,0,.18)`. Errors use `--danger` with white text.
- **Lightbox / media viewer:** fixed and full-screen on `--lightbox-bg` with a 12px blur. Chrome is always light (`#f3eee6`) whatever the theme. The top bar holds a tabular counter (`3 / 48`) and the file name at 60% opacity. Images are `object-fit: contain` with `0 20px 60px rgba(0,0,0,.35)`. Prev/next are 56×96 hit areas at opacity 0.65 that nudge ±3px on hover. Clicking the backdrop closes it (`cursor: zoom-out`). Arrow keys, Escape and swipe all work.
- **Sticky sub-toolbar:** `color-mix(--bg 86%)` with a 10px blur, sitting under the sticky top bar.

### App shell (admin / dashboards)

- A 260px sidebar (`--bg-elevated`, right border) next to the content (padding `clamp(1.5rem,4vw,3rem) clamp(1rem,4vw,3rem) 5rem`).
- Nav items are 0.88rem in `--text-muted` with a 2px transparent left border. Hover and active states use a `--surface` fill and `--text` colour, and the active item gets a `--text` left border.
- Below 960px the sidebar becomes an off-canvas drawer (0.3s slide, 40% scrim) opened from a 60px sticky blurred mobile bar.
- Centred auth or gate screens: a single `--bg-elevated` bordered card, `min(100vw - 2rem, 420px)`, eyebrow + serif h1 + muted line, then the form.

### Empty states

Centred, 4rem vertical padding, serif h3 in `--text`, a muted sentence and one button. Friendly and calm, e.g. *"Photos from this collection will appear here soon."*

### Icons

[Lucide](https://lucide.dev) only. Default **stroke 1.5**, or 1–1.25 for large decorative icons and 1.75 for tiny ones. Sizes: 13–16px inline, 20px in nav, 28px in placeholders. Icons inherit `currentColor`. No filled icon sets and no emoji.

### Spinner

14px circle, 1.5px `currentColor` border with a transparent right side, rotating linearly every 0.8s. Place it inline inside the button that triggered the work.

---

## 6. Motion

```css
--ease: cubic-bezier(0.22, 0.61, 0.36, 1); /* use for nearly everything */
```

| Interaction                    | Duration      |
| ------------------------------ | ------------- |
| Colour/border hovers           | 0.15–0.25s    |
| Nav underline, toggles         | 0.25–0.35s    |
| Header solidify                | 0.45s         |
| Image load fade (opacity 0 → 1)| 0.7s; transform 0.9s; filter 0.5s |
| `fade-up` entrance (14px rise) | 0.8–0.9s, staggered ~0.12s |
| Hero image entrance            | 1.6s          |

- Images always fade in when they finish loading. Never pop them in. Reserve the space with `aspect-ratio` or width/height plus a `--placeholder` background.
- Hover zoom on media is subtle (1.035–1.04).
- `scroll-behavior: smooth`, disabled under `prefers-reduced-motion`. That media query also forces every transition and animation to 0.01ms.
- No bounces, springs, spins (except the spinner) or parallax.

---

## 7. Accessibility and quality bar

- `:focus-visible` gets a `1px solid var(--highlight, var(--text))` outline with a 3px offset. Never remove focus without a replacement (inputs use the border change instead).
- `::selection` uses the highlight (or ink) background with `--bg` text.
- Hit targets are at least 36px (44–46px for primary controls).
- Icon-only buttons need an `aria-label`. Decorative images use `alt=""`. Use a `.visually-hidden` utility for screen-reader text.
- Responsive images (`srcset`/`sizes`) with `loading="lazy"` except above the fold; the hero gets `fetchpriority="high"`.
- Long titles truncate with an ellipsis in bars, never wrap the chrome.
- Wrap storage access (`localStorage`/`sessionStorage`) in try/catch.
- Every screen must work at 360px wide with no horizontal scroll.

---

## 8. Voice and copy

- **Labels:** short and in Title Case on buttons ("View Work", "View Full Collection", "Download All"), rendered uppercase by CSS. Write them in Title Case in the source, not ALL CAPS.
- **Eyebrows:** two or three words that set context ("Featured collection", "Explore more").
- **Sentences:** calm, warm and plain. No exclamation marks and no jargon in public-facing UI.
- Use typographic punctuation: em dashes (—), curly quotes, and "×" for dimensions.
- Use counts that pluralise properly ("1 image", "24 images").

---

## 9. Do / Don't

| Do                                                     | Don't                                              |
| ------------------------------------------------------ | -------------------------------------------------- |
| Square corners, 1px hairlines                          | Rounded cards, pill buttons, thick borders         |
| Serif headings at weight 400                           | Bold headings, sans-serif display type             |
| Uppercase tracked micro-labels                         | Sentence-case grey labels with no tracking          |
| Warm paper/ink neutrals from tokens                    | Pure white/black, blue links, Tailwind default greys |
| Hover = invert / underline / fade                      | Hover = lift + shadow, or a darker shade            |
| Shadows only on floating layers (dialog, toast, lightbox) | Shadows on cards and panels                       |
| Lots of whitespace, narrow measures (≤68ch)            | Dense dashboards with full-width paragraphs        |
| Translucent blurred sticky bars                        | Opaque coloured app bars                           |
| Lucide icons, stroke 1.5                               | Filled icons, emoji, multiple icon sets            |
| Theme via tokens + `data-theme`                        | Per-component dark-mode overrides with hex values  |

---

## 10. Drop-in starter CSS

Paste this as the global stylesheet of a new project, then build components on top of it.

```css
:root {
	--bg: #f6f1e8; --bg-elevated: #fbf8f2; --surface: #efe8dc; --surface-strong: #e6ddce;
	--text: #26231f; --text-muted: #6d655a; --text-subtle: #9b9284;
	--border: #ddd4c5; --border-strong: #c3b8a6;
	--overlay: rgba(246, 241, 232, 0.82); --header-bg: rgba(246, 241, 232, 0.78);
	--lightbox-bg: rgba(18, 17, 15, 0.94);
	--danger: #9d3b2b; --danger-soft: rgba(157, 59, 43, 0.08);
	--success: #3e6a4a; --success-soft: rgba(62, 106, 74, 0.1);
	--warning: #8f6a1d; --warning-soft: rgba(143, 106, 29, 0.1);
	--accent: #26231f; --accent-text: #ffffff; --placeholder: #e8e0d3;

	--font-serif: 'Playfair Display Variable', 'Playfair Display', Georgia, 'Times New Roman', serif;
	--font-sans: 'Inter Variable', Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
	--gutter: clamp(1rem, 4vw, 3rem);
	--max-width: 1440px;
	--header-height: 76px;
	--ease: cubic-bezier(0.22, 0.61, 0.36, 1);
	color-scheme: light;
}

[data-theme='dark'] {
	--bg: #141311; --bg-elevated: #1b1a17; --surface: #22201c; --surface-strong: #2b2924;
	--text: #ece5d9; --text-muted: #a99f90; --text-subtle: #7a7266;
	--border: #33302a; --border-strong: #4a453c;
	--overlay: rgba(20, 19, 17, 0.84); --header-bg: rgba(20, 19, 17, 0.76);
	--danger: #e08470; --danger-soft: rgba(224, 132, 112, 0.1);
	--success: #8cc29b; --success-soft: rgba(140, 194, 155, 0.1);
	--warning: #e0b860; --warning-soft: rgba(224, 184, 96, 0.1);
	--accent: #ece5d9; --accent-text: #141311; --placeholder: #26241f;
	color-scheme: dark;
}

/* Deep bottle green with cream type and antique-gold highlights. */
[data-theme='green'] {
	--bg: #14261c; --bg-elevated: #182c21; --surface: #1c3226; --surface-strong: #233b2e;
	--text: #efe8d6; --text-muted: #b3b29b; --text-subtle: #828b76;
	--border: #2a4334; --border-strong: #4d5f45;
	--overlay: rgba(20, 38, 28, 0.84); --header-bg: rgba(20, 38, 28, 0.76);
	--lightbox-bg: rgba(10, 20, 14, 0.95);
	--danger: #e39a83; --danger-soft: rgba(227, 154, 131, 0.1);
	--success: #a8d0a6; --success-soft: rgba(168, 208, 166, 0.1);
	--warning: #e2c178; --warning-soft: rgba(226, 193, 120, 0.1);
	--highlight: #e2c068; --accent: #e2c068; --accent-text: #14261c; --placeholder: #1e3428;
	color-scheme: dark;
}

*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) {
	html { scroll-behavior: auto; }
	*, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}
body {
	margin: 0; background: var(--bg); color: var(--text);
	font-family: var(--font-sans); font-size: 15px; line-height: 1.65;
	-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility;
}
img { display: block; max-width: 100%; }
a { color: inherit; }
h1, h2, h3, h4 { font-family: var(--font-serif); font-weight: 400; line-height: 1.1; letter-spacing: -0.01em; margin: 0; }
p { margin: 0; }
button { font: inherit; color: inherit; }
::selection { background: var(--highlight, var(--text)); color: var(--bg); }
:focus-visible { outline: 1px solid var(--highlight, var(--text)); outline-offset: 3px; }

.container { width: 100%; max-width: var(--max-width); margin: 0 auto; padding-inline: var(--gutter); }
.eyebrow { font-size: 0.7rem; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; color: var(--highlight, var(--text-muted)); }
.muted { color: var(--text-muted); }
.subtle { color: var(--text-subtle); }
.visually-hidden { position: absolute !important; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

.btn {
	--btn-bg: transparent; --btn-fg: var(--text); --btn-border: var(--text);
	display: inline-flex; align-items: center; justify-content: center; gap: 0.6rem;
	min-height: 46px; padding: 0.75rem 1.6rem; border: 1px solid var(--btn-border); border-radius: 0;
	background: var(--btn-bg); color: var(--btn-fg);
	font-family: var(--font-sans); font-size: 0.72rem; font-weight: 500; letter-spacing: 0.18em;
	text-transform: uppercase; text-decoration: none; white-space: nowrap; cursor: pointer;
	transition: background-color 0.25s var(--ease), color 0.25s var(--ease), border-color 0.25s var(--ease), opacity 0.25s var(--ease);
}
.btn:hover:not(:disabled) { --btn-bg: var(--highlight, var(--text)); --btn-fg: var(--bg); --btn-border: var(--highlight, var(--text)); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-solid { --btn-bg: var(--highlight, var(--text)); --btn-fg: var(--bg); --btn-border: var(--highlight, var(--text)); }
.btn-solid:hover:not(:disabled) { --btn-bg: transparent; --btn-fg: var(--text); }
.btn-accent { --btn-bg: var(--accent); --btn-fg: var(--accent-text); --btn-border: var(--accent); }
.btn-accent:hover:not(:disabled) { --btn-bg: transparent; --btn-fg: var(--text); --btn-border: var(--accent); }
.btn-quiet { --btn-border: var(--border-strong); }
.btn-quiet:hover:not(:disabled) { --btn-bg: var(--surface); --btn-fg: var(--text); --btn-border: var(--text); }
.btn-danger { --btn-fg: var(--danger); --btn-border: var(--danger); }
.btn-danger:hover:not(:disabled) { --btn-bg: var(--danger); --btn-fg: #fff; }
.btn-sm { min-height: 36px; padding: 0.5rem 1rem; font-size: 0.66rem; letter-spacing: 0.15em; }
.btn-icon { min-height: 36px; width: 36px; padding: 0; }

.link {
	display: inline-flex; align-items: center; gap: 0.5rem; padding: 0; border: 0; background: none; cursor: pointer;
	font-size: 0.72rem; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; text-decoration: none;
	color: var(--text-muted); transition: color 0.2s var(--ease);
}
.link:hover { color: var(--text); }

.field { display: grid; gap: 0.45rem; }
.field > label, .label { font-size: 0.68rem; font-weight: 500; letter-spacing: 0.16em; text-transform: uppercase; color: var(--text-muted); }
.hint { font-size: 0.8rem; color: var(--text-subtle); line-height: 1.5; }
.input, .textarea, .select {
	width: 100%; min-height: 44px; padding: 0.65rem 0.85rem; border: 1px solid var(--border); border-radius: 0;
	background: var(--bg-elevated); color: var(--text); font: inherit; font-size: 0.95rem;
	transition: border-color 0.2s var(--ease), background-color 0.2s var(--ease);
}
.input:hover, .textarea:hover, .select:hover { border-color: var(--border-strong); }
.input:focus, .textarea:focus, .select:focus { outline: none; border-color: var(--text); }
.textarea { min-height: 120px; resize: vertical; line-height: 1.6; }
.select {
	appearance: none; padding-right: 2.25rem;
	background-image: linear-gradient(45deg, transparent 50%, var(--text-muted) 50%), linear-gradient(135deg, var(--text-muted) 50%, transparent 50%);
	background-position: calc(100% - 17px) 52%, calc(100% - 12px) 52%;
	background-size: 5px 5px, 5px 5px; background-repeat: no-repeat;
}
.error-text { color: var(--danger); font-size: 0.85rem; }
.alert { padding: 0.85rem 1rem; border: 1px solid currentColor; font-size: 0.88rem; }
.alert-error { color: var(--danger); background: var(--danger-soft); }
.alert-success { color: var(--success); background: var(--success-soft); }

.prose { color: var(--text-muted); font-size: 1rem; line-height: 1.75; max-width: 68ch; }
.prose > * + * { margin-top: 1em; }
.prose a { color: var(--text); text-underline-offset: 3px; }
.prose h1, .prose h2, .prose h3 { color: var(--text); font-size: 1.4rem; margin-top: 1.5em; }
.prose blockquote { margin: 0; padding-left: 1.25rem; border-left: 1px solid var(--border-strong); font-family: var(--font-serif); font-style: italic; font-size: 1.1rem; }
.prose ul, .prose ol { padding-left: 1.25rem; }
.prose code { font-size: 0.88em; background: var(--surface); padding: 0.1em 0.35em; }

.spinner { display: inline-block; flex: none; width: 14px; height: 14px; border: 1.5px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.fade-up { animation: fade-up 0.8s var(--ease) both; }
```

Set the theme on `<html data-theme="light|dark|green">`. Render it on the server so the page doesn't flash on load.
