# ── Stage 1: Build frontend ──────────────────────────────────
FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config + all package.json files for dependency resolution
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json shared/
COPY frontend/package.json frontend/
COPY agents/package.json agents/
COPY server/package.json server/
COPY data/package.json data/

RUN pnpm install --frozen-lockfile

# Copy source for shared (needed by frontend build) and frontend
COPY tsconfig.base.json ./
COPY shared/ shared/
COPY frontend/ frontend/

# Build shared types, then frontend
RUN pnpm --filter @prism/shared build && pnpm --filter @prism/frontend build

# ── Stage 2: Runtime ─────────────────────────────────────────
FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config + all package.json files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json shared/
COPY frontend/package.json frontend/
COPY agents/package.json agents/
COPY server/package.json server/
COPY data/package.json data/

RUN pnpm install --frozen-lockfile --prod=false

# Copy all source (server + agents + data use tsx runtime, no pre-compilation)
COPY tsconfig.base.json ./
COPY shared/ shared/
COPY agents/ agents/
COPY server/ server/
COPY data/ data/

# Copy built frontend from builder stage
COPY --from=builder /app/frontend/dist frontend/dist
# Copy built shared types from builder stage
COPY --from=builder /app/shared/dist shared/dist

ENV PORT=8080
ENV DISABLE_BACKGROUND_JOBS=1

EXPOSE 8080

CMD ["pnpm", "--filter", "@prism/server", "start"]
