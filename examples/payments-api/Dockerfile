# Pinned base image — a real, current, security-maintained Node 20 image.
# Customer would pin by digest in production:
#   FROM node:20-alpine@sha256:<digest>
FROM node:20-alpine

# Run as non-root in production.
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

# Dependency layer — separate so it caches when only source changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Application source.
COPY server.js ./

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/health || exit 1

CMD ["node", "server.js"]
