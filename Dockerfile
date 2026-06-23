FROM oven/bun:1 AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json bun.lock ./
COPY prisma ./prisma/
RUN bun install --frozen-lockfile
RUN bun add prisma@6.11.1 @prisma/client@6.11.1
RUN bun x prisma generate

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_SENTRY_BUILD=1
ENV SENTRY_IGNORE_API_RESOLUTION_ERROR=1
ENV SENTRY_DISABLE_SERVER_SIDE_SOURCE_MAPS=1
RUN bun run build
# Manual copy within builder to ensure standalone structure is correct
RUN cp -r .next/static .next/standalone/.next/static
RUN cp -r public .next/standalone/public

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Bun image is Debian-based, use groupadd/useradd instead of Alpine's addgroup/adduser
RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 --gid nodejs nextjs

# Copy essential files for runtime
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

# static and public were copied inside standalone, but some setups might need them at root
# Let's ensure they are available where server.js expects them (usually inside standalone)
# but for manual scripts we might want them at root.
# Standalone build already includes them if we copied them during builder phase.

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
