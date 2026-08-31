# ─── SaCMS Dedicated Node / Bun Appliance for Contabo VPS ─────────────────────
FROM oven/bun:1.2-alpine AS base

WORKDIR /app

# Install system dependencies (openssl, curl, postgresql-client)
RUN apk add --no-cache libc6-compat openssl curl postgresql-client

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy package descriptors
COPY package.json bun.lock* ./
COPY prisma ./prisma

# Install dependencies and generate Prisma client
RUN bun install --frozen-lockfile --production
RUN bunx prisma generate

# Copy source code and config
COPY . .

# Expose port
EXPOSE 3000

# Healthcheck for MCP & API availability
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/public/brand || exit 1

# Start Next.js App / MCP Gateway
CMD ["bun", "run", "start"]
