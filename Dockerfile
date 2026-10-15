# Ultra-Fast Production Runtime Container
FROM oven/bun:1 AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root system user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# Copy pre-compiled standalone Next.js bundle and dependencies from CI runner
COPY --chown=nextjs:nodejs .next/standalone ./
COPY --chown=nextjs:nodejs node_modules ./node_modules
COPY --chown=nextjs:nodejs prisma ./prisma
COPY --chown=nextjs:nodejs scripts ./scripts
COPY --chown=nextjs:nodejs package.json bun.lock ./
# Only the RSA public key — it's a verification key, safe to ship. The
# private key (keys/license-private.pem) must NEVER be added here; it stays
# off this shared image and is only ever mounted into our own SaaS infra via
# docker-compose.license-signing.yml.
COPY --chown=nextjs:nodejs keys/license-public.pem ./keys/license-public.pem

USER nextjs
EXPOSE 3000

CMD ["bun", "server.js"]
