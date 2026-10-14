FROM --platform=$BUILDPLATFORM oven/bun:1.3.14-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ENV VITE_API_URL=/api
RUN bun run build

FROM nginxinc/nginx-unprivileged:stable-alpine
# Sobrescreve labels herdados da imagem base; GHCR vincula pacote ao repo por `source`.
LABEL org.opencontainers.image.source="https://github.com/RaeII/cidoa" \
      org.opencontainers.image.url="https://github.com/RaeII/cidoa" \
      org.opencontainers.image.title="cidoa-front" \
      org.opencontainers.image.description="Front do Cidoa (Nginx + SPA)" \
      org.opencontainers.image.version="" \
      org.opencontainers.image.revision="" \
      org.opencontainers.image.created="" \
      org.opencontainers.image.licenses=""
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
