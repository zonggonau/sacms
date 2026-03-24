FROM oven/bun:1 AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json bun.lock ./
COPY prisma ./prisma/
RUN bun install --frozen-lockfile
RUN bun x prisma generate

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
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

# The builder now has everything ready in .next/standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# static and public were copied inside standalone, so we only need to copy from builder's standalone
# but to be safe and clear, we can also copy directly if needed, but Next.js expects them in specific paths
# Actually, the runner stage usually needs them as siblings to server.js in standalone mode.

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
