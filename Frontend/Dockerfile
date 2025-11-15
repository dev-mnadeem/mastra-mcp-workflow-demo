# syntax=docker/dockerfile:1

# --- build -----------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The API base is inlined into the client bundle at build time, so it has to be
# supplied here rather than at `docker run`.
ARG NEXT_PUBLIC_API_BASE=http://localhost:7271
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
RUN npm run build

# --- runtime ---------------------------------------------------------------
# `output: "standalone"` traces the server's real imports into .next/standalone,
# so the image carries neither dev dependencies nor the full node_modules tree.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=7272 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 7272
CMD ["node", "server.js"]
