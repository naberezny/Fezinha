# Imagens de produção do Fezinha. Contexto = raiz do repositório (ver deploy/docker-compose.yml).
#   build        instala tudo e compila API e app (só intermediária)
#   ferramentas  workspace completo: migrations do Prisma e carga histórica
#   api          NestJS com só as dependências de produção
#   web          nginx com o app Angular, repassando /loterias e /saude para a API

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NX_DAEMON=false NX_NO_CLOUD=true CI=true
# OpenSSL: o CLI do Prisma (migrations) procura a biblioteca ao iniciar.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* \
  && corepack enable && corepack prepare pnpm@10.33.1 --activate
WORKDIR /repo

FROM base AS build
# Dependências primeiro (camada reaproveitada enquanto o lockfile não muda). O postinstall roda `prisma generate`.
COPY package.json pnpm-lock.yaml prisma.config.ts ./
COPY apps/api/prisma apps/api/prisma
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm nx run-many -t build -p api app --configuration=production --skip-nx-cache

FROM build AS ferramentas
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

# Dependências de produção num node_modules plano: o bundle da API faz require de @prisma/client e de tslib
# (este vem como dependência do NestJS; sem o layout plano, não seria encontrado a partir de /app).
FROM base AS dependencias-producao
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts --config.node-linker=hoisted

FROM node:24-bookworm-slim AS api
ENV NODE_ENV=production PORTA=3000
WORKDIR /app
COPY --from=dependencias-producao /repo/node_modules ./node_modules
COPY --from=build /repo/dist/apps/api ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "main.js"]

FROM nginx:1.27-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/dist/apps/app/browser /usr/share/nginx/html
EXPOSE 80
