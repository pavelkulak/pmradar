FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev && npx prisma generate

FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/scripts ./scripts
COPY --from=builder --chown=node:node /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=node:node /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=node:node /app/node_modules/bcryptjs ./node_modules/bcryptjs
# Prisma CLI config dependencies needed by `prisma migrate deploy` at startup.
COPY --from=builder --chown=node:node /app/node_modules/@standard-schema/spec ./node_modules/@standard-schema/spec
COPY --from=builder --chown=node:node /app/node_modules/c12 ./node_modules/c12
COPY --from=builder --chown=node:node /app/node_modules/chokidar ./node_modules/chokidar
COPY --from=builder --chown=node:node /app/node_modules/citty ./node_modules/citty
COPY --from=builder --chown=node:node /app/node_modules/confbox ./node_modules/confbox
COPY --from=builder --chown=node:node /app/node_modules/consola ./node_modules/consola
COPY --from=builder --chown=node:node /app/node_modules/deepmerge-ts ./node_modules/deepmerge-ts
COPY --from=builder --chown=node:node /app/node_modules/defu ./node_modules/defu
COPY --from=builder --chown=node:node /app/node_modules/destr ./node_modules/destr
COPY --from=builder --chown=node:node /app/node_modules/dotenv ./node_modules/dotenv
COPY --from=builder --chown=node:node /app/node_modules/effect ./node_modules/effect
COPY --from=builder --chown=node:node /app/node_modules/empathic ./node_modules/empathic
COPY --from=builder --chown=node:node /app/node_modules/exsolve ./node_modules/exsolve
COPY --from=builder --chown=node:node /app/node_modules/fast-check ./node_modules/fast-check
COPY --from=builder --chown=node:node /app/node_modules/giget ./node_modules/giget
COPY --from=builder --chown=node:node /app/node_modules/jiti ./node_modules/jiti
COPY --from=builder --chown=node:node /app/node_modules/node-fetch-native ./node_modules/node-fetch-native
COPY --from=builder --chown=node:node /app/node_modules/nypm ./node_modules/nypm
COPY --from=builder --chown=node:node /app/node_modules/ohash ./node_modules/ohash
COPY --from=builder --chown=node:node /app/node_modules/pathe ./node_modules/pathe
COPY --from=builder --chown=node:node /app/node_modules/perfect-debounce ./node_modules/perfect-debounce
COPY --from=builder --chown=node:node /app/node_modules/pkg-types ./node_modules/pkg-types
COPY --from=builder --chown=node:node /app/node_modules/pure-rand ./node_modules/pure-rand
COPY --from=builder --chown=node:node /app/node_modules/rc9 ./node_modules/rc9
COPY --from=builder --chown=node:node /app/node_modules/readdirp ./node_modules/readdirp
COPY --from=builder --chown=node:node /app/node_modules/tinyexec ./node_modules/tinyexec
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
