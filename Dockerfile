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

# ---------------------------------------------------------------- prisma cli
# O CLI do Prisma precisa existir na imagem final para rodar as migrações no
# boot. Ele NÃO vem no standalone do Next, que só inclui o que a aplicação
# importa — e o prisma é dependência de desenvolvimento.
#
# Sem isto o CMD caía em "npx prisma", que baixa a ÚLTIMA versão do npm no
# boot. Hoje é a 7.x, onde o campo "url" do datasource foi removido: o
# container entrava em ciclo de reinício com P1012.
#
# Estágio próprio, e não cópia pacote a pacote, porque o CLI arrasta
# dependências transitivas (effect, entre outras) que dariam MODULE_NOT_FOUND.
FROM base AS prisma-cli
COPY package.json ./
RUN npm install --no-save --no-package-lock       "prisma@$(node -p "require('./package.json').devDependencies.prisma")"

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
COPY --from=prisma-cli /app/node_modules ./ferramentas/node_modules



# Criação do primeiro administrador. Sem isto, sobe o sistema e ninguém entra:
# criar conta pela tela exige estar logado como admin, e o seed não roda em
# produção. Uso no console do container: node scripts/criar-admin.cjs
COPY --from=builder /app/scripts ./scripts

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

# Aplica migrações pendentes antes de subir
CMD ["sh", "-c", "node ferramentas/node_modules/prisma/build/index.js migrate deploy && node server.js"]
