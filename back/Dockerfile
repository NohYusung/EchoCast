FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY back/package.json ./back/package.json
COPY front/package.json ./front/package.json
RUN npm ci --workspace @new-dubright/back --include-workspace-root=false

COPY back ./back
RUN npm run build --workspace @new-dubright/back
RUN npm prune --omit=dev --workspace @new-dubright/back --include-workspace-root=false

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/back/package.json ./back/package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/back/node_modules ./back/node_modules
COPY --from=build /app/back/dist ./back/dist

WORKDIR /app/back
EXPOSE 3000
CMD ["node", "dist/main"]
