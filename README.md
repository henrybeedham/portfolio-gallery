<img src="assets/icon.svg" width="64" height="64" alt="">

# Client Gallery

A self-hosted photography portfolio and client-delivery platform. It combines a public portfolio with private, password-protected client galleries, full-resolution downloads and an admin dashboard. Built with SvelteKit and Svelte 5, and runs as a single Docker container with an SQLite database.

## Features

**Public site**

- Editorial homepage with a hero image, a featured album (grid or masonry), “Explore More” album cards and an About section with contact details.
- `/galleries`: a responsive masonry listing of every public album.
- Album pages on custom slugs (`/your-album`) with Markdown descriptions, per-album accent colours, an optional blurred background, tag filters, sort order (oldest, newest or random), progressive “Load More” and an expiry countdown.
- A lightbox with keyboard, swipe and click-outside controls. Every photo also has its own shareable page with EXIF details and Open Graph/Twitter metadata.
- Downloads: single originals, the whole album, or a selection as a streamed ZIP with a progress percentage.
- Password-protected galleries, which stay unlocked for the browser session, and expiring galleries that show your contact details once they expire.

**Admin** (`/admin`)

- Dashboard with totals (albums, photos, page views, photo and album downloads) and an album table.
- Album editor with batched multi-file uploads and progress, shift-click range selection, bulk delete and tagging, cover and background images, analytics, and sharing links.
- Maintenance jobs: regenerate thumbnails, re-extract metadata, and import from a server folder.
- Settings for branding, the hero image, homepage copy, contact details, Discord notifications, light or dark theme, and defaults for new albums.

## Quick start (Docker)

```sh
cp .env.example .env      # set ADMIN_PASSWORD (and optionally SESSION_SECRET / ORIGIN)
docker compose up -d --build
```

Open <http://localhost:3000> and sign in at `/admin/login`.

If `ADMIN_PASSWORD` isn't set, a password is generated on first start and saved to `data/.admin-password` (it isn't printed to the logs). Placeholder passwords such as `change-me` are refused at startup.

### Data

Everything lives in the `./data` volume:

| Path                                 | Contents                                   |
| ------------------------------------ | ------------------------------------------ |
| `gallery.db`                         | SQLite database (albums, photos, settings) |
| `photos/originals/`                  | Original uploads, untouched                |
| `photos/thumbs/`, `photos/medium/`   | Generated WebP derivatives                 |
| `site/`                              | Hero image                                 |
| `.session-secret`, `.admin-password` | Generated secrets (if not set via env)     |

To back up, copy the `data` folder; stop the container first, or use `sqlite3 gallery.db .backup` for a live copy. Thumbnails can always be rebuilt from the originals with **Maintenance → Regenerate thumbnails**.

### Importing from a folder

Put images in `./import`, or in `./import/<album-slug>` to target one album. Then open the album's **Maintenance** tab and choose **Import**. Imported files are moved into the library; files that fail stay where they are.

### Configuration

| Variable          | Default        | Description                                                                   |
| ----------------- | -------------- | ----------------------------------------------------------------------------- |
| `ADMIN_USERNAME`  | `admin`        | Admin username                                                                |
| `ADMIN_PASSWORD`  | generated      | Admin password                                                                |
| `SESSION_SECRET`  | generated      | Secret used to sign cookies                                                   |
| `ORIGIN`          | auto           | Public URL, e.g. `https://photos.example.com` (see below)                     |
| `BODY_SIZE_LIMIT` | `512M`         | Maximum size of a single uploaded photo (other requests are capped at 1 MB)   |
| `TRUST_PROXY`     | `auto`         | Whose `X-Forwarded-*` headers to trust: `auto`, `true` or `false` (see below) |
| `XFF_DEPTH`       | `1`            | Number of proxies in front of the app, for reading `X-Forwarded-For`          |
| `IMPORT_DIR`      | `/data/import` | Server-side import folder                                                     |
| `PUID` / `PGID`   | `1000`         | User and group the app runs as; the entrypoint fixes `/data` ownership        |
| `PORT`            | `3000`         | Port inside the container (`GALLERY_PORT` sets the published port)            |

### Reverse proxy

The server works over plain `http://` on your LAN and behind a TLS reverse proxy. It reads `X-Forwarded-Proto`, `X-Forwarded-Host` and `X-Forwarded-For`, which Caddy, Traefik and most nginx setups send. If your proxy doesn't send them, set `ORIGIN`.

Those headers are only trusted from connections on loopback or private networks (`TRUST_PROXY=auto`), so visitors reaching the app directly from the internet can't spoof the site address or their IP (which login and gallery rate limits rely on). Set `TRUST_PROXY=false` if there's no proxy at all. If the proxy runs on the same host, publish the port only on loopback with `GALLERY_BIND=127.0.0.1`. With more than one proxy in a chain (e.g. Cloudflare in front of nginx), set `XFF_DEPTH` to the number of proxies.

Allow large request bodies for uploads. With nginx:

```nginx
client_max_body_size 512m;
proxy_request_buffering off;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host  $host;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
```

Caddy needs nothing extra: `photos.example.com { reverse_proxy localhost:3000 }`.

## Migrating from the previous gallery

`scripts/import-legacy.sh` copies everything from the previous version of this app
([henrybeedham/client-gallery](https://github.com/henrybeedham/client-gallery)) when both run in Docker
on the same machine:

```sh
scripts/import-legacy.sh --dry-run   # preview the plan; nothing is changed
scripts/import-legacy.sh             # import (asks a few questions first)
```

It imports albums (including passwords, expiry dates, colours, layout and visibility), original photos
with their EXIF details, tags, cover and background images, site settings, the hero image and the
view/download counts. Old links (`/album/<slug>` and `/album/<slug>/photo/<id>`) redirect to the
imported albums.

The old gallery is never modified. The script runs a throwaway container from the new image with the
old container's volumes mounted **read-only**, and it reads a snapshot copy of the old database.
Running it again is safe: anything already imported is skipped, so you can rerun it to resume an
interrupted import or to pick up photos added to the old gallery since. Start the new gallery at least
once before importing so its database exists.

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
- `sharp` for thumbnails (WebP), `exifr` for EXIF, `yazl` for streaming uncompressed ZIPs with an exact `Content-Length`
- `marked` for album descriptions (raw HTML is escaped, and only safe link protocols are allowed)
