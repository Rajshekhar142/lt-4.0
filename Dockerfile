# ============================================
# Stage 1: Dependencies Installation Stage
# ============================================
FROM node:26-alpine AS dependencies
WORKDIR /app

# Copy package files first to leverage Docker layer caching -
# dependencies only reinstall when these files change, not on every code edit
COPY package.json package-lock.json* ./

RUN grep -A2 "@emnapi/runtime" package-lock.json || echo "NOT FOUND IN CONTAINER"

RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ============================================
# Stage 2: Build Next.js application in standalone mode
# ============================================
FROM node:24-alpine AS builder
WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
# Uncomment to disable Next.js telemetry during build:
# ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ============================================
# Stage 3: Run Next.js application
# ============================================
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Uncomment to disable telemetry at runtime:
# ENV NEXT_TELEMETRY_DISABLED=1

# Next.js standalone output already includes a minimal node_modules subset,
# so no npm install needed in this final stage - just copy the built output

COPY --from=builder --chown=node:node /app/public ./public

# Prerender cache directory needs to exist with correct ownership before app starts
RUN mkdir .next && chown node:node .next

# output: 'standalone' in next.config.js produces a self-contained server.js
# plus a pruned node_modules - this is what makes the final image small
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Run as non-root user - node:alpine ships a built-in 'node' user for this
USER node

EXPOSE 3000

CMD ["node", "server.js"]
