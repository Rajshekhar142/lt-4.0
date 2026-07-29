# ============================================
# Global Arguments (Must be declared before any FROM)
# ============================================
ARG NODE_VERSION=24.13.0
# Default to alpine (for dev/local builds)
ARG NODE_FLAVOR=alpine

# ============================================
# Stage 1: Dependencies Installation Stage
# ============================================
FROM node:${NODE_VERSION}-${NODE_FLAVOR} AS dependencies

# Set working directory
WORKDIR /app

# Alpine requires libc6-compat for many Node native dependencies to run correctly.
# This conditional block safely runs on Alpine but skips on Debian Slim.
RUN if [ -f /etc/alpine-release ]; then \
      apk add --no-cache libc6-compat; \
    fi

# Copy package-related files first to leverage Docker's caching mechanism
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./

# Install project dependencies with frozen lockfile for reproducible builds
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=cache,target=/usr/local/share/.cache/yarn \
    --mount=type=cache,target=/root/.local/share/pnpm/store \
  if [ -f package-lock.json ]; then \
    npm ci --no-audit --no-fund; \
  elif [ -f yarn.lock ]; then \
    corepack enable yarn && yarn install --frozen-lockfile --production=false; \
  elif [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm && pnpm install --frozen-lockfile; \
  else \
    echo "No lockfile found." && exit 1; \
  fi

# ============================================
# Stage 2: Build Next.js application in standalone mode
# ============================================
# Re-declare arguments inside new stages so they are in scope
ARG NODE_VERSION=24.13.0
ARG NODE_FLAVOR=alpine
FROM node:${NODE_VERSION}-${NODE_FLAVOR} AS builder

# Set working directory
WORKDIR /app

# Copy project dependencies from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy application source code
COPY . .

ENV NODE_ENV=production

# Build Next.js application
RUN if [ -f package-lock.json ]; then \
    npm run build; \
  elif [ -f yarn.lock ]; then \
    corepack enable yarn && yarn build; \
  elif [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm && pnpm build; \
  else \
    echo "No lockfile found." && exit 1; \
  fi

# ============================================
# Stage 3: Run Next.js application
# ============================================
ARG NODE_VERSION=24.13.0
ARG NODE_FLAVOR=alpine
FROM node:${NODE_VERSION}-${NODE_FLAVOR} AS runner

# Set working directory
WORKDIR /app

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy production assets
COPY --from=builder --chown=node:node /app/public ./public

# Set the correct permission for prerender cache
# Alpine and Debian use different underlying user management systems,
# but the default 'node' user exists on both official images with UID 1000.
RUN mkdir .next && chown node:node .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Switch to non-root user for security best practices
USER node

# Expose port 3000 to allow HTTP traffic
EXPOSE 3000

# Start Next.js standalone server
CMD ["node", "server.js"]