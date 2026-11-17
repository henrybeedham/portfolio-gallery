# Themes

Each theme is one JSON file. The file name (without `.json`) is the theme's id. Themes are used by:

- the public site and the admin (Settings → Appearance),
- albums that use their own theme instead of the site's (album → Details → Appearance; the default for
  new albums is under Settings → Album defaults), and
- PDF invoices (each invoice has its own style; the default is under Invoices → Settings).

## Adding a theme

The easiest way: **Settings → Appearance → Upload Theme**, and choose one or more `.json` files.
The file name becomes the theme's id (`Plum.json` → `plum`). Uploading a file with an existing
theme's name updates it, and one named after a built-in theme (`light.json`, `dark.json`,
`green.json`) replaces that theme until you delete it. The same list lets you download any theme
(handy as a starting point) and delete uploaded ones.

Uploaded themes are saved in `DATA_DIR/themes/` (`./data/themes/` with Docker Compose), so you can
also copy files there directly; they appear within a few seconds. Built-in themes live in
`src/lib/themes/` and need a rebuild after changes.

## Format

```json
{
	"$schema": "./theme.schema.json",
	"name": "Plum",
	"description": "Dusky plum with blush highlights.",
	"icon": "flower",
	"scheme": "dark",
	"order": 4,
	"extends": "dark",
	"colors": {
		"bg": "#211820",
		"bg-elevated": "#281e27",
		"surface": "#30242f",
		"text": "#f1e6ec",
		"border": "#3d2f3b",
		"highlight": "#e7a6c0"
	}
}
```

| Key           | Meaning                                                                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`        | Shown in the pickers.                                                                                                                          |
| `description` | Shown as a tooltip.                                                                                                                            |
| `icon`        | `sun`, `moon`, `leaf`, `palette`, `flower`, `waves`, `snowflake`, `flame`, `coffee`, `mountain`, `sparkles`, `droplet`, `cherry` or `sunset`.  |
| `scheme`      | `light` or `dark`: tells the browser how to draw scrollbars and form controls.                                                                 |
| `order`       | Position in the pickers, lowest first (built-ins use 1–3).                                                                                     |
| `extends`     | Start from another theme and only list the colours you change. Without it, a `dark` theme starts from `dark` and a `light` theme from `light`. |
| `colors`      | Every key becomes a CSS custom property (`"bg-elevated"` → `--bg-elevated`).                                                                   |
| `invoice`     | Colour overrides for PDF invoices only (see below).                                                                                            |

### Colours

| Key                                                                                                              | Used for                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `bg`                                                                                                             | Page background (and the invoice page)                                                                                                   |
| `bg-elevated`                                                                                                    | Cards, panels, inputs, the admin sidebar                                                                                                 |
| `surface`, `surface-strong`                                                                                      | Hover fills, active navigation; the invoice “Balance due” box                                                                            |
| `text`                                                                                                           | Primary text and the default ink                                                                                                         |
| `text-muted`, `text-subtle`                                                                                      | Body copy and labels; hints and metadata                                                                                                 |
| `border`, `border-strong`                                                                                        | Hairlines; hovered inputs and badges                                                                                                     |
| `overlay`, `header-bg`, `lightbox-bg`                                                                            | Scrims, the translucent header, the photo viewer                                                                                         |
| `danger`, `success`, `warning` (+ `-soft`)                                                                       | Errors, confirmations, cautions                                                                                                          |
| `accent`, `accent-text`                                                                                          | Selected chips and accent buttons, and the text on them                                                                                  |
| `placeholder`                                                                                                    | Behind images while they load                                                                                                            |
| `highlight` _(optional)_                                                                                         | Replaces the ink for solid buttons, eyebrows, focus rings, the invoice title and chart colour (the green theme's gold)                   |
| `chart-1` … `chart-4` _(optional)_                                                                               | Analytics chart colours. By default `chart-1` is the highlight (or ink) and the others are lighter steps of it                           |
| `stage-overdue`, `stage-deliver`, `stage-invoice`, `stage-awaiting`, `stage-upcoming`, `stage-done` _(optional)_ | The jobs list's stage stripes and icons. Keep them distinct hues. They fall back to the danger, warning, ink, success and border colours |

Colours can be any CSS colour (`#rrggbb`, `rgba(…)`, `hsl(…)`). PDF invoices understand hex and
`rgb()`/`rgba()` only, so use those for `bg`, `text`, `text-muted`, `text-subtle`, `border`,
`border-strong`, `surface` and `highlight`.

### Invoice overrides

Invoices use the theme's own colours unless `invoice` says otherwise. On a light theme,
`"invoice": { "bg": "#ffffff" }` gives a plain white page that prints well. On a dark theme, change
the text colours too, or the text stays pale on the white page:

```json
"invoice": {
	"bg": "#ffffff",
	"surface": "#f6eef2",
	"text": "#2a2028",
	"text-muted": "#6b5b66",
	"text-subtle": "#9a8a95",
	"border": "#e6dbe1",
	"border-strong": "#cdbcc6",
	"highlight": "#b2557c"
}
```

If a file has a mistake, the server log says which colour or file was ignored, and the rest still
loads.
