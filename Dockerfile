# Build multi-estágio para o EasyPanel.
# O EasyPanel detecta este arquivo e constrói a imagem automaticamente.

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ---------------------------------------------------------------- deps
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# ---------------------------------------------------------------- build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------------------------------------------------------------- runtime
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=America/Sao_Paulo

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Chromium para gerar os PDFs das cartas, atas e termos
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont tzdata
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

# Aplica migrações pendentes antes de subir
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
