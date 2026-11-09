# syntax=docker/dockerfile:1

# ---- Build -----------------------------------------------------------------
FROM node:24-bookworm-slim AS build
WORKDIR /app

# Bun is used as the package manager; Node runs the build and the server.
COPY --from=oven/bun:1.4 /usr/local/bin/bun /usr/local/bin/bun

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build \
	&& rm -rf node_modules \
	&& bun install --frozen-lockfile --production

# ---- Runtime ---------------------------------------------------------------
FROM node:24-bookworm-slim
WORKDIR /app

# The larger thread pool stops bulk image processing from holding up visitors' file requests.
ENV NODE_ENV=production \
	DATA_DIR=/data \
	PORT=3000 \
	HOST=0.0.0.0 \
	UV_THREADPOOL_SIZE=16

# ffmpeg and ffprobe make video posters and read videos' length and date.
COPY --from=mwader/static-ffmpeg:9.0.2-1 /ffmpeg /ffprobe /usr/local/bin/
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY package.json server.js ./
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/gallery-entrypoint

RUN mkdir -p /data/import && chown -R node:node /data
VOLUME ["/data"]
EXPOSE 3000

# Starts as root only to fix /data ownership, then drops to PUID:PGID (default node, 1000:1000).
ENTRYPOINT ["gallery-entrypoint"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
