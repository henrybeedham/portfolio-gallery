<img src="assets/icon.svg" width="64" height="64" alt="">

# Client Gallery

[https://henrybeedham.com](https://henrybeedham.com)

A self-hosted photography portfolio and client-delivery platform. It combines a public portfolio with private, password-protected client galleries, full-resolution downloads and an admin dashboard. Built with SvelteKit and Svelte 5, and runs as a single Docker container with an SQLite database.

## Features

**Public site**

- Editorial homepage with a hero image, a featured album (grid or masonry, chosen under **Settings → Homepage**), cards for every album shown on the homepage, and an About section with contact details and an optional enquiry form.
- **Search engines** only see the albums on the homepage. Every other album, even a public one, is for people with the link: its pages and photos are marked `noindex`, and it's left out of `/sitemap.xml`.
- Photo captions from Lightroom become their alt text, and a blurred placeholder shows while each thumbnail loads.
- Album pages on custom slugs (`/your-album`) with Markdown descriptions, their own theme or the site’s, an optional blurred background, tag filters, sort order (oldest, newest or random), progressive “Load More” and an expiry countdown.
- A lightbox with keyboard, swipe and click-outside controls. Every photo also has its own shareable link with Open Graph/Twitter metadata.
- Videos (MP4, MOV and WebM) alongside photos, with a poster frame as the thumbnail, the length shown on the grid, and playback in the lightbox.
- Downloads: single originals, the whole album, or a selection as a streamed ZIP, handed to the browser's own download manager. Interrupted downloads resume where they stopped.
- Password-protected galleries, which stay unlocked for the browser session, and expiring galleries that show your contact details once they expire.

**Admin** (`/admin`)

- **Dashboard**: what needs attention (overdue invoices, jobs to deliver or invoice), jobs in the next two weeks, money (outstanding, overdue, paid this month and this tax year) and gallery activity over the last week.
- **Galleries** (`/admin/albums`): every album as a table or a grid of covers, with search and filters (public, private, password, expired).
- **Enquiries** (`/admin/enquiries`): enquiries from the homepage form, with a notification for each, a count in the sidebar, and **Make Job** to turn one into a tentative job.
- **Passkeys**: sign in with Face ID, Touch ID, Windows Hello or a password manager, set up under **Settings → Sign-in**. The password keeps working.
- **Search**: ⌘K (Ctrl K) finds pages, galleries, jobs, invoices and clients from anywhere in the admin, and each list has its own search box.
- **Lightroom Classic** (`/admin/lightroom`): a publish-service plugin, downloaded from this page with the site's address filled in. Each published collection is an album; republished edits replace photos in place. It signs in with an API token made on the same page.
- **Widgets** (`/admin/widgets`): iPhone Home Screen and Lock Screen widgets for jobs, money, gallery activity and what needs doing, through the free Scriptable app, with live previews of each option and a read-only token.
- Album editor with batched multi-file uploads and progress (sent in 8 MB pieces, so large videos get through proxies and a dropped connection only repeats one piece), shift-click range selection, bulk delete and tagging (keywords from Lightroom and similar tools become tags automatically), cover and background images, analytics, and sharing links.
- Maintenance jobs: regenerate thumbnails, re-extract metadata, and import from a server folder.
- Settings for branding, the hero image, homepage copy, contact details, Discord and phone notifications, the theme, and defaults for new albums.
- **Backups** (`/admin/backups`): the database is backed up automatically before every update (the last ten are kept), and you can back up, download, restore or delete from the page. **Download Everything** streams the database with every original photo and video as one ZIP, to keep somewhere else.

**Jobs, invoices and analytics**

- **Jobs** (`/admin/jobs`): each shoot with its date, start and end time, client and location, plus whether it's
  confirmed, tentative or cancelled. Each row is coloured by its stage (to deliver, to invoice,
  awaiting payment, overdue…), jobs whose times overlap are flagged, and a job is marked delivered on
  its own once a linked album is public and has photos. Link one or more albums. Albums never need a job or an invoice. Jobs hold no money: a job's fee and whether
  it's paid come from its invoices. One invoice can cover several jobs, with its amount split evenly
  between them, and a job can have several invoices. Sent an invoice from another platform? Use “Invoiced Elsewhere”
  on the job to record it.
- **Calendar** (`/admin/jobs/calendar`): a private link that puts your jobs in Apple Calendar and
  keeps them up to date.
- **Saved addresses**: type a client's name and pick one of the addresses you've saved under
  **Invoices → Settings** (or type one in for one-off clients). Clients you've billed before pick their address automatically.
- **Invoices** (`/admin/invoices`): PDF invoices with a live preview, a unique random 8-digit number,
  line items, a due date (by default the shoot date, or your payment terms), and a paid stamp once
  paid. Your details, bank details and notes are copied onto each invoice, so changing your defaults
  later never alters old invoices. Nothing is shared by link; download the PDF and send it yourself.
- **Tax year export** (`/admin/invoices/tax-year`): a UK tax year's invoices (6 April to 5 April) as
  CSV, counted by date paid (the cash basis) or date issued.
- **Drafts**: save an invoice as a draft to hold a job's fee before you send anything, for example
  5 hours of video at £60, 2 hours of editing at £40 and 2 hours of photography at £60. Drafts count
  as booked work in Analytics. **Issue Invoice** dates it that day and works out the due date again.
- **Imported records**: money that jobs used to hold (hours × rate, a paid tick and earlier invoice
  numbers) became invoices marked “Imported”, which keep the earlier numbers and have no PDF.
- **Invoice styles** use the same themes as the site but are chosen separately: a default under
  **Invoices → Settings**, and per invoice.
- **Analytics** (`/admin/analytics`): earnings, money awaiting payment, booked work, average job and
  time to get paid, income by month (paid → invoiced → drafts → tentative), top clients, who you billed (by saved address),
  and weekly gallery views and downloads. Filter by this or last academic year, the last 12 months, the calendar year, all time, or
  any custom dates.

**Themes**

Themes are JSON files: the built-in light, dark and green themes are in `src/lib/themes/`, and you
can upload your own under **Settings → Appearance** (they're saved in `data/themes/`) without rebuilding. See [`src/lib/themes/README.md`](src/lib/themes/README.md)
for the format. Any album can use a different theme from the rest of the site (album → **Details →
Appearance**); its album page, photo pages and password screen are shown in that theme.

## Deployment

The app is one container that keeps everything (the SQLite database, your photos and videos) on a persistent disk mounted at `/data`. Anywhere that can run a Docker image with a persistent volume can host it. A ready-built image for amd64 and arm64 (including a Raspberry Pi or an Apple Silicon Mac) is published with every change:

```
ghcr.io/henrybeedham/portfolio-gallery:latest
```

| Option                                | Good for                                   | Cost                                 |
| ------------------------------------- | ------------------------------------------ | ------------------------------------ |
| [Railway](#railway-one-click)         | Trying it out, or hosting without a server | Usage-based, plus storage for photos |
| [Docker on your own machine](#docker) | A home server, NAS or a quick local look   | Free                                 |
| [Docker Compose](#docker-compose)     | A VPS or home server you'll keep running   | Your server                          |
| [Coolify](#coolify)                   | A server already managed by Coolify        | Your server                          |
| [Vercel, Netlify, …](#why-not-vercel) | Not supported                              | —                                    |

### Railway (one click)

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/client-gallery)

The button creates the app from the published image with a volume at `/data`, a random admin password and a `*.up.railway.app` address with HTTPS.

1. Click the button, sign in to Railway and choose **Deploy**.
2. When it's running, open the service's **Variables** tab and copy `ADMIN_PASSWORD`.
3. Open the address under **Settings → Networking** and sign in at `/admin/login` as `admin`.

Photos take space: grow the volume under the service's **Volume** settings as your library grows (the size you can choose depends on your Railway plan). To use your own domain, add it under **Settings → Networking**; nothing else needs changing. Updates are a redeploy, which pulls the latest image; the database is backed up automatically before it changes.

### Docker

To try it on your own computer or server with one command:

```sh
docker run -d --name gallery --restart unless-stopped \
  -p 3000:3000 -v gallery-data:/data \
  -e ADMIN_PASSWORD='choose-a-long-password' \
  ghcr.io/henrybeedham/portfolio-gallery:latest
```

Then open <http://localhost:3000> and sign in at `/admin/login` as `admin`. Everything is kept in the `gallery-data` volume. To update, `docker pull` the image, then remove and recreate the container with the same command. For a site on the internet, put it behind a reverse proxy that handles HTTPS (see [Reverse proxy](#reverse-proxy)).

### Docker Compose

```sh
git clone https://github.com/henrybeedham/portfolio-gallery.git && cd portfolio-gallery
cp .env.example .env      # set ADMIN_PASSWORD (and optionally SESSION_SECRET / ORIGIN)
docker compose up -d
```

This pulls the published image and keeps its data in `./data`. Update with `docker compose pull && docker compose up -d`, or build from your checkout with `docker compose up -d --build`.

The compose file doesn't publish a port: a reverse proxy on the same Docker network routes to the app on port 3000. To open it directly, add `ports: ['3000:3000']` to the `gallery` service, then open <http://localhost:3000>.

If `ADMIN_PASSWORD` isn't set, a password is generated on first start and saved to `data/.admin-password` (it isn't printed to the logs). Placeholder passwords such as `change-me` are refused at startup.

### Coolify

Create a resource from this repository using the **Docker Compose** build pack, then give the `gallery` service a domain with port 3000, e.g. `https://photos.example.com:3000`, and set `ADMIN_PASSWORD` in its environment variables. Coolify's proxy needs no other changes: uploads are sent in small pieces, so they stay within Traefik's 60-second request limit.

### Why not Vercel?

Vercel, Netlify, Cloudflare Pages and similar hosts run apps as short-lived functions with no disk that survives between requests. This app needs a long-running server: the SQLite database and every original photo live on disk, thumbnails and video previews are made in the background with `sharp` and ffmpeg, and full-album ZIPs stream for as long as a download takes. So there's no Vercel button. For the same reason, Heroku, Google Cloud Run and DigitalOcean App Platform won't work without a persistent volume. Railway, Fly.io, Render (with a disk) or any VPS will.

### Data

Everything lives in the `/data` volume (`./data` with the compose file):

| Path                                 | Contents                                                   |
| ------------------------------------ | ---------------------------------------------------------- |
| `gallery.db`                         | SQLite database (albums, photos, jobs, invoices, settings) |
| `photos/originals/`                  | Original uploads, untouched                                |
| `photos/thumbs/`, `photos/medium/`   | Generated WebP derivatives                                 |
| `site/`                              | Hero image                                                 |
| `themes/`                            | Your own theme files (optional)                            |
| `.session-secret`, `.admin-password` | Generated secrets (if not set via env)                     |

To back up, copy the `data` folder; stop the container first, or use `sqlite3 gallery.db .backup` for a live copy. Thumbnails can always be rebuilt from the originals with **Maintenance → Regenerate thumbnails**.

### Importing from a folder

Put images in `./import`, or in `./import/<album-slug>` to target one album. Then open the album's **Maintenance** tab and choose **Import**. Imported files are moved into the library; files that fail stay where they are.

### Configuration

| Variable          | Default        | Description                                                                                               |
| ----------------- | -------------- | --------------------------------------------------------------------------------------------------------- |
| `ADMIN_USERNAME`  | `admin`        | Admin username                                                                                            |
| `ADMIN_PASSWORD`  | generated      | Admin password                                                                                            |
| `SESSION_SECRET`  | generated      | Secret used to sign cookies                                                                               |
| `ORIGIN`          | auto           | Public URL, e.g. `https://photos.example.com` (see below)                                                 |
| `BODY_SIZE_LIMIT` | `512M`         | Largest single upload request (photos and videos go up in 8 MB pieces; other requests are capped at 1 MB) |
| `TRUST_PROXY`     | `auto`         | Whose `X-Forwarded-*` headers to trust: `auto`, `true` or `false` (see below)                             |
| `XFF_DEPTH`       | `1`            | Number of proxies in front of the app, for reading `X-Forwarded-For`                                      |
| `IMPORT_DIR`      | `/data/import` | Server-side import folder                                                                                 |
| `PUID` / `PGID`   | `1000`         | User and group the app runs as; the entrypoint fixes `/data` ownership                                    |
| `PORT`            | `3000`         | Port inside the container                                                                                 |

### Reverse proxy

The server works over plain `http://` on your LAN and behind a TLS reverse proxy. It reads `X-Forwarded-Proto`, `X-Forwarded-Host` and `X-Forwarded-For`, which Caddy, Traefik and most nginx setups send. If your proxy doesn't send them, set `ORIGIN`.

Those headers are only trusted from connections on loopback or private networks (`TRUST_PROXY=auto`), so visitors reaching the app directly from the internet can't spoof the site address or their IP (which login and gallery rate limits rely on). Set `TRUST_PROXY=false` if there's no proxy at all. The compose file publishes no port, so the proxy is the only way in. With more than one proxy in a chain (e.g. Cloudflare in front of nginx), set `XFF_DEPTH` to the number of proxies.

Allow large request bodies for uploads, and turn off response buffering so client downloads go straight through instead of being written to the proxy's disk first. With nginx:

```nginx
client_max_body_size 512m;
proxy_request_buffering off;
proxy_buffering off;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host  $host;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
```

Caddy needs nothing extra: `photos.example.com { reverse_proxy gallery:3000 }`.

With Coolify, see [Coolify](#coolify) above.

## Links from the previous gallery

Albums and photos imported from the previous version of this app keep working at their old links:
`/album/<slug>` and `/album/<slug>/photo/<id>` redirect to the imported albums.

## Development

Requires Node 22.17+ (the app uses the built-in `node:sqlite`) and [Bun](https://bun.sh) as the package manager.

```sh
bun install
bun run dev          # http://localhost:5173 — data is stored in ./data
bun run check        # type-check
bun run build && bun run start   # production build on http://localhost:3000
```

In development, set `ADMIN_PASSWORD` in `.env` or use the generated one in `data/.admin-password`.

### Stack

- SvelteKit 3 and Svelte 5 (runes), `adapter-node` with a small custom `server.js`
- SQLite via `node:sqlite` (WAL mode)
- `sharp` for thumbnails (WebP), `exifr` for capture dates and keywords, `yazl` for streaming uncompressed ZIPs with an exact `Content-Length`
- `marked` for album descriptions (raw HTML is escaped, and only safe link protocols are allowed)
- `pdfkit` for invoices, with the site's typefaces embedded from `@fontsource/inter` and `@fontsource/playfair-display`
