# AGENTS.md

Guidance for AI coding agents working in this repository. Read `README.md` for what the app does
from the owner's side, and `DESIGN.md` before any UI work.

## What this is

A self-hosted photography site for one photographer. It has a public portfolio, private client
galleries (password, expiry and downloads), and an admin area that also handles jobs, PDF invoices
and analytics. It runs as one Node process with SQLite and is deployed as a single Docker container.

## Commands

Bun is the package manager. Node (22.17 or later, for `node:sqlite`) runs the build and the server.

```sh
bun install
bun run dev        # Vite dev server on :5173; data goes to ./data
bun run check      # svelte-kit sync + svelte-check (types and Svelte warnings); this is the main gate
bun run lint       # prettier --check .
bun run format     # prettier --write .
bun run build && bun run start   # production build, served by server.js on :3000
docker compose up -d --build     # the real deployment
```

There is no test suite. To verify a change, run `bun run check` and `bun run build`, then exercise
the change in the running app. To test against throwaway data, point `DATA_DIR` somewhere else and
set a password:
`DATA_DIR=/path/to/scratch ADMIN_PASSWORD=some-long-password bun run dev`. Without
`ADMIN_PASSWORD`, one is generated into `$DATA_DIR/.admin-password`. The admin login is at
`/admin/login`.

Prettier settings: tabs, single quotes, no trailing commas, print width 100. `DESIGN.md` isn't
Prettier-formatted, so `bun run lint` reports it; leave it alone unless asked.

## Stack details that differ from the defaults you'd assume

- **SvelteKit 3 and Svelte 5.** Runes mode is forced for all project files (`vite.config.ts`), so
  use `$state`, `$derived`, `$props` and `$effect`, and `$app/state` rather than `$app/stores`.
- **Imports.** Code imports through Node subpath imports with `.js` extensions, e.g.
  `import { get } from '#lib/server/db.js'`. `$lib` is not used.
- **Environment variables.**
  - The app's variables are declared in `src/env.ts` with `defineEnvVars` and imported from
    `$app/env/private`, and only `src/lib/server/config.ts` imports them. Add new app variables
    there, not via `$env/...`.
  - The server-level settings (`PORT`, `HOST`, `ORIGIN`, `TRUST_PROXY`, `XFF_DEPTH`,
    `BODY_SIZE_LIMIT`) are read in `server.js`.
- **`server.js`** is the production entry point. It wraps the adapter-node handler and does
  three things:
  - It trusts `X-Forwarded-*` headers only from proxies on private networks, and passes the client
    IP to SvelteKit in `x-gallery-client-ip`.
  - It caps request bodies at 1 MB except on the paths in `LARGE_BODY_PATHS`. **A new upload
    endpoint must be added to that list.**
  - It shuts down gracefully.
- **CSP** is set in `vite.config.ts`. Scripts need the nonce; inline styles are allowed;
  `object-src` is `'none'`. That last one is why the invoice preview is an iframe pointing at a
  server URL rather than a blob or object URL.
- **`src/hooks.server.ts`**:
  - Rejects cross-origin non-GET requests by checking `Origin`.
  - Sets `locals.isAdmin`.
  - Fills the `%gallery.theme%`, `%gallery.themesVersion%` and `%gallery.themes%` placeholders in
    `src/app.html`.
  - Gzips HTML and JSON responses.

## Layout

- **`src/lib/server/`**: all server logic, one module per domain (`albums`, `photos`, `images`,
  `auth`, `access`, `themes`, `bookings`, `invoices`, `invoice-pdf`, `insights`, …). Route files
  stay thin and call into these.
- **`src/lib/`**: code shared with the browser: `types.ts`, `utils.ts` (date and format helpers),
  `money.ts`, `booking-import.ts`, `sort.ts`, `download.ts`.
- **`src/lib/components/`**: public components.
  - `admin/` holds the admin components and `admin-ui.css`, which defines the shared `ui-*`
    classes used by the jobs, invoices and analytics pages.
  - `charts/` holds hand-rolled SVG charts.
- **`src/lib/themes/`**: the built-in theme JSON files, their schema and format docs.
- **`scripts/import-legacy.*`**: a one-off migration from the previous version of the app. It
  creates the `legacy_import_map` table that the `/album/[...path]` redirects read.

## Routes

**Public**

- **Pages:** `/` (home), `/galleries`, and `/[slug]` (an album, with a password `unlock` action).
- **Photo viewer:** `Lightbox.svelte` is the only one. The album and home pages open it with shallow
  routing (`PageState.lightbox`). Each photo also has its own URL at `/[slug]/photo/[id]`, for
  reloads and shared links, which renders the same viewer.
- **Album endpoints:** `/[slug]/photos` returns JSON pages for infinite scroll; `/[slug]/download`
  streams a ZIP (resumable: `zip.ts`); `/[slug]/view` counts a view. The album page posts to it once
  it's shown, so hover-preloading a link doesn't count; don't count views in a `load`.
- **Images:** `/media/[key]/[variant]` (`thumb|medium|original`) and `/site/hero/[size]`.
- **Lightroom API:** `/api/lightroom/…`, used by the Lightroom Classic plugin. It's authorised by
  an API token (`Authorization: Bearer gal_…`, `api-tokens.ts`), not the session cookie, so every
  endpoint calls `requireToken(event)` from `lightroom.ts`.
- **Widget API:** `/api/widget` returns the summary the iPhone widgets show (`widget.ts`). The widgets
  are a Scriptable script, `scriptable/Gallery.js`, bundled like the Lightroom plugin and copied from
  `/admin/widgets` with the site's address (and a fresh token) filled in (`widget-script.ts`). It
  takes a **widget** token: API tokens have a `scope`, `full` (Lightroom, `requireToken(event)`) or
  `widget` (read-only, `requireToken(event, 'widget')`). `WidgetPreview.svelte` mirrors the
  script's layouts for the admin page; change both together.
- **Other:** `/site/themes.css`, `/site/calendar/[token].ics` (the jobs feed), `/album/[...path]`
  (legacy redirects) and `/healthz`.
- **Album slugs live at the root.** Any new top-level route must be added to `RESERVED_SLUGS` in
  `src/lib/server/albums.ts`.

**Admin**

- **Pages** live under `src/routes/admin/(app)/`. Its `+layout.server.ts` redirects anyone who isn't
  signed in to the login page.
- **JSON endpoints** live under `src/routes/admin/api/`. The layout guard doesn't cover them, so
  **every endpoint calls `requireAdmin(locals)` itself** (`src/lib/server/guard.ts`).
  - POST bodies look like `{ action: 'set-flag', … }` and are dispatched with a `switch`.
  - On the client, call them with `api()` from `admin/feedback.svelte.ts`, then
    `invalidate('admin:…')`, using the key that the page's load registers with `depends()`.
  - Use `feedback.toast()` and `feedback.confirm()`, never `alert` or `confirm`.
- **Page-level forms** (settings, album form, job form) use SvelteKit form actions with
  `use:enhance`.

## Lightroom plugin

- The plugin is Lua, in `lightroom/GalleryPublisher.lrplugin/`. It's bundled into the server with
  `import.meta.glob` and downloaded from `/admin/lightroom/plugin.zip`, with `Defaults.lua` filled in
  with the site's address (`lightroom-plugin.ts`). Lightroom runs Lua 5.1, so keep the plugin to
  5.1 and the SDK's `import` modules; `JSON.lua` is its own encoder and decoder.
- A published collection is an album (its remote id). Photos use the same chunked upload as the
  browser (`upload-receiver.ts`); `x-replace-photo` swaps a republished photo's file in place
  (`replacePhoto` in `photos.ts`), keeping its id, tags and downloads.
- Changing the API means changing the plugin too. Users don't need to download it again by hand:
  `pluginBuild` (a hash of the plugin's files, written into `Defaults.lua` as `build`) is reported
  by `/api/lightroom`, and when it differs the plugin offers to fetch `/api/lightroom/plugin` and
  copy the files over itself (`Updater.lua`, unzipping with `ditto` or PowerShell). It takes effect
  when Lightroom restarts, so keep the old API working for a plugin that hasn't updated yet.

## Auth and access

- **Admin login.** There is a single admin account, configured by environment variables. The session
  cookie is an HMAC-signed payload stamped with the current credentials, so changing the password
  signs every session out (`auth.ts`).
- **Album access** goes through `albumAccess()` in `access.ts`, which returns
  `ok | not_found | locked | expired`.
  - Anything that serves album content must use it.
  - The media route lets a locked album's cover through, so listings can still show it.
  - Admins can see an album as a visitor with `?preview`.
- **Album passwords** are hashed with scrypt. Unlocking sets a per-album session cookie whose
  fingerprint changes when the password does.
- **Rate limits** are kept in memory (`ratelimit.ts`). Get the visitor's address with
  `clientIp(event)`.

## Data

- **`DATA_DIR`** (default `./data`) holds:
  - `gallery.db`
  - `photos/{originals,thumbs,medium}/<first two chars of key>/…`
  - `site/` (the hero image)
  - `themes/` (uploaded themes)
  - `tmp/` (including unfinished uploads, `upload-<id>.part`, removed after a day)
  - `backups/` (database backups)
  - the generated `.session-secret`, `.admin-password` and `.vapid-key.json`
- **Database.** It uses `node:sqlite`, which is synchronous. Use the helpers in `db.ts`: `run`,
  `get`, `all`, `transaction` (nested calls join the outer one) and `placeholders(n)`.
  Booleans are stored as 0/1, `undefined` becomes `NULL`, and columns are snake_case, mapped to
  camelCase types in each module.
- **Migrations.** These are the `MIGRATIONS` array in `db.ts`, applied in order and tracked by
  `PRAGMA user_version`, each in its own transaction. Add a new entry at the end; never edit or
  reorder existing ones. An entry is SQL, or a function given the raw `DatabaseSync` for data
  conversions (it can't use the `db.ts` helpers, which open the database themselves).
- **Backups** (`backups.ts`, `backup-files.ts`). `db.ts` saves a `VACUUM INTO` copy to `backups/`
  before migrating, and whenever the app version (`$app/env`) differs from the `'app-version'`
  settings row, i.e. after every deploy. Ten automatic backups are kept; ones made by hand stay until
  deleted. A restore backs up first, swaps the file through `replaceDatabase` and resets the settings
  caches. Photos are only in the streamed **Download Everything** ZIP, which is never stored.
- **Site settings.**
  - They're stored as one JSON row (`settings.key = 'site'`) and cached in `settings.ts`.
  - Unknown keys are dropped when read, so a new setting needs adding to both `defaultSettings`
    and `SiteSettings`.
  - Only `publicSettings()` (which omits the Discord webhook) may reach the browser.
- **Invoice defaults** are a separate settings row (`'invoicing'`, in `billing.ts`).
- **Photos.**
  - Each photo has a random `key`. Its `version` changes when the thumbnails are regenerated and
    is used for cache-busting (`?v=`).
  - `sharp` work goes through the `processing` limiter in `images.ts`.
  - Client downloads go through the browser's own download manager (`download.ts`), so a large ZIP
    never sits in the page's memory. `serveFile` honours single byte ranges with If-Range, so
    downloads resume and videos seek. A continued range isn't counted as a new download
    (`isContinuation`).
  - Uploads arrive in 8 MB pieces (`Uploader.svelte` and the upload endpoint), each with an upload id
    and offset, so every request stays inside Traefik's 60-second limit and a dropped piece resumes.
- **Sections** (`sections.ts`) split one album into named, ordered parts (`photos.section_id`, at
  most one per photo). `orderedPhotos` puts unsectioned photos first, then each section, sorting
  within each. The album page only shows headings, jump links, “Download Section”
  (`/[slug]/download?section=`) and ZIP folders once the photos span two or more groups, so an
  album that is all one section looks the same as one with none. With the album's
  `sections_collapsed` setting, sections start collapsed, showing the first few photos small
  (`ViewSection.preview`); a section's photos are only paged in once it's open (`loadTarget` in
  `AlbumView.svelte`).
- **Videos** (`video.ts`) are rows in `photos` with `kind = 'video'` and a `duration`. ffprobe reads
  their size (after rotation), length and date; ffmpeg's poster frame goes through
  `generateVariants`, so thumbnails, covers and the grid work unchanged. Use `detectMedia` and
  `regenerateVariants` from `photos.ts` rather than the photo-only `detectType` and
  `generateVariants`. ffmpeg comes from the `mwader/static-ffmpeg` image; without it, videos get a
  plain poster.
  - **Previews** (`video-preview.ts`): after an upload, a background queue (one at a time) encodes a
    1080p, 60fps-max H.264/AAC MP4 with faststart to `photos/previews/`, served as the `preview`
    variant. `photos.preview` is NULL (undecided), 0 (the original already plays well, or encoding
    failed) or 1. The lightbox plays the preview when `PhotoItem.preview` is set, otherwise the
    original; downloads always get the original. Undecided videos are queued at startup, and
    regenerating thumbnails re-encodes.
  - The Dockerfile and `bun run start` set `UV_THREADPOOL_SIZE=16`, so bulk image processing doesn't
    delay file requests, which share libuv's thread pool.
  - Embedded keywords (XMP `dc:subject`, falling back to IPTC) become album tags on upload, folder
    import and “Re-extract metadata”. This only ever adds tags, so hand-applied ones survive.
- **Maintenance tasks** (regenerating thumbnails, refreshing metadata, importing from a folder) run
  in memory through `jobs.ts`. The UI polls them at `/admin/api/jobs/[id]`.

## Naming trap: "jobs" vs "bookings"

The UI calls photography work **Jobs**. In code it is **bookings**: the `bookings` table,
`bookings.ts`, the `Booking` type and `/admin/api/bookings`. The name `jobs` was already taken by
background maintenance tasks (`jobs.ts`, `/admin/api/jobs`). The page route is still
`/admin/jobs`. Keep this split.

## Jobs, invoices and analytics

- **Units.**
  - Money is always stored as integer pence (`money.ts`: `formatMoney`, `parseMoney`).
  - A job's `starts_at` is a naive local `YYYY-MM-DDTHH:mm`, or just a date; `ends_at` is optional.
  - Days are `YYYY-MM-DD` strings; use `todayIso` and `addDays` from `utils.ts`.
- **Jobs hold no money.** A job's fee, payment state and analytics all come from its invoices
  (`paymentState` and `invoiceState` in `bookings.ts`). Don't add money fields to `bookings`. Status
  is `confirmed | tentative | cancelled`.
- **Invoices and jobs are many-to-many**, through `invoice_bookings`. Linking is optional on both
  sides. A shared invoice is split evenly between its non-cancelled jobs (`invoiceShares` in
  `bookings.ts`), and `InvoiceRef.share` is what a job's fee and the analytics use, so nothing is
  counted twice. Totals such as outstanding and paid read the invoices directly.
- **End times.** `ends_at` is a naive local `YYYY-MM-DDTHH:mm`, set only when the start has a time.
  An end earlier than the start means the next day. It drives the calendar event's length and the
  hours prefilled on a new invoice (`jobHours`).
- **Delivered** is ticked automatically once a linked album is public and has photos
  (`delivery.ts`, called when an album is linked, saved or gets a photo). It never unticks, so it
  can still be set by hand. "Shot" isn't tracked: a job whose date has passed has been shot.
- **Clashes** (`job-clash.ts`): jobs on the same day are mentioned on the job form, and jobs whose
  times overlap are flagged there and on the jobs list.
- **Invoice states.**
  - A **draft** (`draft = 1`) hasn't been sent. It holds the expected fee, counts as booked (or
    tentative, for a tentative job) in analytics, can't be marked paid, and isn't outstanding.
    Issuing it (`issueInvoice`) dates it today and recomputes the due date with `invoiceDueDate`.
  - An **imported** record (`imported = 1`) was converted from the money jobs used to hold
    (`legacy-money.ts`). It has no PDF, its number may be empty or list several earlier numbers, and
    it's left out of “time to get paid”. The spreadsheet import makes the same conversion, and
    “Invoiced Elsewhere” on a job (`recordExternalInvoice`) creates one by hand, replacing a draft
    if the job has one.
- **Invoices are snapshots.**
  - The sender, bill-to, payment details, line items (JSON) and style are copied onto the invoice
    row, so changing defaults never alters an issued invoice.
  - Numbers are random 8-digit values, unique against invoices and the numbers on imported records
    (`generateInvoiceNumber`). Only non-imported numbers are unique in the database.
  - Invoices exist only as PDF downloads; there are deliberately no public invoice URLs.
  - Invoices and jobs are both optional for albums: an album can be delivered with neither.
- **PDF rendering** uses PDFKit in `invoice-pdf.ts`.
  - Colours come from `getTheme(style).invoice`.
  - Fonts are the static `.woff` files from `@fontsource/inter` and
    `@fontsource/playfair-display`, because PDFKit can't read WOFF2.
  - Live preview: the editor POSTs to `/admin/api/invoices/preview`, gets back a token URL, and
    loads it in an iframe.
- **Billing addresses** are a table. AU and Guild (University of Exeter) are seeded by a migration,
  and a job picks one by id.
- **Spreadsheet import** (`booking-import.ts`) parses pasted TSV/CSV by header name. The "Mine"
  column maps yes → confirmed, maybe → tentative, no → cancelled.
- **Calendar feed** (`calendar.ts`): a private iCalendar feed of dated, non-cancelled jobs. Calendar
  apps can't sign in, so a random token in the URL is the access; it's a separate settings row
  (`'calendar-token'`), reset from `/admin/jobs/calendar`. Times are floating, matching `starts_at`.
- **Tax year export** (`tax-year.ts`): UK tax years (6 April to 5 April, named by the starting
  year) as CSV, by `paid_at` (cash basis) or `issue_date`. Drafts are left out, and text cells that
  look like formulas are prefixed so spreadsheets don't run them.
- **Analytics** (`insights.ts`):
  - Academic years start in September.
  - Gallery charts read `album_daily_stats`, updated in `analytics.ts`.
  - Admin views and downloads are never counted or notified.
  - Notifications go through `notify()` in `discord.ts`, which sends to the Discord webhook and to
    push devices (`push.ts`). Single-photo downloads are batched per album for 60s.
- **Push notifications and the Home Screen app.** The admin area links a web app manifest
  (`/site/manifest.webmanifest`) and registers `src/service-worker.ts` itself
  (`push-client.ts`; automatic registration is off, so public pages never get it). The worker only
  shows notifications; it doesn't cache. `web-push.ts` implements encryption and VAPID with
  `node:crypto`, the key pair lives in `DATA_DIR/.vapid-key.json`, and devices are turned on under
  Settings → Notifications (on an iPhone, only from the Home Screen app, over https).
- **List filters** live in the URL (`?show=…`). `admin/list-memory.ts` and `BackLink.svelte`
  bring you back to the filtered list from a detail page.

## Themes

- **Sources.**
  - Built-in themes are `src/lib/themes/*.json`, bundled via `import.meta.glob`.
  - Uploaded themes live in `DATA_DIR/themes/` and are re-read on a short mtime cache.
  - An upload named like a built-in replaces it.
  - The format is documented in `src/lib/themes/README.md` and `theme.schema.json`.
  - A new theme is just a JSON file: add it to `src/lib/themes/` (built-in) or give the user a file
    to upload in Settings → Appearance.
- **CSS.**
  - `themes.ts` turns each theme's `colors` into `[data-theme="id"] { --key: value }` rules, which
    are inlined into `app.html`.
  - Colour values are checked against a strict pattern, because they end up inside `<style>`.
  - Open pages fetch `/site/themes.css` when the theme version changes.
- **Which theme a page uses.**
  - The root layout returns the site theme as `theme`.
  - Album pages return `albumPageTheme(locals, album)`, which also sets `locals.theme` so the
    server-rendered `<html data-theme>` is right. `+layout.svelte` reads `page.data.theme`.
- **Icons** (favicon, Home Screen and notification icons) are drawn in the theme's colours by
  `site-icon.ts` and served from `/site/icon/[theme]/[file]`, versioned by `iconUrl`. Pages get
  theirs from `PageTheme.icons`, so an album in its own theme gets matching icons. There are no
  static icon files; change the monogram in `site-icon.ts`.
- **Invoices** use a theme's colours with its optional `invoice` overrides. Each invoice picks its
  own style, separate from the site theme.
- **Colours in components.**
  - Use CSS variables only, never hex values.
  - For emphasis, use `var(--highlight, var(--text))`, so themes with a highlight (green → gold)
    pick it up.
  - Chart series use `--viz-1` to `--viz-4`.

## UI and copy conventions

- **Design rules.** Follow `DESIGN.md`:
  - square corners and 1px hairlines
  - serif headings at weight 400
  - small uppercase tracked labels
  - no shadows on cards
  - slow, eased motion
  - every screen works at 360px wide
- **Icons** are Lucide, imported one per file at stroke width 1.5:
  `import X from '@lucide/svelte/icons/x'`.
- **Copy:**
  - British English and typographic punctuation (’ “ ” — ×) in UI strings.
  - Button labels in Title Case in the source ("New Job", "Upload Theme"); CSS uppercases them.
  - Calm, plain sentences with no exclamation marks.
  - Say "client", not "society"; the app is used for non-society work too.
- **Personal details.** The repo is public, so never hard-code the owner's personal, address or
  bank details. Invoice sender defaults are deliberately blank and are filled in under
  Invoices → Settings.
