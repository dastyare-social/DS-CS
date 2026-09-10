# Multi-stage Dockerfile
# Build stage uses Bun to run TypeScript helpers and install dependencies
FROM node:22-bookworm AS builder

WORKDIR /app

# Install curl for bun installer
RUN apt-get update && apt-get install -y curl ca-certificates --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v1.1.26"
ENV BUN_INSTALL="/root/.bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"

# Copy project manifest and install dependencies with bun
COPY package.json package-lock.json* ./
RUN if [ -f package.json ]; then bun install --production=false || bun install; fi

# Copy the rest of the source
COPY . .

# Generate config + icons, then build Next in production mode
# Skip DB migrations, emoji uploads, and admin bootstrap (need runtime DB access)
ENV NODE_ENV=production
RUN bun run generate:config && bun run generate:icons && bunx next build

## Production image
FROM node:22-bookworm-slim
WORKDIR /app

ENV NODE_ENV=production

# Copy built app and installed deps from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
# Runtime startup runs npm scripts (generate:config, db:migrate, bootstrap:admin)
# via tsx, so they need the script sources, config, and the tsconfig paths (for
# the "@/*" alias used by bootstrap-admin.ts and the db helpers).
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
COPY --from=builder /app/config ./config
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/AGENTS.md ./AGENTS.md
COPY --from=builder /app/README.md ./README.md

EXPOSE 8729

# Start the Next.js app
CMD ["sh", "-c", "node_modules/.bin/next start -p 8729"]
