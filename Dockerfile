FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV DATABASE_URL=mysql://user:pass@127.0.0.1:3306/build_dummy
ENV AUTH_SECRET=build-only-secret-build-only-secret-build-only-secret
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim AS app
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=127.0.0.1
ENV PORT=3700
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3700
CMD ["node","server.js"]

FROM node:22-bookworm-slim AS worker-deps
WORKDIR /app
RUN npm init -y >/dev/null 2>&1 \
 && npm install --no-audit --no-fund \
      @prisma/adapter-mariadb@7.10.0 \
      @prisma/client@7.10.0 \
      bcryptjs@3.0.2 \
      dotenv@17.2.2 \
      mariadb@3.4.5 \
      nodemailer@7.0.6 \
      prisma@7.10.0 \
      tsx@4.20.5 \
      web-push@3.6.7

FROM node:22-bookworm-slim AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=worker-deps /app/node_modules ./node_modules
COPY --from=build /app/generated ./generated
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/lib/db.ts ./lib/db.ts
COPY --from=build /app/lib/notifications/send.ts ./lib/notifications/send.ts
COPY --from=build /app/scripts/notification-worker.ts ./scripts/notification-worker.ts
CMD ["./node_modules/.bin/tsx","scripts/notification-worker.ts"]
