# ─────────────────────────────────────────────────────────────
# STAGE 1: Install production dependencies only
# ─────────────────────────────────────────────────────────────
FROM node:18-alpine AS deps
WORKDIR /app

# Copy only package files first (leverages Docker layer caching)
COPY package*.json ./

# Install prod dependencies (strips devDependencies & caches)
RUN npm ci --only=production && npm cache clean --force

# ─────────────────────────────────────────────────────────────
# STAGE 2: Secure runtime image
# ─────────────────────────────────────────────────────────────
FROM node:18-alpine AS runner
WORKDIR /app

# 🔒 Security: Create non-root user & group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy production node_modules from Stage 1
COPY --from=deps /app/node_modules ./node_modules

# Copy application source code
COPY . .

# 🔒 Security: Drop root privileges
USER appuser

# 🏥 Health check: Cloud platforms use this to know if app is alive
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

# Default command (will be overridden per service in docker-compose)
CMD ["node", "src/app.js"]