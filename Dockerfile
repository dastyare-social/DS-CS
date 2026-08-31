# Multi-stage Dockerfile
# Build stage uses Bun to run TypeScript helpers and install dependencies
FROM node:20-bullseye AS builder

WORKDIR /app

# Install curl for bun installer
RUN apt-get update && apt-get install -y curl ca-certificates --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Install Bun (>=1.2 is required to read the text bun.lock format)
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v1.4.0"
ENV BUN_INSTALL="/root/.bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"

# Copy the lockfile with the manifest and install the exact pinned versions.
# --frozen-lockfile fails the build when bun.lock and package.json disagree,
# so every deploy resolves the same dependency tree instead of floating the
# caret to whatever version is newest at build time.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy the rest of the source
COPY . .

# Generate config + icons, then build Next in production mode
# Skip DB migrations, emoji uploads, and admin bootstrap (need runtime DB access)
ENV NODE_ENV=production
RUN bun run generate:config && bun run generate:icons && bunx next build

## Production image
FROM node:20-slim
WORKDIR /app

ENV NODE_ENV=production

# Copy built app and installed deps from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/AGENTS.md ./AGENTS.md
COPY --from=builder /app/README.md ./README.md

EXPOSE 8729

# Start the Next.js app
CMD ["sh", "-c", "node_modules/.bin/next start -p 8729"]
