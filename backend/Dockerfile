FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Dummy values so envalid doesn't throw during medusa build
ENV DATABASE_URL=postgres://placeholder:placeholder@localhost:5432/placeholder
ENV REDIS_URL=redis://localhost:6379
ENV JWT_SECRET=placeholder_jwt_secret_for_build_only_xx
ENV COOKIE_SECRET=placeholder_cookie_secret_build_only_x
ENV STORE_CORS=http://localhost:3000
ENV ADMIN_CORS=http://localhost:7001
ENV AUTH_CORS=http://localhost:3000
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S poshakh && adduser -S poshakh -G poshakh
# Copy with correct ownership so the poshakh user can write migration dirs
# that Medusa creates inside node_modules at startup
COPY --from=builder --chown=poshakh:poshakh /app/.medusa/server .
COPY --from=deps --chown=poshakh:poshakh /app/node_modules ./node_modules
USER poshakh
EXPOSE 9000
CMD ["sh", "-c", "npx medusa db:migrate && npx medusa db:sync-links && npx medusa start"]
